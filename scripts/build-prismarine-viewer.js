import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viewerRoot = path.join(projectRoot, 'node_modules', 'prismarine-viewer');
const webpackCli = path.join(projectRoot, 'node_modules', 'webpack-cli', 'bin', 'cli.js');
const webpackConfig = path.join(projectRoot, 'scripts', 'prismarine-viewer.webpack.config.cjs');

const steps = [
    {
        name: 'Generate Prismarine Viewer textures and block states',
        args: [path.join(viewerRoot, 'viewer', 'prerender.js')],
    },
    {
        name: 'Build Prismarine Viewer browser bundles',
        args: [webpackCli, '--config', webpackConfig],
    },
];

for (const step of steps) {
    console.log(`[ViewerBuild] ${step.name}`);
    const result = spawnSync(process.execPath, step.args, {
        cwd: viewerRoot,
        env: process.env,
        stdio: 'inherit',
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
