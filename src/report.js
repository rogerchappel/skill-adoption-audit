export function formatJson(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function formatSarif(report) {
  const results = report.results.map((finding) => ({
    ruleId: finding.id,
    level: finding.level === 'blocker' ? 'error' : finding.status === 'fail' ? 'warning' : 'note',
    message: { text: finding.description },
    properties: { status: finding.status }
  }));
  const rules = [...new Map(report.results.map((finding) => [finding.id, {
    id: finding.id,
    shortDescription: { text: finding.description },
    defaultConfiguration: { level: finding.level === 'blocker' ? 'error' : 'warning' }
  }])).values()];

  return `${JSON.stringify({
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 'skill-adoption-audit', rules } },
      results
    }]
  }, null, 2)}\n`;
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
