import { getDungeonPackage } from '../dungeons/packages';

// Invalid citations fail closed; nonverified/stale candidates remain reportable, not playable.
const dungeon = getDungeonPackage('dp-700');
if (!dungeon)
  throw new Error('The preserved DP-700 package could not be loaded.');
export const content = dungeon;
