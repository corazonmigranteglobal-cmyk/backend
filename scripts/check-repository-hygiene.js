#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const forbiddenExactPaths = new Set([
  '.pnp.cjs',
  '.pnp.loader.mjs',
  '.yarn/install-state.gz',
  'BACEKND.zip',
]);

const forbiddenDirectoryPrefixes = ['backups/', 'secrets/'];
const forbiddenExtensions = new Set(['.dump', '.backup', '.zip']);

/**
 * Returns paths tracked by Git. Using Git's index prevents ignored local files from
 * producing false positives while still blocking accidental commits in CI.
 */
function listTrackedPaths() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  return output.split('\0').filter(Boolean).map((trackedPath) => trackedPath.replace(/\\/g, '/'));
}

/**
 * Determines whether a tracked path is an operational artifact that must live
 * outside source control.
 */
function isForbiddenTrackedPath(trackedPath) {
  if (forbiddenExactPaths.has(trackedPath)) return true;
  if (forbiddenDirectoryPrefixes.some((prefix) => trackedPath.startsWith(prefix))) return true;
  return forbiddenExtensions.has(path.posix.extname(trackedPath).toLowerCase());
}

const forbiddenPaths = listTrackedPaths().filter(isForbiddenTrackedPath);

if (forbiddenPaths.length > 0) {
  console.error('Repository hygiene check failed. Remove these tracked operational artifacts:');
  for (const forbiddenPath of forbiddenPaths) console.error(`- ${forbiddenPath}`);
  process.exit(1);
}

console.log('Repository hygiene check passed.');
