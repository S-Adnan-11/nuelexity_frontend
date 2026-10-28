import { publicationBlockers } from './publication.mjs';
const blockers = await publicationBlockers();
if (blockers.length) {
  console.error('Publication held: ' + blockers.join('; '));
  process.exitCode = 1;
} else console.log('Policy configuration complete. Review docs/PREDEPLOYMENT.md and run real-service acceptance before release.');
