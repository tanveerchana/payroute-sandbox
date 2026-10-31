import { createTeamHandler } from './_lib/team.js';
import { seedWorkspace } from '../src/domain.js';
export default createTeamHandler({ app: 'payroute', seed: seedWorkspace });
