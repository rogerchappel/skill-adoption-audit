export function formatJson(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function formatMarkdown(report) {
  return [
    '# Skill Adoption Audit',
    '',
    `- Root: ${report.root}`,
    `- Score: ${report.score}`,
    `- Status: ${report.status}`,
    '',
    '## Blockers',
    list(report.blockers),
    '',
    '## Warnings',
    list(report.warnings),
    '',
    '## Passing Evidence',
    list(report.passes)
  ].join('\n') + '\n';
}

function list(items) {
  if (items.length === 0) {
    return '- none';
  }
  return items.map((item) => `- ${item.id}: ${item.description}`).join('\n');
}

