import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
for (const file of readdirSync('public').filter(name => name.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', 'public/' + file], { stdio: 'inherit' });
}
console.log('JavaScript syntax checks passed');
