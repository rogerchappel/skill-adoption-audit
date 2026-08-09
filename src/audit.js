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
  parsed.checks.forEach(validateCheck);
  return parsed.checks;
}

const CHECK_TYPES = new Set(['file', 'directory', 'phrase', 'affirmative-phrase', 'markdown-section']);
const CHECK_LEVELS = new Set(['blocker', 'warning']);

function validateCheck(check, index) {
  const prefix = `checklist checks[${index}]`;
  if (!check || typeof check !== 'object' || Array.isArray(check)) {
    throw new Error(`${prefix} must be an object`);
  }
  if (!CHECK_TYPES.has(check.type)) {
    throw new Error(`${prefix}.type must be one of: ${[...CHECK_TYPES].join(', ')}`);
  }
  for (const field of ['id', 'description']) {
    if (typeof check[field] !== 'string' || check[field].trim() === '') {
      throw new Error(`${prefix}.${field} must be a non-empty string`);
    }
  }
  if (check.level !== undefined && !CHECK_LEVELS.has(check.level)) {
    throw new Error(`${prefix}.level must be one of: ${[...CHECK_LEVELS].join(', ')}`);
  }
  if (typeof check.path !== 'string' || check.path.trim() === '') {
    throw new Error(`${prefix}.path must be a non-empty string for type ${check.type}`);
  }
  if (check.type === 'phrase' || check.type === 'affirmative-phrase') {
    validateStringList(check.phrases, `${prefix}.phrases`, check.type);
  }
  if (check.type === 'markdown-section') {
    validateStringList(check.headings, `${prefix}.headings`, check.type);
  }
}

function validateStringList(value, field, type) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`${field} must be a non-empty array of non-empty strings for type ${type}`);
  }
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
  if (check.type === 'affirmative-phrase') {
    const content = await readText(path.join(root, check.path));
    return withStatus(check, hasAffirmativePhrase(content, check.phrases ?? []));
  }
  if (check.type === 'markdown-section') {
    const content = await readText(path.join(root, check.path));
    return withStatus(check, hasUsableMarkdownSection(content, check.headings ?? []));
  }
  throw new Error(`unsupported check type: ${check.type}`);
}

function hasAffirmativePhrase(content, phrases) {
  const wanted = phrases.map((phrase) => String(phrase).toLowerCase());
  const lines = content.split(/\r?\n/);
  const statements = content
    .split(/\r?\n/)
    .filter((line) => !/^\s*#{1,6}\s+/.test(line))
    .flatMap((line) => line.split(/(?<=[.!?;])\s+/))
    .map((statement) => statement.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '').trim().toLowerCase())
    .filter(Boolean);

  if (statements.some((statement) => {
    const phrase = wanted.find((candidate) => statement.includes(candidate));
    if (!phrase || hasDirectNegation(statement, phrase)) return false;
    return !hasMissingOrPlaceholderClaim(statement);
  })) return true;

  if (wanted.includes('read-only') && statements.some(hasNoWriteBoundary)) return true;

  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^\s*#{1,6}\s+(.+?)\s*#*\s*$/.exec(lines[index]);
    if (!heading || !wanted.some((phrase) => heading[1].toLowerCase().includes(phrase))) continue;

    const body = [];
    for (index += 1; index < lines.length && !/^\s*#{1,6}\s+/.test(lines[index]); index += 1) {
      body.push(lines[index]);
    }
    index -= 1;

    const statement = body.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (statement && !hasMissingOrPlaceholderClaim(statement)) return true;
  }

  return false;
}

function hasDirectNegation(statement, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const before = new RegExp(`\\b(?:do|does|must|should|may|can|will)\\s+not\\s+(?:\\w+[ -]?){0,3}${escaped}\\b`);
  const neverBefore = new RegExp(`\\bnever\\s+(?:\\w+[ -]?){0,3}${escaped}\\b`);
  const after = new RegExp(`\\b${escaped}\\b.{0,32}\\b(?:is|are|be|being)\\s+(?:not\\s+(?:accepted|allowed|provided|supported|used)|prohibited|forbidden|disallowed)\\b`);
  const directlyNegated = new RegExp(`\\bnot\\s+${escaped}\\b`);
  return before.test(statement) || neverBefore.test(statement) || after.test(statement) || directlyNegated.test(statement);
}

function hasNoWriteBoundary(statement) {
  return /\b(?:performs?|makes?|does)\s+no\s+(?:file(?:system)?\s+)?writes?\b/.test(statement);
}

function hasMissingOrPlaceholderClaim(statement) {
  return /\b(?:tbd|todo|pending|coming soon|missing|undocumented|unspecified|undefined)\b/.test(statement)
    || /\bnone\b.+\b(?:documented|defined|specified|stated|available|included)\b/.test(statement)
    || /\b(?:not|never)\s+(?:currently\s+)?(?:documented|defined|specified|stated|available|included)\b/.test(statement)
    || /\b(?:does|do)\s+not\s+(?:exist|use)\b/.test(statement)
    || /\bno\s+.+\b(?:is|are)\s+(?:documented|defined|specified|stated|available|included)\b/.test(statement)
    || /^(?:prohibited|forbidden|disallowed)[.!]?$/i.test(statement);
}

function hasUsableMarkdownSection(content, headings) {
  const wanted = new Set(headings.map((heading) => String(heading).toLowerCase()));
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]);
    if (!match || !wanted.has(match[2].replace(/\s+#+$/, '').toLowerCase())) continue;

    const level = match[1].length;
    const section = [];
    for (index += 1; index < lines.length; index += 1) {
      const nextHeading = /^(#{1,6})\s+/.exec(lines[index]);
      if (nextHeading && nextHeading[1].length <= level) {
        index -= 1;
        break;
      }
      section.push(lines[index]);
    }

    const body = section.join('\n').trim();
    if (!body || /^(?:tbd|todo|pending|coming soon|none|n\/a)[.!\s]*$/i.test(body)) continue;
    if (/```[\w-]*\n[\s\S]*?\S[\s\S]*?```/.test(body)) return true;
  }

  return false;
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
