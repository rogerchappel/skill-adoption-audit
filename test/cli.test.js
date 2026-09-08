import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function runCli(...args) {
  return spawnSync(process.execPath, ['src/cli.js', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
}

test('strict CLI rejects placeholder-only backtick and tilde fences', () => {
  for (const fence of ['```', '~~~']) {
    const root = mkdtempSync(path.join(tmpdir(), 'skill-adoption-cli-'));
    writeFileSync(path.join(root, 'SKILL.md'), `# Placeholder Skill
Use this skill for local audits.
Inputs: a local skill directory.
All operations are read-only.
Ask for approval before writing files.
## Examples
${fence}text
TBD.
${fence}
## Verification
${fence}text
N/A!
${fence}
`);

    const result = runCli(root, '--format', 'json', '--strict');
    const report = JSON.parse(result.stdout);
    assert.notEqual(result.status, 0);
    assert.equal(report.results.find(({ id }) => id === 'examples').status, 'fail');
    assert.equal(report.results.find(({ id }) => id === 'verification').status, 'fail');
  }
});

test('accepts each documented option', () => {
  const checklist = runCli('fixtures/good-skill', '--checklist', 'fixtures/checklist.json');
  const format = runCli('fixtures/good-skill', '--format', 'json');
  const strict = runCli('fixtures/good-skill', '--strict');

  assert.equal(checklist.status, 0);
  assert.equal(checklist.stderr, '');
  assert.equal(format.status, 0);
  assert.equal(format.stderr, '');
  assert.doesNotThrow(() => JSON.parse(format.stdout));
  assert.equal(strict.status, 0);
  assert.equal(strict.stderr, '');
});

test('prints help without requiring a skill directory', () => {
  const result = runCli('--help');

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /^Usage: skill-adoption-audit/);
});

test('rejects an unknown option', () => {
  const result = runCli('fixtures/good-skill', '--bogus');

  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'unknown option: --bogus\n');
  assert.equal(result.stdout, '');
});

test('rejects an unexpected positional argument', () => {
  const result = runCli('fixtures/good-skill', 'extra');

  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'unexpected positional argument: extra\n');
  assert.equal(result.stdout, '');
});

for (const option of ['--checklist', '--format']) {
  test(`rejects a missing value for ${option}`, () => {
    const result = runCli('fixtures/good-skill', option);

    assert.equal(result.status, 1);
    assert.equal(result.stderr, `option requires a value: ${option}\n`);
    assert.equal(result.stdout, '');
  });
}

test('--strict does not consume a following positional argument', () => {
  const result = runCli('fixtures/good-skill', '--strict', 'extra');

  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'unexpected positional argument: extra\n');
  assert.equal(result.stdout, '');
});

test('rejects unsupported output formats', () => {
  const result = runCli('fixtures/good-skill', '--format', 'yaml');

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /unsupported format: yaml; expected markdown or json/);
});

for (const [fixture, message] of [
  ['invalid-entry', 'checklist checks[0] must be an object'],
  ['invalid-type', 'checklist checks[0].type must be one of: file, directory, phrase, affirmative-phrase, markdown-section'],
  ['blank-id', 'checklist checks[0].id must be a non-empty string'],
  ['blank-description', 'checklist checks[0].description must be a non-empty string'],
  ['invalid-level', 'checklist checks[0].level must be one of: blocker, warning'],
  ['missing-path', 'checklist checks[0].path must be a non-empty string for type directory'],
  ['invalid-phrases', 'checklist checks[0].phrases must be a non-empty array of non-empty strings for type phrase'],
  ['missing-headings', 'checklist checks[0].headings must be a non-empty array of non-empty strings for type markdown-section']
]) {
  test(`reports ${fixture} checklist entries without internal errors`, () => {
    const result = runCli('fixtures/good-skill', '--checklist', `fixtures/checklists/${fixture}.json`);

    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `${message}\n`);
    assert.doesNotMatch(result.stderr, /TypeError|Cannot read properties|stack/i);
  });
}

test('runs an audit with every supported custom check type', () => {
  const result = runCli('fixtures/good-skill', '--checklist', 'fixtures/checklists/valid.json', '--format', 'json');

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout).results.length, 17);
});

test('strict JSON output blocks misleading default phrase evidence', () => {
  const result = runCli('fixtures/misleading-skill', '--format', 'json', '--strict');
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 2);
  assert.equal(report.status, 'block');
  assert.deepEqual(report.blockers.map(({ id }) => id), [
    'when-to-use',
    'required-inputs',
    'side-effects',
    'verification'
  ]);
  assert.ok(report.warnings.some(({ id }) => id === 'approval'));
});

test('CLI accepts CommonMark-indented evidence headings', () => {
  const result = runCli('fixtures/indented-headings', '--format', 'json');
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(report.results.find(({ id }) => id === 'examples').status, 'pass');
  assert.equal(report.results.find(({ id }) => id === 'verification').status, 'pass');
});

test('strict CLI accepts complete Setext-headed skills', () => {
  const result = runCli('fixtures/setext-headings', '--format', 'json', '--strict');
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(report.status, 'pass');
  assert.equal(report.results.find(({ id }) => id === 'examples').status, 'pass');
  assert.equal(report.results.find(({ id }) => id === 'verification').status, 'pass');
});

test('CLI rejects four-space indented affirmative headings', () => {
  const result = runCli('fixtures/four-space-affirmative-headings', '--format', 'json');
  const report = JSON.parse(result.stdout);

  for (const id of ['when-to-use', 'required-inputs', 'side-effects', 'approval']) {
    assert.equal(report.results.find((item) => item.id === id).status, 'fail');
  }
});

for (const fixture of ['fenced-affirmative-evidence', 'negated-heading-evidence']) {
  test(`strict CLI rejects misleading affirmative evidence from ${fixture}`, () => {
    const result = runCli(`fixtures/${fixture}`, '--format', 'json', '--strict');
    const report = JSON.parse(result.stdout);

    assert.equal(result.status, 2);
    assert.equal(report.status, 'block');
    for (const id of ['when-to-use', 'required-inputs', 'side-effects', 'approval']) {
      assert.equal(report.results.find((item) => item.id === id).status, 'fail');
    }
  });
}

test('CLI distinguishes an affirmative governing idiom from direct negation', () => {
  const reports = [
    ['Do not hesitate to use this skill for local review.', 'pass'],
    ['Do not use this skill for local review.', 'fail']
  ].map(([sentence, expected]) => {
    const root = mkdtempSync(path.join(tmpdir(), 'skill-adoption-cli-negation-'));
    writeFileSync(path.join(root, 'SKILL.md'), `# Negation Fixture\n${sentence}\n`);
    const result = runCli(root, '--format', 'json');
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).results.find(({ id }) => id === 'when-to-use').status, expected);
  });

  assert.equal(reports.length, 2);
});
