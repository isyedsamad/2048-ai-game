import {
  Board,
  Direction,
  SpawnRule,
  slideAndMerge,
  getLegalMoves,
  getEmptyIndices,
} from "./gameEngine";

export type ProfileName = "balanced" | "corner" | "merge";

export type AdvisorSettings = {
  depthLimit: number;
  profile?: ProfileName;
  timeLimitMs: number;
  nodeLimit: number;
  showAlternatives?: boolean;
};

export type AdviceResult = {
  requestId: string;
  bestMove: Direction | null;
  alternatives: Array<{ move: Direction; value: number }>;
  estimatedValue: number | null;
  depthReached: number;
  expandedNodes: number;
  chanceOutcomes: number;
  elapsedMs: number;
  cutoff: "depth" | "time" | "nodes" | "terminal" | "no-legal-moves";
};

export type ProfileWeights = {
  empty: number;
  mono: number;
  smooth: number;
  corner: number;
  merge: number;
};

export const PROFILES: Record<ProfileName, ProfileWeights> = {
  balanced: {
    empty: 270,
    mono: 47,
    smooth: 12,
    corner: 700,
    merge: 150,
  },
  corner: {
    empty: 220,
    mono: 65,
    smooth: 10,
    corner: 1500,
    merge: 110,
  },
  merge: {
    empty: 240,
    mono: 35,
    smooth: 18,
    corner: 400,
    merge: 350,
  },
};

function tileLog(val: number): number {
  if (val === 0) return 0;
  return Math.log2(val);
}

export function evaluateFeatures(board: Board): {
  empty: number;
  mono: number;
  smooth: number;
  corner: number;
  merge: number;
} {
  let emptyCount = 0;
  let maxTile = 0;
  let maxIdx = 0;

  for (let i = 0; i < 16; i++) {
    const val = board[i];
    if (val === 0) {
      emptyCount++;
    } else {
      if (val > maxTile) {
        maxTile = val;
        maxIdx = i;
      }
    }
  }

  let smoothness = 0;
  let mergePotential = 0;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const idx = r * 4 + c;
      const val = board[idx];
      if (val === 0) continue;
      const logV = tileLog(val);

      if (c < 3) {
        const rightVal = board[idx + 1];
        if (rightVal !== 0) {
          smoothness -= Math.abs(logV - tileLog(rightVal));
          if (val === rightVal) mergePotential += logV;
        }
      }
      if (r < 3) {
        const downVal = board[idx + 4];
        if (downVal !== 0) {
          smoothness -= Math.abs(logV - tileLog(downVal));
          if (val === downVal) mergePotential += logV;
        }
      }
    }
  }

  let monoX1 = 0;
  let monoX2 = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const curr = tileLog(board[r * 4 + c]);
      const next = tileLog(board[r * 4 + c + 1]);
      if (curr > next) {
        monoX1 += next - curr;
      } else {
        monoX2 += curr - next;
      }
    }
  }

  let monoY1 = 0;
  let monoY2 = 0;
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 3; r++) {
      const curr = tileLog(board[r * 4 + c]);
      const next = tileLog(board[(r + 1) * 4 + c]);
      if (curr > next) {
        monoY1 += next - curr;
      } else {
        monoY2 += curr - next;
      }
    }
  }

  const mono = Math.max(monoX1, monoX2) + Math.max(monoY1, monoY2);

  const corners = [0, 3, 12, 15];
  let cornerBonus = 0;
  if (corners.includes(maxIdx)) {
    cornerBonus = tileLog(maxTile) * 10;
  }

  return {
    empty: emptyCount,
    mono,
    smooth: smoothness,
    corner: cornerBonus,
    merge: mergePotential,
  };
}

export function evaluateBoard(board: Board, weights: ProfileWeights): number {
  const f = evaluateFeatures(board);
  return (
    weights.empty * f.empty +
    weights.mono * f.mono +
    weights.smooth * f.smooth +
    weights.corner * f.corner +
    weights.merge * f.merge
  );
}

type SearchContext = {
  startTime: number;
  timeLimitMs: number;
  nodeLimit: number;
  nodeCount: number;
  chanceCount: number;
  aborted: boolean;
  weights: ProfileWeights;
  spawnRule: SpawnRule;
  cache: Map<string, number>;
};

function boardKey(board: Board, depth: number, isPlayer: boolean): string {
  return `${isPlayer ? "P" : "C"}:${depth}:${board.join(",")}`;
}

