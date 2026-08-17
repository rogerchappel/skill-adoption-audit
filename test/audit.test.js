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

test('rejects negated and placeholder-only default phrase evidence', async () => {
  const report = await auditWithSkillMarkdown(`# Misleading Skill
Do not use this skill.
Required inputs are not documented.
No side effect boundaries are defined.
Approval is TBD.
`);

  for (const id of ['when-to-use', 'required-inputs', 'side-effects']) {
    assert.equal(report.results.find((result) => result.id === id).status, 'fail');
    assert.ok(report.blockers.some((result) => result.id === id));
  }
  assert.equal(report.results.find((result) => result.id === 'approval').status, 'fail');
  assert.ok(report.warnings.some((result) => result.id === 'approval'));
  assert.equal(report.status, 'block');
});

test('does not treat default check headings as affirmative evidence', async () => {
  const report = await auditWithSkillMarkdown(`# Heading-Only Skill
## When to Use
TBD
## Required Inputs
None documented.
## Side Effects
Missing.
## Approval
Pending.
`);

  for (const id of ['when-to-use', 'required-inputs', 'side-effects', 'approval']) {
    assert.equal(report.results.find((result) => result.id === id).status, 'fail');
  }
});

test('accepts representative affirmative default phrase evidence', async () => {
  const report = await auditWithSkillMarkdown(`# Affirmative Skill
Use this skill when reviewing a local package.
Inputs: a package directory and configuration file.
All operations are read-only.
Ask for approval before writing outside the package.
`);

  for (const id of ['when-to-use', 'required-inputs', 'side-effects', 'approval']) {
    assert.equal(report.results.find((result) => result.id === id).status, 'pass');
  }
});

test('accepts affirmative fixture including negative safety boundaries', async () => {
  const report = await auditSkill('fixtures/affirmative-evidence');

  for (const id of ['when-to-use', 'required-inputs', 'side-effects', 'approval']) {
    assert.equal(report.results.find((result) => result.id === id).status, 'pass');
  }
});

test('rejects direct negation and prohibition for every default affirmative check', async () => {
  const report = await auditSkill('fixtures/negated-evidence');

  for (const id of ['when-to-use', 'required-inputs', 'side-effects', 'approval']) {
    assert.equal(report.results.find((result) => result.id === id).status, 'fail');
  }
});

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

test('accepts ATX evidence headings indented up to three spaces', async () => {
  const report = await auditSkill('fixtures/indented-headings');

  assert.equal(report.results.find(({ id }) => id === 'examples').status, 'pass');
  assert.equal(report.results.find(({ id }) => id === 'verification').status, 'pass');
});

test('rejects four-space indented text that resembles ATX evidence headings', async () => {
  const report = await auditWithSkillMarkdown(`${requiredDocumentation}
    ## Examples
\`\`\`bash
node example.js
\`\`\`
    ## Verification
\`\`\`bash
npm test
\`\`\``);

  assert.equal(report.results.find(({ id }) => id === 'examples').status, 'fail');
  assert.equal(report.results.find(({ id }) => id === 'verification').status, 'fail');
});

test('accepts tilde fences and longer matching closing fences with info strings', async () => {
  const report = await auditWithSkillMarkdown(`${requiredDocumentation}
## Examples
~~~javascript linenums="1"
console.log('example');
~~~~
## Verification
   ~~~~ shell session
npm test
   ~~~~`);
  assert.equal(report.results.find(({ id }) => id === 'examples').status, 'pass');
  assert.equal(report.results.find(({ id }) => id === 'verification').status, 'pass');
});

test('rejects empty, unclosed, and mismatched fenced code blocks', async () => {
  const cases = [
    ['```bash\n```', '~~~sh\n~~~'],
    ['```bash\nnode example.js', '~~~sh\nnpm test'],
    ['```bash\nnode example.js\n~~~', '~~~sh\nnpm test\n```'],
    ['````bash\nnode example.js\n```', '~~~~sh\nnpm test\n~~~']
  ];

  for (const [example, verification] of cases) {
    const report = await auditWithSkillMarkdown(`${requiredDocumentation}
## Examples
${example}
## Verification
${verification}`);
    assert.equal(report.results.find(({ id }) => id === 'examples').status, 'fail');
    assert.equal(report.results.find(({ id }) => id === 'verification').status, 'fail');
  }
});
