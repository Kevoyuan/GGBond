
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function getGeminiPath() {
    try {
        return execSync('which gemini').toString().trim();
    } catch (e) {
        console.error('gemini not found in PATH');
        process.exit(1);
    }
}

const GEMINI_PATH = getGeminiPath();
const TEST_HOME = '/tmp/ggbond-home';
// const TEST_HOME = path.join(__dirname, '.repro_home'); 
// Using actual GUI home to test auth state

const PROMPT = 'Check git status';

console.log(`Using gemini at: ${GEMINI_PATH}`);
console.log(`Using GUI HOME: ${TEST_HOME}`);

// Setup minimal settings.json if needed
const settingsDir = path.join(TEST_HOME, '.gemini');
if (!fs.existsSync(settingsDir)) {
    try { fs.mkdirSync(settingsDir, { recursive: true }); } catch (e) { }
}



const env = {
    ...process.env,
    GEMINI_CLI_HOME: TEST_HOME,
    // TERM: 'dumb' // Simulate non-interactive
};

console.log(`Running: script -q /dev/null ${GEMINI_PATH} -p "${PROMPT}" --output-format stream-json`);

// Keep env, but run via script to fake TTY
const child = spawn('script', ['-q', '/dev/null', GEMINI_PATH, '-p', PROMPT, '--output-format', 'stream-json'], {
    env,
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (d) => {
    const s = d.toString();
    stdout += s;
    console.log('[STDOUT_CHUNK]', s.substring(0, 100) + '...');
});

child.stderr.on('data', (d) => {
    const s = d.toString();
    stderr += s;
    console.log('[STDERR]', s);
});

child.on('close', (code) => {
    console.log(`Exited with code ${code}`);

    if (stdout.includes('Tool "run_shell_command" not found')) {
        console.log('RESULT: Tool was disabled/not found (Reproduction Successful).');
    } else if (stdout.includes('Action Required')) {
        console.log('RESULT: Prompt detected! (Interactive mode is active).');
    } else if (stdout.includes('git status')) {
        console.log('RESULT: Command executed successfully (Auto-approved?).');
    } else {
        console.log('RESULT: Inconclusive.');
        console.log('Full Output:', stdout);
    }

    // Cleanup
    // try {
    //     fs.rmSync(TEST_HOME, { recursive: true, force: true });
    // } catch (e) { }
});
