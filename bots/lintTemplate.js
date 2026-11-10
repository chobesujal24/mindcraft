import * as skills from '../../../src/agent/library/skills.js';
import * as world from '../../../src/agent/library/world.js';
import Vec3 from 'vec3';

const log = skills.log;

// This wrapper must stay async so generated skill calls can use await.
export async function main(bot) {
    // Keep require-await satisfied even when the generated action only makes
    // synchronous queries. This is lint-only scaffolding; runtime code uses
    // execTemplate.js and does not incur this extra microtask.
    await Promise.resolve();
    /* CODE HERE */
    log(bot, 'Code finished.');
}
