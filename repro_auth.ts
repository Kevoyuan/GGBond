
import { spawn } from 'child_process';
import path from 'path';

const GEMINI_PATH = 'gemini'; // Assuming in PATH, or adjust as needed
const PROMPT = 'Check git status';

// Mock TTY environment variables
const env = {
    ...process.env,
    // FORCE_COLOR: '1', // Sometimes helps
    // CI: 'false',
};

console.log(`Running: ${GEMINI_PATH} -p "${PROMPT}" --output-format stream-json`);

const child = spawn(GEMINI_PATH, ['-p', PROMPT, '--output-format', 'stream-json'], {
    env,
    // stdio: 'inherit' // Uncomment to see raw output if json parsing fails
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (d) => {
    const s = d.toString();
    stdout += s;
    console.log('[STDOUT]', s);
});

child.stderr.on('data', (d) => {
    const s = d.toString();
    stderr += s;
    console.log('[STDERR]', s);
});

child.on('close', (code) => {
    console.log(`Exited with code ${code}`);
    if (stdout.includes('Tool "run_shell_command" not found')) {
        console.log('repro_success: Tool was disabled/not found.');
    } else if (stdout.includes('Action Required')) {
        console.log('repro_success: Prompt detected!');
    } else {
        console.log('repro_inconclusive: Output did not match expected patterns.');
    }
});
