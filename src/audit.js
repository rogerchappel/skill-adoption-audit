import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CHECKS } from './checks.js';

export async function auditSkill(root, options = {}) {
  const checks = [...DEFAULT_CHECKS, ...(options.extraChecks ?? [])];
  const results = [];
  for (const check of checks) {
    results.push(await runCheck(root, check));
  }

  const blockers = results.filter((result) => result.status === 'fail' && result.level === 'blocker');
  const warnings = results.filter((result) => result.status === 'fail' && result.level !== 'blocker');
  const passes = results.filter((result) => result.status === 'pass');
  const score = Math.round((passes.length / results.length) * 100);

  return {
    root,
    score,
    status: blockers.length > 0 ? 'block' : warnings.length > 0 ? 'review' : 'pass',
    blockers,
    warnings,
    passes,
    results
  };
}

export async function loadChecklist(filePath) {
  if (!filePath) {
    return [];
  }
  const parsed = JSON.parse(await readFile(filePath, 'utf8'));
  if (!Array.isArray(parsed.checks)) {
    throw new Error('checklist JSON must contain a checks array');
  }
  return parsed.checks;
}

async function runCheck(root, check) {
  if (check.type === 'file') {
    return withStatus(check, await isFile(path.join(root, check.path)));
  }
  if (check.type === 'directory') {
    return withStatus(check, await isDirectory(path.join(root, check.path)));
  }
  if (check.type === 'phrase') {
    const content = await readText(path.join(root, check.path));
    const lower = content.toLowerCase();
    const found = (check.phrases ?? []).some((phrase) => lower.includes(String(phrase).toLowerCase()));
    return withStatus(check, found);
  }
  throw new Error(`unsupported check type: ${check.type}`);
}

function withStatus(check, passed) {
  return {
    id: check.id,
    level: check.level ?? 'warning',
    description: check.description,
    status: passed ? 'pass' : 'fail'
  };
}

async function readText(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(filePath) {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

