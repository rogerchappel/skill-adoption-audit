# Orchestration

Use this audit near the end of a skill build or release-candidate workflow.

1. A builder assembles the skill package.
2. This tool checks adoption evidence locally.
3. The builder fixes blockers or records accepted warnings.
4. Release-candidate notes include the final report.

The tool is safe to run in CI because it reads local files and emits stdout
only.

