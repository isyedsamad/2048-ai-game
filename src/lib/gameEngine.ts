export type Direction = "up" | "down" | "left" | "right";
export type Board = number[];

export type SpawnRule = {
  values: Array<{ tile: 2 | 4; probability: number }>;
};

export type Challenge = {
  schemaVersion: 1;
  title: string;
  size: 4;
  target: 128 | 256 | 512 | 1024 | 2048;
  initialBoard: Board;
  seed: number;
  spawnRule: SpawnRule;
  moveLimit: number | null;
};

export type GameState = {
  board: Board;
  score: number;
  moveCount: number;
  won: boolean;
  over: boolean;
  rngState: number;
  undoStack: Array<{
    board: Board;
    score: number;
    moveCount: number;
    rngState: number;
  }>;
};

export type MoveResult = {
  nextBoard: Board;
  scoreDelta: number;
  changed: boolean;
};

export function sampleRng(seed: number): { value: number; nextSeed: number } {
  let s = (seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const val = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value: val, nextSeed: s };
}

export function compressLine(line: number[]): { newLine: number[]; scoreDelta: number; changed: boolean } {
  const filtered = line.filter((v) => v !== 0);
  const newLine: number[] = [];
  let scoreDelta = 0;
  let i = 0;

  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const mergedVal = filtered[i] * 2;
      newLine.push(mergedVal);
      scoreDelta += mergedVal;
      i += 2;
    } else {
      newLine.push(filtered[i]);
      i += 1;
    }
  }

  while (newLine.length < 4) {
    newLine.push(0);
  }

  let changed = false;
  for (let k = 0; k < 4; k++) {
    if (newLine[k] !== line[k]) {
      changed = true;
      break;
    }
  }

  return { newLine, scoreDelta, changed };
}

export function slideAndMerge(board: Board, direction: Direction): MoveResult {
  const nextBoard = [...board];
  let totalScoreDelta = 0;
  let anyChanged = false;

  if (direction === "left") {
    for (let r = 0; r < 4; r++) {
      const line = [board[r * 4], board[r * 4 + 1], board[r * 4 + 2], board[r * 4 + 3]];
      const { newLine, scoreDelta, changed } = compressLine(line);
      if (changed) anyChanged = true;
      totalScoreDelta += scoreDelta;
      for (let c = 0; c < 4; c++) {
        nextBoard[r * 4 + c] = newLine[c];
      }
    }
  } else if (direction === "right") {
    for (let r = 0; r < 4; r++) {
      const line = [board[r * 4 + 3], board[r * 4 + 2], board[r * 4 + 1], board[r * 4]];
      const { newLine, scoreDelta, changed } = compressLine(line);
      if (changed) anyChanged = true;
      totalScoreDelta += scoreDelta;
      for (let c = 0; c < 4; c++) {
        nextBoard[r * 4 + (3 - c)] = newLine[c];
      }
    }
  } else if (direction === "up") {
    for (let c = 0; c < 4; c++) {
      const line = [board[c], board[4 + c], board[8 + c], board[12 + c]];
      const { newLine, scoreDelta, changed } = compressLine(line);
      if (changed) anyChanged = true;
      totalScoreDelta += scoreDelta;
      for (let r = 0; r < 4; r++) {
        nextBoard[r * 4 + c] = newLine[r];
      }
    }
  } else if (direction === "down") {
    for (let c = 0; c < 4; c++) {
      const line = [board[12 + c], board[8 + c], board[4 + c], board[c]];
      const { newLine, scoreDelta, changed } = compressLine(line);
      if (changed) anyChanged = true;
      totalScoreDelta += scoreDelta;
      for (let r = 0; r < 4; r++) {
        nextBoard[(3 - r) * 4 + c] = newLine[r];
      }
    }
  }

  return { nextBoard, scoreDelta: totalScoreDelta, changed: anyChanged };
}

