#!/usr/bin/env bash
set -euo pipefail

project_dir=$(mktemp -d "${TMPDIR:-/tmp}/skill-adoption-audit-smoke.XXXXXX")
package_dir=$(mktemp -d "${TMPDIR:-/tmp}/skill-adoption-audit-pack.XXXXXX")
trap 'rm -rf "$project_dir" "$package_dir"' EXIT

archive_name=$(npm pack --silent --pack-destination "$package_dir")

cd "$project_dir"
npm init --yes >/dev/null
npm install --ignore-scripts "$package_dir/$archive_name" >/dev/null
npx --no-install skill-adoption-audit --help >/dev/null
npx --no-install skill-adoption-audit \
  node_modules/skill-adoption-audit/fixtures/good-skill \
  --format json \
  --strict >/dev/null
