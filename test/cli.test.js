import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function runCli(format) {
  return spawnSync(process.execPath, ['src/cli.js', 'fixtures/good-skill', '--format', format], {
    encoding: 'utf8'
  });
}

test('accepts supported output formats', () => {
  const markdown = runCli('markdown');
  assert.equal(markdown.status, 0);
  assert.match(markdown.stdout, /^# Skill Adoption Audit/);
  assert.equal(markdown.stderr, '');

  const json = runCli('json');
  assert.equal(json.status, 0);
  assert.doesNotThrow(() => JSON.parse(json.stdout));
  assert.equal(json.stderr, '');
});

test('rejects unsupported output formats', () => {
  const result = runCli('yaml');

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /unsupported format: yaml; expected markdown or json/);
});
