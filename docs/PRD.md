# Product Requirements

## Goal

Help maintainers determine whether a skill package is adoption-ready for another
agent without requiring live systems or subjective manual review first.

## Non-Goals

- Editing skill files
- Publishing packages
- Replacing human release review

## User Stories

- As a skill author, I can see missing documentation before opening a release
  candidate PR.
- As an agent reviewer, I can produce a consistent scorecard for a skill repo.
- As a maintainer, I can fail CI when key safety sections are absent.

## MVP Requirements

- Inspect a local directory
- Detect required skill sections, examples, validation notes, docs, fixtures,
  tests, README, and package metadata
- Support markdown and JSON output
- Support strict mode for CI
- Support optional checklist JSON for additional local requirements

