import { spawn } from 'child_process';
import { logoutAgent } from '../mindcraft/mindserver.js';
import { TRANSIENT_AGENT_EXIT_CODE } from './exit_codes.js';

export class AgentProcess {
    constructor(name, port) {
        this.name = name;
        this.port = port;
        this.restartAttempts = 0;
        this.restartTimer = null;
        this.stopping = false;
    }

    start(load_memory=false, init_message=null, count_id=0, preserveRestartAttempts=false) {
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }
        if (!preserveRestartAttempts) this.restartAttempts = 0;
        this.stopping = false;
        this.count_id = count_id;
        this.running = true;
        const startedAt = Date.now();

        let args = ['src/process/init_agent.js', this.name];
        args.push('-n', this.name);
        args.push('-c', count_id);
        if (load_memory)
            args.push('-l', load_memory);
        if (init_message)
            args.push('-m', init_message);
        args.push('-p', this.port);

        const agentProcess = spawn('node', args, {
            stdio: 'inherit',
            stderr: 'inherit',
        });
        
        agentProcess.on('exit', (code, signal) => {
            console.log(`Agent process exited with code ${code} and signal ${signal}`);
            if (this.process === agentProcess) {
                this.running = false;
                this.process = null;
            }
            logoutAgent(this.name);

            if (code === TRANSIENT_AGENT_EXIT_CODE && signal !== 'SIGINT' && !this.stopping) {
                if (Date.now() - startedAt >= 60000) this.restartAttempts = 0;
                const delay = Math.min(60000, 5000 * (2 ** this.restartAttempts));
                this.restartAttempts = Math.min(this.restartAttempts + 1, 5);
                console.warn(`Agent ${this.name} disconnected temporarily; retrying in ${Math.ceil(delay / 1000)} seconds (attempt ${this.restartAttempts}).`);
                this.restartTimer = setTimeout(() => {
                    this.restartTimer = null;
                    if (!this.stopping) this.start(true, null, count_id, true);
                }, delay);
                return;
            }
            
            if (code > 1) {
                console.log(`Ending task`);
                process.exit(code);
            }

            if (code !== 0 && signal !== 'SIGINT' && !this.stopping) {
                // Keep the existing crash-loop guard for non-connection failures.
                if (Date.now() - startedAt < 10000) {
                    console.error(`Agent process exited too quickly and will not be restarted.`);
                    return;
                }
                console.log('Restarting agent...');
                // Do NOT pass restart messages as init_message — they are internal
                // system events, not user prompts. Passing them to the LLM causes
                // corrupted history and 500 errors on NVIDIA upstreams.
                this.start(true, null, count_id);
            }
        });
    
        agentProcess.on('error', (err) => {
            console.error('Agent process error:', err);
        });

        this.process = agentProcess;
    }

    stop() {
        this.stopping = true;
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }
        if (!this.running) return;
        this.process.kill('SIGINT');
    }

    forceRestart() {
        if (this.running && this.process && !this.process.killed) {
            console.log(`Agent process for ${this.name} is still running. Attempting to force restart.`);
            
            const restartTimeout = setTimeout(() => {
                console.warn(`Agent ${this.name} did not stop in time. It might be stuck.`);
            }, 5000); // 5 seconds to exit

            this.process.once('exit', () => {
                 clearTimeout(restartTimeout);
                 console.log(`Stopped hanging agent ${this.name}. Now restarting.`);
                 this.start(true, null, this.count_id);
            });
            this.stop(); // sends SIGINT
        } else {
             this.start(true, null, this.count_id);
        }
    }
}
