import { createWorkspaceHandler } from './_lib/workspace.js';
import { reduceWorkspace, seedWorkspace } from '../src/domain.js';
export default createWorkspaceHandler({
  app: 'payroute',
  seed: seedWorkspace,
  reduce: reduceWorkspace,
});
