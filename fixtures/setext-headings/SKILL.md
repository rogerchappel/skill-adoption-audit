Setext Skill
============

Use this skill when validating Setext heading support.

Required Inputs
---------------

- A local fixture

Side-Effect Boundaries
----------------------

Read-only local inspection.

Approval Requirements
---------------------

Human approval is needed before external changes.

Examples
--------

```bash
node ../../src/cli.js . --format markdown
```

Validation
----------

~~~bash
npm test
npm run smoke
~~~
