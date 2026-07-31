# skill-adoption-audit

`skill-adoption-audit` checks whether an agent skill package is easy for another
agent to understand, validate, and use safely. It is a read-only local CLI for
release candidates, CI gates, and repository triage.

## Run From a Checkout

```bash
npm install
npm test
npm run smoke
node src/cli.js fixtures/good-skill --format json
node src/cli.js fixtures/weak-skill --strict
```

The checkout workflow uses `node src/cli.js` explicitly; `npm install` does not
place the current package's executable on your shell path.

## Install the Packaged CLI

Until a registry release is available, pack the checkout and install that
archive in the project where you want to run the audit:

```bash
# In the skill-adoption-audit checkout:
npm pack --pack-destination /tmp

# In a separate project:
npm install --save-dev /tmp/skill-adoption-audit-0.1.0.tgz
npx --no-install skill-adoption-audit --help
npx --no-install skill-adoption-audit path/to/skill --format json
```

`npx --no-install` guarantees that the command resolves to the package already
installed in the current project and does not download a missing package.

## CLI

```bash
npx --no-install skill-adoption-audit <skill-dir> [--checklist checklist.json] [--format markdown|json] [--strict]
```

Strict mode exits non-zero when required adoption items are missing.
Pass `--help` (or `-h`) to print the command usage.
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
