import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function runCli(...args) {
  return spawnSync(process.execPath, ['src/cli.js', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
}

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
