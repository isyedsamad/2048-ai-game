import { searchBestMove, AdvisorSettings, AdviceResult } from "../lib/expectimax";
import { Board, SpawnRule } from "../lib/gameEngine";

export type WorkerRequest = {
  requestId: string;
  board: Board;
  settings: AdvisorSettings;
  spawnRule: SpawnRule;
};

addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const { requestId, board, settings, spawnRule } = event.data;
  const result: AdviceResult = searchBestMove(board, settings, spawnRule, requestId);
  postMessage(result);
});
