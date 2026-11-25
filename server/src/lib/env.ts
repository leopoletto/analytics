import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, '../../../.env');

export function loadEnv(): void {
  if (fs.existsSync(rootEnvPath)) {
    process.loadEnvFile(rootEnvPath);
  }
}

loadEnv();
