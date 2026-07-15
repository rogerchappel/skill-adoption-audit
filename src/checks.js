export const DEFAULT_CHECKS = [
  {
    id: 'skill-file',
    level: 'blocker',
    description: 'SKILL.md exists',
    type: 'file',
    path: 'SKILL.md'
  },
  {
    id: 'when-to-use',
    level: 'blocker',
    description: 'Skill explains when to use it',
    type: 'phrase',
    path: 'SKILL.md',
    phrases: ['use this skill', 'when to use']
  },
  {
    id: 'required-inputs',
    level: 'blocker',
    description: 'Required inputs are documented',
    type: 'phrase',
    path: 'SKILL.md',
    phrases: ['required inputs', 'inputs']
  },
  {
    id: 'side-effects',
    level: 'blocker',
    description: 'Side-effect boundaries are explicit',
    type: 'phrase',
    path: 'SKILL.md',
    phrases: ['side-effect', 'side effect', 'read-only']
  },
  {
    id: 'approval',
    level: 'warning',
    description: 'Approval requirements are stated',
    type: 'phrase',
    path: 'SKILL.md',
    phrases: ['approval']
  },
  {
    id: 'examples',
    level: 'warning',
    description: 'Examples are included',
    type: 'phrase',
    path: 'SKILL.md',
    phrases: ['example', 'examples']
  },
  {
    id: 'verification',
    level: 'blocker',
    description: 'Validation or verification workflow exists',
    type: 'phrase',
    path: 'SKILL.md',
    phrases: ['verification', 'validation', 'npm test', 'smoke']
  },
  {
    id: 'readme',
    level: 'warning',
    description: 'README exists',
    type: 'file',
    path: 'README.md'
  },
  {
    id: 'docs',
    level: 'warning',
    description: 'Docs directory exists',
    type: 'directory',
    path: 'docs'
  },
  {
    id: 'fixtures',
    level: 'warning',
    description: 'Fixtures directory exists',
    type: 'directory',
    path: 'fixtures'
  },
  {
    id: 'package-metadata',
    level: 'warning',
    description: 'Package metadata exists',
    type: 'file',
    path: 'package.json'
  },
  {
    id: 'tests',
    level: 'warning',
    description: 'Tests directory exists',
    type: 'directory',
    path: 'test'
  }
];

