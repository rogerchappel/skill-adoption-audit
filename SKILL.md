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

1. Run `skill-adoption-audit <skill-dir>`.
2. Review blockers first.
3. Fix missing adoption evidence in the skill package.
4. Re-run with `--strict` before release-candidate handoff.
5. Attach the markdown or JSON report to the release notes.

## Examples

```bash
node src/cli.js fixtures/good-skill --format markdown
node src/cli.js fixtures/weak-skill --format json --strict
```

## Verification

Run `npm test`, `npm run check`, and `npm run smoke`.

