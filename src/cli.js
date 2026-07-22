#!/usr/bin/env node
import { auditSkill, loadChecklist } from './audit.js';
import { formatJson, formatMarkdown } from './report.js';

async function main(argv) {
  const [root, ...rest] = argv;
  if (!root) {
    throw new Error('usage: skill-adoption-audit <skill-dir> [--checklist checklist.json] [--format markdown|json] [--strict]');
  }

  const flags = parseFlags(rest);
  const format = flags.format ?? 'markdown';
  if (format !== 'markdown' && format !== 'json') {
    throw new Error(`unsupported format: ${format}; expected markdown or json`);
  }

  const extraChecks = await loadChecklist(flags.checklist);
  const report = await auditSkill(root, { extraChecks });
  process.stdout.write(format === 'json' ? formatJson(report) : formatMarkdown(report));

  if (flags.strict === true && report.status !== 'pass') {
    process.exitCode = 2;
  }
}

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      index += 1;
    }
  }
  return flags;
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
