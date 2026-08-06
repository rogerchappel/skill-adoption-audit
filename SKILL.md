# Skill Adoption Audit

Use this skill when reviewing an agent skill package for public release,
handoff, or inclusion in a reusable skill catalog.

## Required Inputs

- Local path to a skill package or repository
- Optional checklist JSON with additional required phrases or files

## Side-Effect Boundaries

This skill is read-only. It may inspect files under the provided directory and
emit a report to stdout. It must not edit files, install dependencies, publish
packages, create pull requests, or call external services.

## Approval Requirements

No external approval is needed for local inspection. Human approval is required
before acting on recommendations that change repository contents or release
status.

## Workflow

From this repository checkout, use `node src/cli.js`. If the package archive is
installed in a separate project, replace that prefix with
`npx --no-install skill-adoption-audit`.

1. Run `node src/cli.js <skill-dir>`.
2. Review blockers first.
3. Fix missing adoption evidence in the skill package.
4. Re-run with `node src/cli.js <skill-dir> --strict` before release-candidate handoff.
5. Attach the markdown or JSON report to the release notes.

## Examples

```bash
node src/cli.js fixtures/good-skill --format markdown
node src/cli.js fixtures/weak-skill --format json --strict
```

## Verification

Default phrase evidence qualifies only as an affirmative statement or a
matching Markdown heading with substantive content. Negated missing-evidence
claims and placeholder-only statements do not qualify. Example and verification
evidence qualifies only when the corresponding Markdown heading contains a
non-empty fenced code block. Custom checklist phrase checks remain literal,
case-insensitive substring matches and always augment the defaults.

Run `npm test`, `npm run check`, `npm run smoke`, and `npm run smoke:package`.
The package smoke check packs the checkout, installs it in a clean temporary
project, prints CLI help, and performs a strict audit through the installed bin.
