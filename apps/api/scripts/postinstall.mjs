import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.env.SKIP_API_VENV_SETUP === 'true') {
  console.log('[api postinstall] SKIP_API_VENV_SETUP=true, skipping FastAPI venv setup.');
  process.exit(0);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, 'setup_venv.py');

const candidates =
  process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

let error;
let foundPythonBinary = false;

for (const cmd of candidates) {
  let result;
  try {
    result = spawnSync(cmd, [scriptPath], {
      stdio: 'inherit'
    });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      continue;
    }
    error = err;
    break;
  }

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      continue;
    }
    error = result.error;
    break;
  }

  foundPythonBinary = true;

  if (result.status === 0) {
    process.exit(0);
  }

  error = new Error(`${cmd} exited with code ${result.status}`);
}

if (!foundPythonBinary && (!error || error.code === 'ENOENT')) {
  console.warn('[api postinstall] python not found, skipping FastAPI venv setup (no failure).');
  process.exit(0);
}

console.error('Failed to setup FastAPI virtual environment via setup_venv.py');
if (error) {
  console.error(error);
}
process.exit(1);
