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
  const lines = linesOutsideFencedCode(content);
  const statements = lines
    .filter((line) => !parseAtxHeading(line) && !/^(?: {4}|\t)/.test(line))
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
    const heading = parseAtxHeading(lines[index]);
    if (!heading || !wanted.some((phrase) => heading.text.toLowerCase().includes(phrase))) continue;

    const body = [];
    for (index += 1; index < lines.length && !parseAtxHeading(lines[index]); index += 1) {
      body.push(lines[index]);
    }
    index -= 1;

    const statement = body.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const headingPhrase = wanted.find((candidate) => heading.text.toLowerCase().includes(candidate));
    const negatedBodyPhrase = wanted.some((candidate) => statement.includes(candidate) && hasDirectNegation(statement, candidate));
    if (statement && headingPhrase && !negatedBodyPhrase && !hasDirectNegation(statement, headingPhrase) && !hasMissingOrPlaceholderClaim(statement)) return true;
  }

  return false;
}

function linesOutsideFencedCode(content) {
  const lines = content.split(/\r?\n/);
  let fence = null;

  return lines.map((line) => {
    if (fence) {
      const closing = new RegExp(`^ {0,3}\\${fence.marker}{${fence.minimumLength},}[ \\t]*$`);
      if (closing.test(line)) fence = null;
      return '';
    }

    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!opening || (opening[1][0] === '`' && opening[2].includes('`'))) return line;

    fence = { marker: opening[1][0], minimumLength: opening[1].length };
    return '';
  });
}

function parseAtxHeading(line) {
  const match = /^ {0,3}(#{1,6})\s+(.+?)\s*$/.exec(line);
  if (!match) return null;
  return { level: match[1].length, text: match[2].replace(/\s+#+$/, '') };
}

function hasDirectNegation(statement, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const term = `${escaped}s?`;
  const before = new RegExp(`\\b(?:do|does|must|should|may|can|will)\\s+not\\s+(?:\\w+[ -]?){0,3}${term}\\b`);
  const neverBefore = new RegExp(`\\bnever\\s+(?:\\w+[ -]?){0,3}${term}\\b`);
  const after = new RegExp(`\\b${term}\\b.{0,32}\\b(?:is|are|be|being)\\s+(?:not\\s+(?:accepted|allowed|provided|supported|used)|prohibited|forbidden|disallowed)\\b`);
  const directlyNegated = new RegExp(`\\bnot\\s+${term}\\b`);
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
    const match = parseAtxHeading(lines[index]);
    if (!match || !wanted.has(match.text.toLowerCase())) continue;

    const level = match.level;
    const section = [];
    for (index += 1; index < lines.length; index += 1) {
      const nextHeading = parseAtxHeading(lines[index]);
      if (nextHeading && nextHeading.level <= level) {
        index -= 1;
        break;
      }
      section.push(lines[index]);
    }

    const body = section.join('\n').trim();
    if (!body || isPlaceholderText(body)) continue;
    if (hasNonEmptyFencedCodeBlock(body)) return true;
  }

  return false;
}

function hasNonEmptyFencedCodeBlock(content) {
  const lines = content.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[index]);
    if (!opening) continue;

    const marker = opening[1][0];
    if (marker === '`' && opening[2].includes('`')) continue;

    const minimumLength = opening[1].length;
    const closing = new RegExp(`^ {0,3}\\${marker}{${minimumLength},}[ \\t]*$`);
    const fencedLines = [];

    for (index += 1; index < lines.length; index += 1) {
      if (closing.test(lines[index])) {
        const fencedContent = fencedLines.join('\n').trim();
        if (fencedContent && !isPlaceholderText(fencedContent)) return true;
        break;
      }
      fencedLines.push(lines[index]);
    }
  }

  return false;
}

function isPlaceholderText(content) {
  return /^[\s"'([{]*(?:tbd|todo|pending|coming soon|none|n\/a)[\s.!?,;:'"\])}]*$/i.test(content);
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