function expectimaxChance(
  board: Board,
  depth: number,
  ctx: SearchContext
): number {
  if (ctx.aborted) return 0;
  ctx.chanceCount++;

  const empties = getEmptyIndices(board);
  if (empties.length === 0 || depth <= 0) {
    return evaluateBoard(board, ctx.weights);
  }

  const cellProb = 1.0 / empties.length;
  let expectedValue = 0;

  for (const idx of empties) {
    for (const rule of ctx.spawnRule.values) {
      if (ctx.aborted) return 0;
      const nextBoard = [...board];
      nextBoard[idx] = rule.tile;
      const childVal = expectimaxPlayer(nextBoard, depth, ctx);
      expectedValue += cellProb * rule.probability * childVal;
    }
  }

  return expectedValue;
}

function expectimaxPlayer(
  board: Board,
  depth: number,
  ctx: SearchContext
): number {
  ctx.nodeCount++;
  if (ctx.nodeCount >= ctx.nodeLimit || performance.now() - ctx.startTime >= ctx.timeLimitMs) {
    ctx.aborted = true;
    return 0;
  }

  if (depth <= 0) {
    return evaluateBoard(board, ctx.weights);
  }

  const key = boardKey(board, depth, true);
  const cached = ctx.cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const legalMoves = getLegalMoves(board);
  if (legalMoves.length === 0) {
    return evaluateBoard(board, ctx.weights);
  }

  let maxVal = -Infinity;
  for (const move of legalMoves) {
    if (ctx.aborted) break;
    const { nextBoard } = slideAndMerge(board, move);
    const childVal = expectimaxChance(nextBoard, depth - 1, ctx);
    if (childVal > maxVal) {
      maxVal = childVal;
    }
  }

  if (!ctx.aborted) {
    ctx.cache.set(key, maxVal);
  }

  return maxVal;
}

export function searchBestMove(
  board: Board,
  settings: AdvisorSettings,
  spawnRule: SpawnRule,
  requestId: string
): AdviceResult {
  const startTime = performance.now();
  const legalMoves = getLegalMoves(board);

  if (legalMoves.length === 0) {
    return {
      requestId,
      bestMove: null,
      alternatives: [],
      estimatedValue: null,
      depthReached: 0,
      expandedNodes: 0,
      chanceOutcomes: 0,
      elapsedMs: performance.now() - startTime,
      cutoff: "no-legal-moves",
    };
  }

  const weights = (settings.profile && PROFILES[settings.profile]) || PROFILES.balanced;
  let lastCompletedResult: {
    bestMove: Direction | null;
    alternatives: Array<{ move: Direction; value: number }>;
    estimatedValue: number | null;
    depth: number;
    nodes: number;
    chance: number;
  } | null = null;

  let totalNodes = 0;
  let totalChance = 0;
  let cutoffReason: AdviceResult["cutoff"] = "depth";

  for (let d = 1; d <= settings.depthLimit; d++) {
    const ctx: SearchContext = {
      startTime,
      timeLimitMs: settings.timeLimitMs,
      nodeLimit: settings.nodeLimit,
      nodeCount: totalNodes,
      chanceCount: totalChance,
      aborted: false,
      weights,
      spawnRule,
      cache: new Map(),
    };

    const alternatives: Array<{ move: Direction; value: number }> = [];

    for (const move of legalMoves) {
      if (ctx.aborted) break;
      const { nextBoard } = slideAndMerge(board, move);
      const val = expectimaxChance(nextBoard, d - 1, ctx);
      if (!ctx.aborted) {
        alternatives.push({ move, value: val });
      }
    }

    totalNodes = ctx.nodeCount;
    totalChance = ctx.chanceCount;

    if (ctx.aborted) {
      if (totalNodes >= settings.nodeLimit) {
        cutoffReason = "nodes";
      } else {
        cutoffReason = "time";
      }
      break;
    }

    alternatives.sort((a, b) => b.value - a.value);

    lastCompletedResult = {
      bestMove: alternatives[0]?.move ?? null,
      alternatives,
      estimatedValue: alternatives[0]?.value ?? null,
      depth: d,
      nodes: totalNodes,
      chance: totalChance,
    };

    if (performance.now() - startTime >= settings.timeLimitMs) {
      cutoffReason = "time";
      break;
    }
  }

  const best = lastCompletedResult?.bestMove ?? legalMoves[0];
  const alternatives = lastCompletedResult?.alternatives ?? legalMoves.map((m) => ({ move: m, value: 0 }));
  const estimatedVal = lastCompletedResult?.estimatedValue ?? 0;
  const depthReached = lastCompletedResult?.depth ?? 1;

  return {
    requestId,
    bestMove: best,
    alternatives,
    estimatedValue: estimatedVal,
    depthReached,
    expandedNodes: totalNodes,
    chanceOutcomes: totalChance,
    elapsedMs: Math.round(performance.now() - startTime),
    cutoff: cutoffReason,
  };
}
