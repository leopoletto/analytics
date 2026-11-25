import '../lib/env.js';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createAdminUser } from '../lib/auth.js';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return undefined;
}

async function main() {
  let email = getArg('--email');
  let password = getArg('--password');

  if (!email || !password) {
    const rl = readline.createInterface({ input, output });
    try {
      console.log('\n  Leo Analytics — Admin Account Setup\n');
      if (!email) {
        email = (await rl.question('  Admin email: ')).trim();
      }
      if (!password) {
        password = (await rl.question('  Password (min 8 chars): ')).trim();
      }
    } finally {
      rl.close();
    }
  }

  if (!email || !email.includes('@')) {
    console.error('Error: Please provide a valid email address.');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  const user = createAdminUser(email, password);
  console.log(`\n  Admin account ready: ${user.email} (id: ${user.id})\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
