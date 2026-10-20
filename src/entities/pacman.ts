import { COLOR } from "../systems/palette";
import { NONE, type Actor } from "../core/types";

export function createPacman(spot: { x: number; y: number }): Actor {
  return {
    kind: "pac",
    name: "pacman",
    tx: spot.x,
    ty: spot.y,
    dir: NONE,
    next: NONE,
    prog: 0,
    mode: "chase",
    release: 0,
    color: COLOR.pac,
    homeX: spot.x,
    homeY: spot.y,
  };
}
