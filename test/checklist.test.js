import test from 'node:test';
import assert from 'node:assert/strict';
import { loadChecklist } from '../src/audit.js';

const malformed = [
  ['invalid-entry', 'checklist checks[0] must be an object'],
  ['invalid-type', 'checklist checks[0].type must be one of: file, directory, phrase, affirmative-phrase, markdown-section'],
  ['blank-id', 'checklist checks[0].id must be a non-empty string'],
  ['blank-description', 'checklist checks[0].description must be a non-empty string'],
  ['invalid-level', 'checklist checks[0].level must be one of: blocker, warning'],
  ['missing-path', 'checklist checks[0].path must be a non-empty string for type directory'],
  ['invalid-phrases', 'checklist checks[0].phrases must be a non-empty array of non-empty strings for type phrase'],
  ['missing-headings', 'checklist checks[0].headings must be a non-empty array of non-empty strings for type markdown-section']
];

for (const [fixture, message] of malformed) {
  test(`rejects ${fixture} checklist entries`, async () => {
    await assert.rejects(loadChecklist(`fixtures/checklists/${fixture}.json`), { message });
  });
}

test('loads a valid custom checklist', async () => {
  const checks = await loadChecklist('fixtures/checklists/valid.json');
  assert.deepEqual(checks.map(({ type }) => type), [
    'file',
    'directory',
    'phrase',
    'affirmative-phrase',
    'markdown-section'
  ]);
});
