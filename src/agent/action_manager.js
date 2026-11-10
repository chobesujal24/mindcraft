/* global process */
import assert from 'node:assert';

export class ActionManager {
    constructor(agent, { stopTimeoutMs = 20000, stopPollMs = 300 } = {}) {
        this.agent = agent;
        this.executing = false;
        this.currentActionLabel = '';
        this.currentActionFn = null;
        this.timedout = false;
        this.resume_func = null;
        this.resume_name = '';
        this.last_action_time = 0;
        this.recent_action_counter = 0;
        // Incremented for every action attempt. An action that has been
        // abandoned is no longer allowed to mutate manager state.
        this.actionGeneration = 0;
        this.activeGeneration = 0;
        this.currentTimeoutHandle = null;
        // Set when a stuck action cannot be restarted. No new action may run
        // while the old one is still alive.
        this.stuck = false;
        this.stopTimeoutMs = stopTimeoutMs;
        this.stopPollMs = stopPollMs;
    }

    resumeAction(actionFn, timeout) {
        return this._executeResume(actionFn, timeout);
    }

    runAction(actionLabel, actionFn, { timeout, resume = false } = {}) {
        if (resume) {
            return this._executeResume(actionLabel, actionFn, timeout);
        } else {
            return this._executeAction(actionLabel, actionFn, timeout);
        }
    }

    async stop() {
        if (!this.executing) return;
        const started = Date.now();
        const stopGeneration = this.activeGeneration;
        const timeout = setTimeout(() => {
            console.warn('Code execution refused stop after 10 seconds. Cancelling pathfinding, mining, and collection...');
            try { this.agent.bot.pathfinder?.stop(); } catch (_) { /* best effort */ }
            try { this.agent.bot.collectBlock?.cancelTask?.(); } catch (_) { /* best effort */ }
            try { this.agent.bot.stopDigging(); } catch (_) { /* best effort */ }
            this.agent.requestInterrupt();
        }, 10000);
        while (this.executing && this.activeGeneration === stopGeneration) {
            this.agent.requestInterrupt();
            console.log('waiting for code to finish executing...');
            await new Promise(resolve => setTimeout(resolve, this.stopPollMs));
            // Re-check: the action may have finished during the sleep.
            if (Date.now() - started > this.stopTimeoutMs && this.executing && this.activeGeneration === stopGeneration) {
                // An action that ignores interrupts for the full grace period
                // cannot be cancelled safely: letting the agent continue would
                // overlap it with the next action. Restart the process instead.
                console.error(`Code execution did not stop after ${this.stopTimeoutMs / 1000} seconds; restarting the agent.`);
                this._forceStopStuckAction();
                break;
            }
        }
        clearTimeout(timeout);
    }

    _abandonAction() {
        // Invalidate the running action so its eventual completion cannot
        // clear the state of the action that replaces it.
        this.actionGeneration++;
        this.activeGeneration = 0;
        this.executing = false;
        this.currentActionLabel = '';
        this.currentActionFn = null;
        clearTimeout(this.currentTimeoutHandle);
        this.currentTimeoutHandle = null;
    }

    _forceStopStuckAction() {
        // Invalidate the old action, then re-take the lock. The lock is only
        // released by the process exiting and the agent being started again
        // with a fresh ActionManager.
        this._abandonAction();
        this.stuck = true;
        this.executing = true;
        this.currentActionLabel = 'stuck action (restarting)';

        try {
            // cleanKill saves history and exits; AgentProcess restarts it.
            this.agent.cleanKill(`Code execution did not stop after ${this.stopTimeoutMs / 1000} seconds; restarting agent.`);
        } catch (err) {
            // cleanKill calls bot.chat() before process.exit(), which can throw
            // on a disconnected bot. Do not return to the action loop with an
            // abandoned action still alive.
            console.error('Failed to restart the stuck agent cleanly:', err);
            try {
                this._hardExit();
            } catch (exitErr) {
                console.error('Hard exit failed; refusing new actions until the agent is restarted manually.', exitErr);
            }
        }
    }

    _hardExit() {
        process.exit(1);
    }

    cancelResume() {
        this.resume_func = null;
        this.resume_name = null;
    }

    async _executeResume(actionLabel = null, actionFn = null, timeout = 10) {
        const new_resume = actionFn != null;
        if (new_resume) { // start new resume
            this.resume_func = actionFn;
            assert(actionLabel != null, 'actionLabel is required for new resume');
            this.resume_name = actionLabel;
        }
        if (this.resume_func != null && (this.agent.isIdle() || new_resume) && (!this.agent.self_prompter.isActive() || new_resume)) {
            // _executeAction owns the label state; clearing it here could wipe
            // the label of a newer action if this one was abandoned.
            return await this._executeAction(this.resume_name, this.resume_func, timeout);
        } else {
            return { success: false, message: null, interrupted: false, timedout: false };
        }
    }