export function getLegalMoves(board: Board): Direction[] {
  const directions: Direction[] = ["up", "down", "left", "right"];
  return directions.filter((dir) => slideAndMerge(board, dir).changed);
}

export function checkTerminal(board: Board, target: number): { won: boolean; over: boolean } {
  let hasTarget = false;
  let hasEmpty = false;

  for (let i = 0; i < 16; i++) {
    if (board[i] >= target) {
      hasTarget = true;
    }
    if (board[i] === 0) {
      hasEmpty = true;
    }
  }

  if (hasEmpty) {
    return { won: hasTarget, over: false };
  }

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = board[r * 4 + c];
      if (c < 3 && val === board[r * 4 + c + 1]) return { won: hasTarget, over: false };
      if (r < 3 && val === board[(r + 1) * 4 + c]) return { won: hasTarget, over: false };
    }
  }

  return { won: hasTarget, over: true };
}

export function getEmptyIndices(board: Board): number[] {
  const indices: number[] = [];
  for (let i = 0; i < 16; i++) {
    if (board[i] === 0) indices.push(i);
  }
  return indices;
}

export function spawnTile(
  board: Board,
  spawnRule: SpawnRule,
  rngState: number
): { board: Board; rngState: number; spawned: { index: number; value: number } | null } {
  const empties = getEmptyIndices(board);
  if (empties.length === 0) {
    return { board: [...board], rngState, spawned: null };
  }

  const { value: randIdx, nextSeed: seed1 } = sampleRng(rngState);
  const cellIndex = empties[Math.floor(randIdx * empties.length)];

  const { value: randTile, nextSeed: seed2 } = sampleRng(seed1);
  let cumulative = 0;
  let tileValue: 2 | 4 = 2;

  for (const item of spawnRule.values) {
    cumulative += item.probability;
    if (randTile <= cumulative) {
      tileValue = item.tile;
      break;
    }
  }

  const newBoard = [...board];
  newBoard[cellIndex] = tileValue;

  return {
    board: newBoard,
    rngState: seed2,
    spawned: { index: cellIndex, value: tileValue },
  };
}

export function createInitialBoard(seed: number, spawnRule: SpawnRule): { board: Board; rngState: number } {
  let board: Board = new Array(16).fill(0);
  let curRng = seed;
  const s1 = spawnTile(board, spawnRule, curRng);
  board = s1.board;
  curRng = s1.rngState;
  const s2 = spawnTile(board, spawnRule, curRng);
  board = s2.board;
  curRng = s2.rngState;
  return { board, rngState: curRng };
}

export const CLASSIC_SPAWN_RULE: SpawnRule = {
  values: [
    { tile: 2, probability: 0.9 },
    { tile: 4, probability: 0.1 },
  ],
};

export const PRESET_CHALLENGES: Challenge[] = [
  {
    schemaVersion: 1,
    title: "Classic 2048",
    size: 4,
    target: 2048,
    initialBoard: new Array(16).fill(0),
    seed: 42,
    spawnRule: CLASSIC_SPAWN_RULE,
    moveLimit: null,
  },
];

export function validateChallenge(challenge: Challenge): string | null {
  if (challenge.schemaVersion !== 1) return "Invalid schema version";
  if (challenge.size !== 4) return "Only 4x4 boards are supported";
  if (![128, 256, 512, 1024, 2048].includes(challenge.target)) return "Invalid target tile";
  if (!Array.isArray(challenge.initialBoard) || challenge.initialBoard.length !== 16) {
    return "Initial board must contain exactly 16 cells";
  }
  for (const cell of challenge.initialBoard) {
    if (cell < 0 || (cell !== 0 && (cell & (cell - 1)) !== 0)) {
      return "All tile values must be 0 or a power of two";
    }
  }
  const sumProb = challenge.spawnRule.values.reduce((acc, curr) => acc + curr.probability, 0);
  if (Math.abs(sumProb - 1.0) > 0.001) return "Spawn rule probabilities must sum to 1";
  return null;
}
