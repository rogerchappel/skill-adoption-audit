# skill-adoption-audit

`skill-adoption-audit` checks whether an agent skill package is easy for another
agent to understand, validate, and use safely. It is a read-only local CLI for
release candidates, CI gates, and repository triage.

## Quickstart

```bash
npm install
npm test
npm run smoke
node src/cli.js fixtures/good-skill --format json
node src/cli.js fixtures/weak-skill --strict
```

## CLI

```bash
skill-adoption-audit <skill-dir> [--checklist checklist.json] [--format markdown|json] [--strict]
```

Strict mode exits non-zero when required adoption items are missing.
Unknown options, extra positional arguments, and options missing required values
exit with status 1 and print an actionable error to standard error.

## What It Checks

- `SKILL.md` exists and names when to use the skill
- Required inputs are documented
- Side-effect boundaries and approval requirements are explicit
- Examples are present
- Validation or verification workflow is present
- README, docs, fixtures, package metadata, and tests are discoverable

## Limitations

- The audit uses deterministic text and file checks.
- It does not prove that examples are semantically correct.
- Custom checklist support augments the default checks; it does not remove the
  safety checks.

## Safety Notes

This tool reads local files only. It does not publish packages, mutate
repositories, call network services, or install dependencies.
