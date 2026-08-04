#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

const blockedSeverities = new Set(['critical', 'high']);
const findings = [];
// En Windows hay que ejecutar `yarn.cmd` a traves del shell: desde Node 20.12
// spawnSync rechaza los `.cmd` sin `shell: true` y devuelve EINVAL.
const isWindows = process.platform === 'win32';
const audit = spawnSync(
  isWindows ? 'yarn.cmd' : 'yarn',
  ['audit', '--groups', 'dependencies', '--json'],
  { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, shell: isWindows },
);

if (audit.error) {
  console.error(`Dependency audit could not start: ${audit.error.message}`);
  process.exit(2);
}

for (const line of audit.stdout.split(/\r?\n/)) {
  if (!line.trim()) continue;
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    continue;
  }

  if (event.type !== 'auditAdvisory') continue;
  const advisory = event.data?.advisory;
  if (!advisory || typeof advisory.severity !== 'string') continue;
  findings.push({
    severity: advisory.severity.toLowerCase(),
    moduleName: advisory.module_name ?? 'unknown',
    title: advisory.title ?? 'Unnamed advisory',
    patchedVersions: advisory.patched_versions ?? 'unknown',
  });
}

const blockedFindings = findings.filter((finding) => blockedSeverities.has(finding.severity));
const moderateFindings = findings.filter((finding) => finding.severity === 'moderate');

for (const finding of blockedFindings) {
  console.error(
    `[${finding.severity.toUpperCase()}] ${finding.moduleName}: ${finding.title} (patched ${finding.patchedVersions})`,
  );
}

console.log(
  `Production dependency audit: ${blockedFindings.length} high/critical, ${moderateFindings.length} moderate findings.`,
);

if (blockedFindings.length > 0) process.exit(1);
if (audit.status === null) process.exit(2);
