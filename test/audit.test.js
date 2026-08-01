import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditSkill } from '../src/audit.js';

test('passes complete fixture with warnings only for absent release notes', async () => {
  const report = await auditSkill('fixtures/good-skill');
  assert.equal(report.status, 'pass');
  assert.equal(report.blockers.length, 0);
  assert.equal(report.score, 100);
});

test('blocks weak fixture with missing adoption evidence', async () => {
  const report = await auditSkill('fixtures/weak-skill');
  assert.equal(report.status, 'block');
  assert.ok(report.blockers.some((item) => item.id === 'required-inputs'));
  assert.ok(report.warnings.some((item) => item.id === 'readme'));
});

async function auditWithSkillMarkdown(markdown) {
  const root = await mkdtemp(path.join(tmpdir(), 'skill-adoption-audit-'));
  await writeFile(path.join(root, 'SKILL.md'), markdown);
  for (const directory of ['docs', 'fixtures', 'test']) await mkdir(path.join(root, directory));
  await writeFile(path.join(root, 'README.md'), 'readme');
  await writeFile(path.join(root, 'package.json'), '{}');
  return auditSkill(root);
}

const requiredDocumentation = `# Test Skill
Use this skill for tests.
## Required Inputs
Inputs are documented.
## Side Effects
This is read-only.
`;

test('does not accept negated example and verification keyword mentions', async () => {
  const report = await auditWithSkillMarkdown(`${requiredDocumentation}\nNo examples are included. Verification does not exist.`);
  assert.equal(report.results.find(({ id }) => id === 'examples').status, 'fail');
  assert.equal(report.results.find(({ id }) => id === 'verification').status, 'fail');
});

test('does not accept pending example and verification sections', async () => {
  const report = await auditWithSkillMarkdown(`${requiredDocumentation}\n## Examples\nComing soon.\n## Verification\nTBD`);
  assert.equal(report.results.find(({ id }) => id === 'examples').status, 'fail');
  assert.equal(report.results.find(({ id }) => id === 'verification').status, 'fail');
});

test('accepts example and verification sections with executable evidence', async () => {
  const report = await auditWithSkillMarkdown(`${requiredDocumentation}\n## Examples\n\`\`\`bash\nnode src/cli.js fixture\n\`\`\`\n## Verification\n\`\`\`bash\nnpm test\n\`\`\``);
  assert.equal(report.results.find(({ id }) => id === 'examples').status, 'pass');
  assert.equal(report.results.find(({ id }) => id === 'verification').status, 'pass');
});
