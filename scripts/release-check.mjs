import { publicationBlockers } from './publication.mjs';
const blockers = await publicationBlockers({ release: process.argv.includes("--public-info") ? "public-information" : "application" });
if (blockers.length) {
  console.error('Artifact validation failed: ' + blockers.join('; '));
  process.exitCode = 1;
} else console.log('Build/content validation passed. This does not certify legal compliance, Google verification or production acceptance; see docs/CLOUDFLARE_PAGES_RELEASE.md.');
