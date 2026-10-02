import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('out', { recursive: true });
cpSync('public', 'out', { recursive: true });
writeFileSync('out/.nojekyll', '');
console.log('Static site exported to out/');