    async _executeAction(actionLabel, actionFn, timeout = 10) {
        if (this.stuck) {
            return { success: false, message: 'Agent is stuck and must restart; action not started.', interrupted: true, timedout: false };
        }
        let TIMEOUT;
        let generation = null;
        try {
            if (this.last_action_time > 0) {
                let time_diff = Date.now() - this.last_action_time;
                if (time_diff < 20) {
                    this.recent_action_counter++;
                }
                else {
                    this.recent_action_counter = 0;
                }
                if (this.recent_action_counter > 3) {
                    console.warn('Fast action loop detected, cancelling resume.');
                    this.cancelResume(); // likely cause of repetition
                }
                if (this.recent_action_counter > 5) {
                    console.error('Infinite action loop detected, shutting down.');
                    this.agent.cleanKill('Infinite action loop detected, shutting down.');
                    return { success: false, message: 'Infinite action loop detected, shutting down.', interrupted: false, timedout: false };
                }
            }
            this.last_action_time = Date.now();
            console.log('executing code...\n');

            // await current action to finish (executing=false), with 10 seconds timeout
            // also tell agent.bot to stop various actions
            if (this.executing) {
                console.log(`action "${actionLabel}" trying to interrupt current action "${this.currentActionLabel}"`);
            }
            await this.stop();
            if (this.stuck) {
                // stop() could not restart the agent; do not start a second
                // action on top of the one that is still alive.
                return { success: false, message: 'Agent is stuck and must restart; action not started.', interrupted: true, timedout: false };
            }

            // clear bot logs and reset interrupt code
            this.agent.clearBotLogs();

            this.timedout = false;
            generation = ++this.actionGeneration;
            this.activeGeneration = generation;
            this.executing = true;
            this.currentActionLabel = actionLabel;
            this.currentActionFn = actionFn;

            // timeout in minutes
            if (timeout > 0) {
                TIMEOUT = this._startTimeout(timeout);
                this.currentTimeoutHandle = TIMEOUT;
            }

            // start the action
            await actionFn();

            // stop() may have abandoned this action while it was stuck. Do not
            // clear the state of whatever action is running now.
            if (this.activeGeneration !== generation) {
                clearTimeout(TIMEOUT);
                return { success: false, message: '', interrupted: true, timedout: false };
            }

            // mark action as finished + cleanup
            this.executing = false;
            this.currentActionLabel = '';
            this.currentActionFn = null;
            this.currentTimeoutHandle = null;
            clearTimeout(TIMEOUT);

            // get bot activity summary
            let output = this.getBotOutputSummary();
            let interrupted = this.agent.bot.interrupt_code;
            let timedout = this.timedout;
            this.agent.clearBotLogs();

            // if not interrupted and not generating, emit idle event
            if (!interrupted) {
                this.agent.bot.emit('idle');
            }

            // return action status report
            return { success: true, message: output, interrupted, timedout };
        } catch (err) {
            // An abandoned action must not touch the manager or bot logs; the
            // action that replaced it owns them now.
            const isCurrent = generation === null || this.activeGeneration === generation;
            if (isCurrent) {
                this.executing = false;
                this.currentActionLabel = '';
                this.currentActionFn = null;
                this.currentTimeoutHandle = null;
                this.cancelResume();
            }
            clearTimeout(TIMEOUT);
            console.error("Code execution triggered catch:", err);
            // Log the full stack trace
            const stack = err?.stack;
            console.error(stack);
            if (isCurrent) {
                await this.stop();
            } else {
                return { success: false, message: 'Action failed after it was abandoned.', interrupted: true, timedout: false };
            }
            const errString = err?.toString?.() ?? String(err);

            let message = this.getBotOutputSummary() +
                '!!Code threw exception!!\n' +
                'Error: ' + errString + '\n' +
                'Stack trace:\n' + stack+'\n';

            let interrupted = this.agent.bot.interrupt_code;
            this.agent.clearBotLogs();
            if (!interrupted) {
                this.agent.bot.emit('idle');
            }
            return { success: false, message, interrupted, timedout: false };
        }
    }

    getBotOutputSummary() {
        const { bot } = this.agent;
        if (bot.interrupt_code && !this.timedout) return '';
        let output = bot.output;
        const MAX_OUT = 500;
        if (output.length > MAX_OUT) {
            output = `Action output is very long (${output.length} chars) and has been shortened.\n
          First outputs:\n${output.substring(0, MAX_OUT / 2)}\n...skipping many lines.\nFinal outputs:\n ${output.substring(output.length - MAX_OUT / 2)}`;
        }
        else {
            output = 'Action output:\n' + output.toString();
        }
        bot.output = '';
        return output;
    }

    _startTimeout(TIMEOUT_MINS = 10) {
        return setTimeout(async () => {
            console.warn(`Code execution timed out after ${TIMEOUT_MINS} minutes. Attempting force stop.`);
            this.timedout = true;
            this.agent.history.add('system', `Code execution timed out after ${TIMEOUT_MINS} minutes. Attempting force stop.`);
            await this.stop(); // last attempt to stop
        }, TIMEOUT_MINS * 60 * 1000);
    }

}
