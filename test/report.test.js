import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMarkdown } from '../src/report.js';

test('renders blockers warnings and passing evidence', () => {
  const markdown = formatMarkdown({
    root: 'fixtures/weak-skill',
    score: 25,
    status: 'block',
    blockers: [{ id: 'required-inputs', description: 'Required inputs are documented' }],
    warnings: [{ id: 'readme', description: 'README exists' }],
    passes: [{ id: 'skill-file', description: 'SKILL.md exists' }]
  });

  assert.match(markdown, /Skill Adoption Audit/);
  assert.match(markdown, /required-inputs/);
  assert.match(markdown, /Passing Evidence/);
});

