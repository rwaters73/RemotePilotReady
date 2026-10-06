// Validates every file in questions/ against docs/QUESTION_FORMAT.md.
// Usage: npm run qbank:validate [-- --questions DIR --figures DIR --references FILE --acs FILE]
// Exits 1 if any error is found. Warnings are printed but do not change the exit code.

import { resolve } from 'node:path';
import { defaultPaths, validateBankDetailed } from './lib/validate.ts';
import type { BankPaths } from './lib/validate.ts';

const FLAGS: Record<string, keyof BankPaths> = {
  '--questions': 'questionsDir',
  '--figures': 'figuresDir',
  '--references': 'referencesPath',
  '--acs': 'acsPath',
};

function parseArgs(argv: string[]): BankPaths {
  const paths = defaultPaths();
  for (let i = 0; i < argv.length; i++) {
    const key = FLAGS[argv[i]];
    const value = argv[i + 1];
    if (key === undefined || value === undefined) {
      console.error(`Unknown or incomplete argument: ${argv[i]}`);
      console.error('Usage: npm run qbank:validate [-- --questions DIR --figures DIR --references FILE --acs FILE]');
      process.exit(2);
    }
    paths[key] = resolve(value);
    i++;
  }
  return paths;
}

const result = validateBankDetailed(parseArgs(process.argv.slice(2)));
for (const i of result.issues) {
  console.log(`${i.severity.toUpperCase()} [${i.check}] ${i.file}: ${i.message}`);
}
const errors = result.issues.filter((i) => i.severity === 'error').length;
const warnings = result.issues.length - errors;
const byStatus = Object.entries(result.statusCounts)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([s, n]) => `${s} ${n}`)
  .join(', ');
console.log(`${result.questionCount} questions${byStatus ? ` (${byStatus})` : ''}; ${errors} errors, ${warnings} warnings`);
process.exit(errors > 0 ? 1 : 0);
