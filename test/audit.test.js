import test from 'node:test';
import assert from 'node:assert/strict';
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

