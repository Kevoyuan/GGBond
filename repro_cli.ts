import { spawn } from 'child_process';
import { getGeminiPath, getGeminiEnv } from './lib/gemini-utils';

async function run() {
    const geminiPath = getGeminiPath();
    const env = getGeminiEnv();

    console.log('Gemini Path:', geminiPath);

    // Try to run a command that requires approval (git status usually does in restricted mode)
    // We use a prompt that forces a tool call
    const args = [geminiPath, '-p', 'Check git status', '--output-format', 'stream-json'];

    console.log('Spawning:', args.join(' '));

    const child = spawn(process.execPath, args, { env });

    child.stdout.on('data', (d) => console.log('STDOUT:', d.toString()));
    child.stderr.on('data', (d) => console.log('STDERR:', d.toString()));

    child.on('close', (code) => console.log('Closed with', code));

    // Kill after 10s if it hangs
    setTimeout(() => {
        console.log('Timeout, killing...');
        child.kill();
    }, 10000);
}

run();
