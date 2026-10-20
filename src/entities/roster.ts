import { COLOR } from "../systems/palette";
import { GHOST_ORDER } from "../core/ghosts";
import { NONE, type Actor, type LevelMap } from "../core/types";
import { createPacman } from "./pacman";

export function makeActors(level: LevelMap): Actor[] {
  const spots = [...level.ghosts].sort((a, b) => a.y - b.y || a.x - b.x);
  const ghosts = spots.map((spot, index): Actor => {
    const profile = GHOST_ORDER[index % GHOST_ORDER.length];
    return {
      kind: "ghost",
      name: profile.id,
      tx: spot.x,
      ty: spot.y,
      dir: NONE,
      next: NONE,
      prog: 0,
      mode: "house",
      release: 0,
      color: COLOR.ghosts[index % COLOR.ghosts.length],
      homeX: spot.x,
      homeY: spot.y,
    };
  });
  return [createPacman(level.pac), ...ghosts];
}

export function releaseDelay(index: number): number {
  return GHOST_ORDER[index]?.releaseFrames ?? index * 110;
}
