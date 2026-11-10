import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nbt from 'prismarine-nbt';
import { Vec3 } from 'vec3';
import * as skills from '../library/skills.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../..');
const SCHEMATICS_DIR = path.join(ROOT_DIR, 'schematics');
const MAX_VOLUME = 100_000;
const MAX_DIMENSION = 128;
const CONTAINERS = new Set(['chest', 'trapped_chest', 'barrel']);

function parseNbt(buffer) {
    return new Promise((resolve, reject) => {
        nbt.parse(buffer, (error, parsed) => {
            if (error) reject(error);
            else resolve(nbt.simplify(parsed));
        });
    });
}

function readVarInt(data, cursor) {
    let value = 0;
    let shift = 0;
    while (cursor.offset < data.length && shift <= 28) {
        const byte = data[cursor.offset++];
        value |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) return value >>> 0;
        shift += 7;
    }
    throw new Error('Schematic block data contains an invalid or truncated varint.');
}

function parseBlockName(paletteEntry) {
    if (typeof paletteEntry !== 'string') throw new Error('Schematic palette contains a non-text block state.');
    const match = /^(?:minecraft:)?([a-z0-9_]+)(?:\[.*\])?$/.exec(paletteEntry);
    if (!match) throw new Error(`Unsupported block namespace or state: ${paletteEntry.slice(0, 100)}`);
    return match[1];
}

export async function parseSpongeSchematic(buffer) {
    const root = await parseNbt(buffer);
    const schematic = root?.Schematic || root;
    const width = Number(schematic?.Width);
    const height = Number(schematic?.Height);
    const length = Number(schematic?.Length);
    const volume = width * height * length;
    if (![width, height, length].every(Number.isInteger) || width < 1 || height < 1 || length < 1 ||
        width > MAX_DIMENSION || height > MAX_DIMENSION || length > MAX_DIMENSION || volume > MAX_VOLUME) {
        throw new Error(`Invalid or oversized schematic dimensions (${width}×${height}×${length}); maximum volume is ${MAX_VOLUME} blocks.`);
    }

    const blocks = schematic.Blocks || schematic;
    const palette = blocks.Palette || schematic.Palette;
    const rawData = blocks.Data || schematic.BlockData || schematic.BlocksData;
    if (!palette || typeof palette !== 'object' || !rawData || typeof rawData.length !== 'number') {
        throw new Error('This file is not a supported Sponge .schem file (palette or block data is missing).');
    }

    const paletteByIndex = [];
    for (const [state, indexValue] of Object.entries(palette)) {
        const index = Number(indexValue);
        if (!Number.isInteger(index) || index < 0 || index >= volume || paletteByIndex[index] !== undefined) {
            throw new Error('Schematic palette has an invalid or duplicate index.');
        }
        paletteByIndex[index] = { name: parseBlockName(state), state };
    }
    if (!paletteByIndex.length) throw new Error('Schematic palette is empty.');

    const data = Buffer.from(rawData);
    const cursor = { offset: 0 };
    const plan = [];
    const materials = {};
    const airNames = new Set(['air', 'cave_air', 'void_air', 'structure_void']);

    // Sponge stores blocks with X changing fastest, then Z, then Y.
    for (let y = 0; y < height; y++) {
        for (let z = 0; z < length; z++) {
            for (let x = 0; x < width; x++) {
                const paletteIndex = readVarInt(data, cursor);
                const entry = paletteByIndex[paletteIndex];
                if (!entry) throw new Error(`Block data references missing palette index ${paletteIndex}.`);
                if (airNames.has(entry.name)) continue;
                plan.push({ x, y, z, name: entry.name, state: entry.state });
                for (const itemName of itemsForBlock(entry.name)) {
                    materials[itemName] = itemName === 'any_hoe' ? 1 : (materials[itemName] || 0) + 1;
                }
            }
        }
    }

    if (cursor.offset !== data.length) {
        throw new Error(`Schematic block data length does not match its dimensions (${cursor.offset}/${data.length} bytes consumed).`);
    }
    if (!plan.length) throw new Error('Schematic contains no placeable blocks.');

    return {
        version: Number(schematic.Version) || null,
        dataVersion: Number(schematic.DataVersion) || null,
        size: { x: width, y: height, z: length },
        blockCount: plan.length,
        materials,
        plan
    };
}

