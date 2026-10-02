import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMarkdown, formatSarif } from '../src/report.js';

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

test('maps audit findings into SARIF 2.1.0 results and rules', () => {
  const report = {
    results: [
      { id: 'required-inputs', level: 'blocker', description: 'Inputs are documented', status: 'fail' },
      { id: 'readme', level: 'warning', description: 'README exists', status: 'pass' }
    ]
  };
  const sarif = JSON.parse(formatSarif(report));
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs[0].tool.driver.name, 'skill-adoption-audit');
  assert.deepEqual(sarif.runs[0].results, [
    { ruleId: 'required-inputs', level: 'error', message: { text: 'Inputs are documented' }, properties: { status: 'fail' } },
    { ruleId: 'readme', level: 'note', message: { text: 'README exists' }, properties: { status: 'pass' } }
  ]);
  assert.deepEqual(sarif.runs[0].tool.driver.rules.map((rule) => rule.id), ['required-inputs', 'readme']);
});

