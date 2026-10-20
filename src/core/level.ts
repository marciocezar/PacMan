import type { Cell, LevelMap } from "./types";

/**
 * Labirinto no espírito do porte de 1982: poucos corredores, casa no centro,
 * túneis nas laterais e quatro pastilhas de poder. A ROM não guarda um
 * mapa de caracteres; ela desenha o playfield no meio de cada linha de TV.
 * Este mapa é a versão jogável dessa planta, com as mesmas regras de
 * passagem (porta só para fantasma, túnel que liga os dois lados).
 */
const ROWS = [
  "###################",
  "#........#........#",
  "#.##.###.#.###.##.#",
  "#o##....#.#....##o#",
  "#.##.##.#.#.##.##.#",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#...#...#....#",
  "########   ########",
  "                   ",
  "####.# #---# #.####",
  "####.# # G # #.####",
  "####.# #GGG# #.####",
  "####.# ##### #.####",
  "                   ",
  "########   ########",
  "#....#...#...#....#",
  "#.##.#.#####.#.##.#",
  "#.................#",
  "#.##.##.#.#.##.##.#",
  "#o..#....P....#..o#",
  "#.##.###.#.###.##.#",
  "#........#........#",
  "###################",
];

function parseChar(ch: string): Cell {
  if (ch === "#") return "wall";
  if (ch === ".") return "dot";
  if (ch === "o") return "power";
  if (ch === "-") return "door";
  return "empty";
}

export function createLevel(): LevelMap {
  const height = ROWS.length;
  const width = ROWS[0].length;
  const grid: Cell[][] = [];
  let pac = { x: 1, y: 1 };
  const ghosts: { x: number; y: number }[] = [];
  let dots = 0;
  const doors: { x: number; y: number }[] = [];

  for (let y = 0; y < height; y++) {
    const row = ROWS[y];
    if (row.length !== width) {
      throw new Error(`Linha ${y} do labirinto tem ${row.length} casas, esperava ${width}.`);
    }
    const cells: Cell[] = [];
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      if (ch === "P") pac = { x, y };
      if (ch === "G") ghosts.push({ x, y });
      const cell = parseChar(ch);
      if (cell === "dot" || cell === "power") dots++;
      if (cell === "door") doors.push({ x, y });
      cells.push(cell);
    }
    grid.push(cells);
  }

  const door = doors[Math.floor(doors.length / 2)] ?? { x: 1, y: 1 };
  const pen = ghosts.reduce((best, spot) => {
    if (spot.y > best.y) return spot;
    if (spot.y === best.y && Math.abs(spot.x - width / 2) < Math.abs(best.x - width / 2)) return spot;
    return best;
  }, ghosts[0]);
  const level: LevelMap = {
    grid,
    width,
    height,
    pac,
    ghosts,
    exit: { x: door.x, y: door.y - 1 },
    pen,
    dots,
  };
  assertReachable(level);
  return level;
}

export function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) => row.slice());
}

export function wrapX(x: number, width: number): number {
  if (x < 0) return width - 1;
  if (x >= width) return 0;
  return x;
}

function assertReachable(level: LevelMap): void {
  const seen = new Set<string>();
  const stack = [`${level.pac.x},${level.pac.y}`];
  seen.add(stack[0]);
  while (stack.length) {
    const [xs, ys] = stack.pop()!.split(",");
    const x = Number(xs);
    const y = Number(ys);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ny = y + dy;
      if (ny < 0 || ny >= level.height) continue;
      const nx = wrapX(x + dx, level.width);
      const cell = level.grid[ny][nx];
      if (cell === "wall" || cell === "door") continue;
      const key = `${nx},${ny}`;
      if (!seen.has(key)) {
        seen.add(key);
        stack.push(key);
      }
    }
  }
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const cell = level.grid[y][x];
      if ((cell === "dot" || cell === "power") && !seen.has(`${x},${y}`)) {
        throw new Error(`Pastilha isolada em ${x},${y}.`);
      }
    }
  }
}
