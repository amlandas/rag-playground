import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, 'setup_venv.py');

const candidates =
  process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

let error;

for (const cmd of candidates) {
  const result = spawnSync(cmd, [scriptPath], {
    stdio: 'inherit'
  });

  if (result.status === 0) {
    process.exit(0);
  }

  error = result.error ?? new Error(`${cmd} exited with code ${result.status}`);
}

console.error('Failed to setup FastAPI virtual environment via setup_venv.py');
if (error) {
  console.error(error);
}
process.exit(1);