function itemCount(bot, itemName) {
    return bot.inventory.items()
        .filter(item => matchesItemName(item.name, itemName))
        .reduce((total, item) => total + item.count, 0);
}

function matchesItemName(actualName, expectedName) {
    return expectedName === 'any_hoe'
        ? /^(wooden|stone|iron|golden|diamond|netherite)_hoe$/.test(actualName)
        : actualName === expectedName;
}

function itemForBlock(blockName) {
    if (blockName === 'redstone_wire') return 'redstone';
    if (blockName === 'water') return 'water_bucket';
    if (blockName === 'lava') return 'lava_bucket';
    if (blockName === 'farmland') return 'dirt';
    if (blockName === 'wheat') return 'wheat_seeds';
    if (blockName === 'beetroots') return 'beetroot_seeds';
    if (blockName === 'carrots') return 'carrot';
    if (blockName === 'potatoes') return 'potato';
    if (blockName === 'wall_torch') return 'torch';
    if (blockName === 'wall_redstone_torch') return 'redstone_torch';
    if (blockName === 'flowering_azalea_bush') return 'flowering_azalea';
    if (blockName.endsWith('_wall_sign')) return blockName.replace('_wall_sign', '_sign');
    if (blockName.endsWith('_wall_hanging_sign')) return blockName.replace('_wall_hanging_sign', '_hanging_sign');
    if (blockName.endsWith('_wall_banner')) return blockName.replace('_wall_banner', '_banner');
    return blockName;
}

function itemsForBlock(blockName) {
    const pottedPlant = /^potted_(.+)$/.exec(blockName);
    if (pottedPlant) return ['flower_pot', itemForBlock(pottedPlant[1])];
    if (blockName === 'farmland') return ['dirt', 'any_hoe'];
    return [itemForBlock(blockName)];
}

function usesSidePlacement(blockName) {
    return blockName.startsWith('wall_') || blockName.includes('_wall_sign') ||
        blockName.includes('_wall_hanging_sign') || blockName.includes('_wall_banner');
}

function isTillableSoil(blockName) {
    return blockName === 'dirt' || blockName === 'grass_block';
}

function validateRegistry(parsed, registry) {
    if (!registry?.blocksByName || !registry?.itemsByName) return;
    const blockNames = new Set(parsed.plan.map(block => block.name));
    const unknownBlocks = [...blockNames].filter(name => !registry.blocksByName[name]);
    const itemNames = Object.keys(parsed.materials);
    const unknownItems = itemNames.filter(name => name === 'any_hoe'
        ? !Object.keys(registry.itemsByName).some(item => /^(wooden|stone|iron|golden|diamond|netherite)_hoe$/.test(item))
        : !registry.itemsByName[name]);
    if (unknownBlocks.length || unknownItems.length) {
        const details = [
            unknownBlocks.length ? `blocks: ${unknownBlocks.slice(0, 8).join(', ')}` : '',
            unknownItems.length ? `items: ${unknownItems.slice(0, 8).join(', ')}` : ''
        ].filter(Boolean).join('; ');
        throw new Error(`This schematic contains blocks or items unavailable on the connected Minecraft version (${details}).`);
    }
}

