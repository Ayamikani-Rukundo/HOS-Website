import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const args = process.argv.slice(2);

if (args.includes('all') || args.length === 0) {
  const viteCli = resolve(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [viteCli, '--host'], {
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  console.log('Usage: npm run start all');
  console.log('This project starts the local Vite dev server for the organization website and portal.');
}