export class SchematicBuilder {
    constructor(agent, manager) {
        this.agent = agent;
        this.bot = agent.bot;
        this.manager = manager;
        this.agentName = (agent.name || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
        this.stateFile = path.join(ROOT_DIR, `schematic_jobs_${this.agentName}.json`);
        this.state = { current: null, history: [] };
        this.execution = null;
        this.stopRequested = false;
        this.stopKind = 'pause';
    }

    load() {
        try {
            const saved = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            if (saved && typeof saved === 'object') {
                this.state = {
                    current: saved.current && typeof saved.current === 'object' ? saved.current : null,
                    history: Array.isArray(saved.history) ? saved.history.slice(0, 10) : []
                };
            }
        } catch (_) {}
        if (this.state.current && ['running', 'pausing'].includes(this.state.current.status)) {
            this.state.current.status = 'paused';
            this.state.current.message = 'Paused after agent restart. Resume to continue from the saved block.';
            this.state.current.updatedAt = Date.now();
            this.persist();
        }
    }

    persist() {
        try {
            const temporary = `${this.stateFile}.tmp-${process.pid}`;
            fs.writeFileSync(temporary, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
            fs.renameSync(temporary, this.stateFile);
        } catch (error) {
            console.warn(`[SchematicBuilder:${this.agentName}] Could not persist job: ${error.message}`);
        }
        this.manager.writeLiveTelemetry();
    }

    async start(params = {}) {
        const existing = this.state.current;
        if (existing && ['queued', 'running', 'pausing', 'paused', 'blocked'].includes(existing.status)) {
            return { success: false, error: 'A schematic build is already active. Pause, resume, or cancel it first.' };
        }
        const jobId = String(params.jobId || '');
        const fileName = String(params.fileName || '');
        if (!/^schem-[a-zA-Z0-9_-]{1,80}\.schem$/.test(fileName) || path.basename(fileName) !== fileName) {
            return { success: false, error: 'Invalid schematic file reference.' };
        }
        const schematicPath = path.join(SCHEMATICS_DIR, fileName);
        if (!fs.existsSync(schematicPath)) return { success: false, error: 'Uploaded schematic file was not found.' };

        const origin = {};
        for (const axis of ['x', 'y', 'z']) {
            const value = params[axis];
            origin[axis] = value === null || value === undefined || value === ''
                ? null
                : Number(value);
            if (origin[axis] !== null && (!Number.isInteger(origin[axis]) || Math.abs(origin[axis]) > 29_999_984)) {
                return { success: false, error: `Invalid ${axis.toUpperCase()} coordinate.` };
            }
        }
        const job = {
            id: jobId || `schem-${Date.now()}`,
            fileName,
            sourceName: String(params.sourceName || 'uploaded schematic').slice(0, 100),
            origin,
            replaceBlocks: params.replaceBlocks === true,
            status: 'queued',
            totalBlocks: 0,
            nextIndex: 0,
            placed: 0,
            skipped: 0,
            size: null,
            materials: {},
            missing: [],
            message: 'Validating the schematic before building.',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.state.current = job;
        this.stopRequested = false;
        this.persist();

        try {
            const parsed = await parseSpongeSchematic(fs.readFileSync(schematicPath));
            validateRegistry(parsed, this.bot?.registry);
            job.size = parsed.size;
            job.totalBlocks = parsed.blockCount;
            job.materials = parsed.materials;
            job.dataVersion = parsed.dataVersion;
            job.message = `Validated ${job.totalBlocks.toLocaleString()} blocks. Building will use inventory and nearby chests.`;
            job.updatedAt = Date.now();
            this.persist();
            return { success: true, jobId: job.id, size: job.size, totalBlocks: job.totalBlocks };
        } catch (error) {
            job.status = 'failed';
            job.message = error?.message || String(error);
            job.updatedAt = Date.now();
            this.persist();
            return { success: false, error: job.message };
        }
    }

    tick() {
        const job = this.state.current;
        if (this.execution || !job || job.status !== 'queued') return;
        if (!this.agent?.isIdle?.() || !this.bot?.entity || this.bot.currentWindow || this.bot.pathfinder?.isMoving?.()) return;
        if (this.manager._grindExecutionPromise) return;
        this.stopRequested = false;
        this.execution = this.run(job).catch(error => {
            job.status = 'blocked';
            job.message = error?.message || String(error);
            job.updatedAt = Date.now();
            this.persist();
        }).finally(() => {
            this.execution = null;
            this.persist();
        });
    }

    async run(job) {
        const schematicPath = path.join(SCHEMATICS_DIR, job.fileName);
        const parsed = await parseSpongeSchematic(fs.readFileSync(schematicPath));
        const origin = {
            x: job.origin.x ?? Math.floor(this.bot.entity.position.x) + 2,
            y: job.origin.y ?? Math.floor(this.bot.entity.position.y),
            z: job.origin.z ?? Math.floor(this.bot.entity.position.z) + 2
        };
        job.origin = origin;
        job.size = parsed.size;
        job.totalBlocks = parsed.blockCount;
        job.materials = parsed.materials;
        job.status = 'running';
        job.startedAt ||= Date.now();
        job.updatedAt = Date.now();
        job.message = `Building from ${origin.x}, ${origin.y}, ${origin.z}.`;
        this.persist();

        const result = await this.agent.actions.runAction(`Schematic build: ${job.sourceName}`, async () => {
            for (let index = job.nextIndex; index < parsed.plan.length; index++) {
                if (this.stopRequested || this.bot.interrupt_code) break;
                const block = parsed.plan[index];
                const position = new Vec3(origin.x + block.x, origin.y + block.y, origin.z + block.z);
                let current = this.bot.blockAt(position);
                if (!current) {
                    await skills.goToPosition(this.bot, position.x, position.y, position.z, 4);
                    current = this.bot.blockAt(position);
                }
                if (!current) {
                    this.blockJob(job, `World data is not loaded at ${position}. Move closer and resume.`);
                    break;
                }
                if (current.name === block.name) {
                    job.skipped++;
                    job.nextIndex = index + 1;
                    this.updateProgress(job, index);
                    continue;
                }
                const pottedPlant = /^potted_(.+)$/.exec(block.name);
                const existingPot = Boolean(pottedPlant && current.name === 'flower_pot');
                const tillableSoil = block.name === 'farmland' && isTillableSoil(current.name);
                if (current.name !== 'air' && !existingPot && !tillableSoil && !job.replaceBlocks) {
                    this.blockJob(job, `There is already a ${current.name} at ${position}. Enable “Replace mismatching blocks” or clear it, then resume.`);
                    break;
                }

                let missingItem = false;
                const requiredItems = pottedPlant && existingPot
                    ? [itemForBlock(pottedPlant[1])]
                    : tillableSoil ? ['any_hoe'] : itemsForBlock(block.name);
                for (const itemName of requiredItems) {
                    if (itemCount(this.bot, itemName) < 1) {
                        const withdrawn = await this.withdrawFromNearbyContainers(itemName);
                        if (withdrawn?.busy) {
                            this.blockJob(job, 'Inventory is busy or a container is open. Close it, then resume the build.');
                            missingItem = true;
                            break;
                        }
                        if (itemCount(this.bot, itemName) < 1) {
                            const remaining = itemName === 'any_hoe'
                                ? 1
                                : parsed.plan.slice(index).filter(entry => itemsForBlock(entry.name).includes(itemName)).length;
                            const displayItem = itemName.replaceAll('_', ' ');
                            this.blockJob(job, `Out of ${displayItem}. Add ${remaining} remaining item(s) to ENI1 or a nearby chest, then resume.`, [{
                                item: itemName,
                                needed: remaining,
                                inInventory: itemCount(this.bot, itemName),
                                inNearbyChests: withdrawn?.available || 0
                            }]);
                            missingItem = true;
                            break;
                        }
                    }
                }
                if (missingItem) {
                    break;
                }

                if (current.name !== 'air' && !existingPot && !tillableSoil) {
                    const removed = await skills.breakBlockAt(this.bot, position.x, position.y, position.z);
                    if (!removed) {
                        this.blockJob(job, `Could not clear ${current.name} at ${position}.`);
                        break;
                    }
                }

                if (block.name === 'farmland') {
                    let soil = this.bot.blockAt(position);
                    if (soil?.name === 'air') {
                        const dirtPlaced = await skills.placeBlock(this.bot, 'dirt', position.x, position.y, position.z);
                        if (!dirtPlaced) {
                            this.blockJob(job, `Could not place the soil needed for farmland at ${position}.`);
                            break;
                        }
                        soil = this.bot.blockAt(position);
                    }
                    if (!soil || !isTillableSoil(soil.name)) {
                        this.blockJob(job, `Farmland needs dirt or grass at ${position}; found ${soil?.name || 'unknown'}.`);
                        break;
                    }
                    if (this.bot.entity.position.distanceTo(position) > 4.5) {
                        await skills.goToPosition(this.bot, position.x, position.y, position.z, 3);
                    }
                    const hoe = this.bot.inventory.items().find(item => matchesItemName(item.name, 'any_hoe'));
                    if (!hoe) {
                        this.blockJob(job, `A hoe is missing for farmland at ${position}. Add any hoe to ENI1 and resume.`);
                        break;
                    }
                    await this.bot.equip(hoe, 'hand');
                    await this.bot.activateBlock(soil);
                } else if (pottedPlant) {
                    if (!existingPot) {
                        const potPlaced = await skills.placeBlock(this.bot, 'flower_pot', position.x, position.y, position.z);
                        if (!potPlaced) {
                            this.blockJob(job, `Could not place a flower pot at ${position}. Check access and placement support, then resume.`);
                            break;
                        }
                    }
                    const plantItemName = itemForBlock(pottedPlant[1]);
                    const plantItem = this.bot.inventory.findInventoryItem(plantItemName);
                    if (!plantItem) {
                        this.blockJob(job, `The flower pot is ready at ${position}, but ${plantItemName} is missing. Add it to ENI1 and resume.`);
                        break;
                    }
                    await this.bot.equip(plantItem, 'hand');
                    const potBlock = this.bot.blockAt(position);
                    if (!potBlock || potBlock.name !== 'flower_pot') {
                        this.blockJob(job, `The flower pot could not be confirmed at ${position}; build paused for inspection.`);
                        break;
                    }
                    await this.bot.activateBlock(potBlock);
                } else {
                    const placementItem = usesSidePlacement(block.name) ? itemForBlock(block.name) : block.name;
                    const placeOn = usesSidePlacement(block.name) ? 'side' : 'bottom';
                    const placed = await skills.placeBlock(this.bot, placementItem, position.x, position.y, position.z, placeOn);
                    if (!placed) {
                        this.blockJob(job, `Could not place ${block.name} at ${position}. Check access and placement support, then resume.`);
                        break;
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 250));
                const after = this.bot.blockAt(position);
                if (after?.name !== block.name) {
                    this.blockJob(job, `The server did not confirm ${block.name} at ${position}; build paused for inspection.`);
                    break;
                }
                job.placed++;
                job.nextIndex = index + 1;
                this.updateProgress(job, index);
            }
        }, { timeout: 180 });

        job.updatedAt = Date.now();
        if (job.nextIndex >= parsed.plan.length) {
            job.status = 'completed';
            job.finishedAt = Date.now();
            job.message = `Completed: placed ${job.placed.toLocaleString()} blocks and skipped ${job.skipped.toLocaleString()} already-correct blocks.`;
            this.state.history.unshift({ ...job });
            this.state.history = this.state.history.slice(0, 10);
        } else if (job.status === 'pausing' || this.stopRequested || result?.interrupted) {
            job.status = this.stopKind === 'cancel' ? 'cancelled' : 'paused';
            job.message = job.status === 'cancelled' ? 'Build cancelled; progress is saved.' : 'Build paused; progress is saved.';
            if (job.status === 'cancelled') job.finishedAt = Date.now();
        } else if (job.status === 'running') {
            job.status = 'blocked';
            job.message = result?.success === false ? 'Build action stopped. Resume to continue.' : job.message;
        }
        this.persist();
    }

    updateProgress(job, index) {
        job.updatedAt = Date.now();
        if (index % 8 === 0 || index === job.totalBlocks - 1) {
            job.message = `Processed ${job.nextIndex.toLocaleString()} of ${job.totalBlocks.toLocaleString()} blocks.`;
            this.persist();
        }
    }

    blockJob(job, message, missing = []) {
        job.status = 'blocked';
        job.message = message;
        job.missing = missing;
        job.updatedAt = Date.now();
        this.persist();
    }

    async withdrawFromNearbyContainers(itemName) {
        if (this.bot.currentWindow || this.manager._inventoryLocked) return { available: 0, busy: true };
        let available = 0;
        let withdrawn = false;
        const operation = async () => {
            const positions = this.bot.findBlocks({
                matching: block => CONTAINERS.has(block.name),
                maxDistance: 32,
                count: 32
            }).sort((a, b) => this.bot.entity.position.distanceTo(a) - this.bot.entity.position.distanceTo(b));
            for (const position of positions) {
                if (this.stopRequested) break;
                const chest = this.bot.blockAt(position);
                if (!chest) continue;
                try {
                    await skills.goToPosition(this.bot, position.x, position.y, position.z, 2);
                    const container = await this.bot.openContainer(chest);
                    try {
                        const matches = container.containerItems().filter(item => matchesItemName(item.name, itemName));
                        available += matches.reduce((sum, item) => sum + item.count, 0);
                        let remaining = Math.max(1, 32 - itemCount(this.bot, itemName));
                        for (const item of matches) {
                            if (remaining <= 0) break;
                            const count = Math.min(remaining, item.count);
                            await container.withdraw(item.type, item.metadata, count);
                            remaining -= count;
                            withdrawn = true;
                        }
                    } finally {
                        await container.close();
                    }
                } catch (error) {
                    console.warn(`[SchematicBuilder:${this.agentName}] Chest access failed: ${error.message}`);
                }
                if (itemCount(this.bot, itemName) > 0) break;
            }
        };
        const acquired = await this.manager.withInventoryLock(operation);
        if (acquired === false) return { available: 0, busy: true };
        return { available, withdrawn };
    }

    pause() {
        const job = this.state.current;
        if (!job || !['queued', 'running', 'blocked'].includes(job.status)) return false;
        this.stopKind = 'pause';
        this.stopRequested = true;
        if (job.status === 'queued' || job.status === 'blocked') {
            job.status = 'paused';
            job.message = 'Build paused; progress is saved.';
        } else {
            job.status = 'pausing';
            job.message = 'Pausing after the current block.';
        }
        job.updatedAt = Date.now();
        this.persist();
        return true;
    }

    resume(params = {}) {
        const job = this.state.current;
        if (!job || !['paused', 'blocked'].includes(job.status)) return false;
        if (typeof params.replaceBlocks === 'boolean') job.replaceBlocks = params.replaceBlocks;
        this.stopRequested = false;
        job.status = 'queued';
        job.missing = [];
        job.message = 'Resuming from the saved block.';
        job.updatedAt = Date.now();
        this.persist();
        return true;
    }

    cancel() {
        const job = this.state.current;
        if (!job || ['completed', 'cancelled', 'failed'].includes(job.status)) return false;
        this.stopKind = 'cancel';
        this.stopRequested = true;
        if (job.status === 'queued' || job.status === 'blocked' || job.status === 'paused') {
            job.status = 'cancelled';
            job.finishedAt = Date.now();
            job.message = 'Build cancelled; progress is saved.';
            this.state.history.unshift({ ...job });
            this.state.history = this.state.history.slice(0, 10);
        } else {
            job.status = 'pausing';
            job.message = 'Cancelling after the current block.';
        }
        job.updatedAt = Date.now();
        this.persist();
        return true;
    }

    stop() {
        if (this.execution) this.pause();
    }
}
