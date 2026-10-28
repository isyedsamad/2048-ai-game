"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import GameBoard from "@/components/GameBoard";
import ChallengeModal from "@/components/ChallengeModal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Board,
  Direction,
  Challenge,
  PRESET_CHALLENGES,
  createInitialBoard,
  slideAndMerge,
  spawnTile,
  checkTerminal,
  GameState,
} from "@/lib/gameEngine";
import {
  generateGameCode,
  createLiveGame,
  coalescedGameUpdate,
} from "@/lib/firebase";
import {
  RotateCcw,
  Undo2,
  Share2,
  Sliders,
  Trophy,
  Copy,
  Check,
  ExternalLink,
  Radio,
  Flame,
  LayoutDashboard,
  BrainCircuit,
  Sparkles,
  Award,
  ChevronLeft,
  Activity,
  Layers,
  Clock,
  Target,
  User,
  PanelLeftClose,
  Loader2,
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function GamePage() {
  const [challenge, setChallenge] = useState<Challenge>(PRESET_CHALLENGES[0]);
  const [gameState, setGameState] = useState<GameState>(() => {
    const { board, rngState } = createInitialBoard(
      PRESET_CHALLENGES[0].seed,
      PRESET_CHALLENGES[0].spawnRule
    );
    return {
      board,
      score: 0,
      moveCount: 0,
      won: false,
      over: false,
      rngState,
      undoStack: [],
    };
  });

  const [bestScore, setBestScore] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gameCode, setGameCode] = useState<string | null>(null);
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [keepPlayingAfterWin, setKeepPlayingAfterWin] = useState(false);
  const [revision, setRevision] = useState(1);

  useEffect(() => {
    const stored = localStorage.getItem("2048_best_score");
    if (stored) {
      setBestScore(parseInt(stored) || 0);
    }
  }, []);

  const startNewGame = useCallback((newChallenge: Challenge) => {
    let board: Board;
    let rngState: number;

    const hasNonZero = newChallenge.initialBoard.some((v) => v !== 0);
    if (hasNonZero) {
      board = [...newChallenge.initialBoard];
      rngState = newChallenge.seed;
    } else {
      const init = createInitialBoard(newChallenge.seed, newChallenge.spawnRule);
      board = init.board;
      rngState = init.rngState;
    }

    setChallenge(newChallenge);
    setGameState({
      board,
      score: 0,
      moveCount: 0,
      won: false,
      over: false,
      rngState,
      undoStack: [],
    });
    setKeepPlayingAfterWin(false);
    setRevision(1);

    if (gameCode) {
      coalescedGameUpdate(gameCode, {
        board,
        score: 0,
        moveCount: 0,
        won: false,
        over: false,
        rngState,
        revision: 1,
      });
    }
  }, [gameCode]);

  const handleMove = useCallback(
    (dir: Direction) => {
      if (gameState.over) return;
      if (gameState.won && !keepPlayingAfterWin) return;
      if (challenge.moveLimit && gameState.moveCount >= challenge.moveLimit) return;

      const { nextBoard, scoreDelta, changed } = slideAndMerge(gameState.board, dir);
      if (!changed) return;

      const newUndoStack = [
        ...gameState.undoStack.slice(-19),
        {
          board: gameState.board,
          score: gameState.score,
          moveCount: gameState.moveCount,
          rngState: gameState.rngState,
        },
      ];

      const spawnRes = spawnTile(nextBoard, challenge.spawnRule, gameState.rngState);
      const updatedBoard = spawnRes.board;
      const updatedRng = spawnRes.rngState;
      const newScore = gameState.score + scoreDelta;
      const newMoveCount = gameState.moveCount + 1;

      const terminal = checkTerminal(updatedBoard, challenge.target);
      const isOver = terminal.over || (challenge.moveLimit ? newMoveCount >= challenge.moveLimit : false);
      const isWon = terminal.won;

      if (newScore > bestScore) {
        setBestScore(newScore);
        localStorage.setItem("2048_best_score", newScore.toString());
      }

      const nextRev = revision + 1;
      setRevision(nextRev);

      setGameState({
        board: updatedBoard,
        score: newScore,
        moveCount: newMoveCount,
        won: isWon,
        over: isOver,
        rngState: updatedRng,
        undoStack: newUndoStack,
      });

      if (gameCode) {
        coalescedGameUpdate(gameCode, {
          board: updatedBoard,
          score: newScore,
          moveCount: newMoveCount,
          won: isWon,
          over: isOver,
          rngState: updatedRng,
          revision: nextRev,
        });
      }
    },
    [gameState, challenge, keepPlayingAfterWin, bestScore, revision, gameCode]
  );

  const handleUndo = () => {
    if (gameState.undoStack.length === 0) return;
    const prev = gameState.undoStack[gameState.undoStack.length - 1];
    const newStack = gameState.undoStack.slice(0, -1);
    const nextRev = revision + 1;
    setRevision(nextRev);

    setGameState({
      board: prev.board,
      score: prev.score,
      moveCount: prev.moveCount,
      won: false,
      over: false,
      rngState: prev.rngState,
      undoStack: newStack,
    });

    if (gameCode) {
      coalescedGameUpdate(gameCode, {
        board: prev.board,
        score: prev.score,
        moveCount: prev.moveCount,
        won: false,
        over: false,
        rngState: prev.rngState,
        revision: nextRev,
      });
    }
  };

  const handleCreateLiveSession = async () => {
    if (isCreatingSession) return;

    if (gameCode) {
      if (aiCenterUrl) {
        navigator.clipboard.writeText(aiCenterUrl);
        toast.info(`Session ${gameCode} is active. Link copied!`);
      }
      return;
    }

    setIsCreatingSession(true);
    setLiveNote(null);
    try {
      const newCode = generateGameCode();
      const res = await createLiveGame(
        newCode,
        challenge,
        gameState.board,
        gameState.rngState
      );

      if (res.success) {
        setGameCode(newCode);
        if (res.error) {
          setLiveNote(res.error);
        }
        toast.success(`Live session active! Code: ${newCode}`);
      } else {
        if (res.error) {
          setLiveNote(res.error);
        }
        toast.error(`Failed to start live session`);
      }
    } catch {
      toast.error("Failed to connect to live session");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const aiCenterUrl =
    typeof window !== "undefined" && gameCode
      ? `${window.location.origin}/ai-center/${gameCode}`
      : "";

  const handleCopyLink = () => {
    if (!aiCenterUrl) return;
    navigator.clipboard.writeText(aiCenterUrl);
    setIsCopied(true);
    toast.success("AI Center link copied to clipboard!", { autoClose: 2000 });
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen bg-[#fafafa] text-zinc-900">
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="py-3 px-3.5 sm:px-6 border-b border-zinc-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
          <div className="flex flex-col items-start justify-start">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-zinc-900 tracking-normal uppercase">
                CLASSIC 2048
              </h1>
              {gameCode ? (
                <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-bold uppercase tracking-wider">
                  LOCAL
                </span>
              )}
            </div>
            <p className="hidden md:block text-xs text-zinc-500 font-medium">
              Customizable 2048 strategy session with real-time AI Center observer.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCreateLiveSession}
              disabled={isCreatingSession}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-lg bg-[#c76628] hover:bg-[#b05820] disabled:opacity-75 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-xs"
            >
              {isCreatingSession ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{gameCode ? "Active" : "Go Live"}</span>
                </>
              )}
            </button>

            <button
              onClick={() => startNewGame(challenge)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
              <span>Restart</span>
            </button>

            <Link
              href="/ai-center"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg bg-orange-50 border border-orange-200/80 text-xs font-bold text-[#c76628] hover:bg-orange-100/60 transition-colors shadow-xs"
            >
              <Radio className="w-3.5 h-3.5 text-[#c76628]" />
              <span>AI Center</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 pt-3.5 sm:pt-5 pb-3 max-w-6xl w-full mx-auto flex flex-col gap-3 sm:gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <Card className="px-1 py-1 sm:py-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border-emerald-200 shadow-xs relative overflow-hidden">
              <div className="absolute right-0 top-0 h-16 w-16 sm:h-24 sm:w-24 translate-x-6 sm:translate-x-8 -translate-y-6 sm:-translate-y-8 bg-emerald-500/10 rounded-full blur-xl sm:blur-2xl pointer-events-none"></div>
              <CardHeader className="flex flex-row items-center sm:items-start justify-between space-y-0 p-2 sm:p-4 pb-0 z-10">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Score</CardTitle>
                <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent className="z-10 p-2 sm:p-4 pt-1 sm:pt-0 sm:-mt-5">
                <div className="text-xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {gameState.score == 0 ? "--" : gameState.score.toLocaleString()}
                </div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">Current points</p>
              </CardContent>
            </Card>

            <Card className="px-1 py-1 sm:py-0 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent border-violet-200 shadow-xs relative overflow-hidden">
              <div className="absolute right-0 top-0 h-16 w-16 sm:h-24 sm:w-24 translate-x-6 sm:translate-x-8 -translate-y-6 sm:-translate-y-8 bg-violet-500/10 rounded-full blur-xl sm:blur-2xl pointer-events-none"></div>
              <CardHeader className="flex flex-row items-center sm:items-start justify-between space-y-0 p-2 sm:p-4 pb-0 z-10">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Best Score</CardTitle>
                <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-violet-100 flex items-center justify-center">
                  <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600" />
                </div>
              </CardHeader>
              <CardContent className="z-10 p-2 sm:p-4 pt-1 sm:pt-0 sm:-mt-5">
                <div className="text-xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {bestScore == 0 ? "--" : bestScore.toLocaleString()}
                </div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">High record</p>
              </CardContent>
            </Card>

            <Card className="px-1 py-1 sm:py-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent border-blue-200 shadow-xs relative overflow-hidden">
              <div className="absolute right-0 top-0 h-16 w-16 sm:h-24 sm:w-24 translate-x-6 sm:translate-x-8 -translate-y-6 sm:-translate-y-8 bg-blue-500/10 rounded-full blur-xl sm:blur-2xl pointer-events-none"></div>
              <CardHeader className="flex flex-row items-center sm:items-start justify-between space-y-0 p-2 sm:p-4 pb-0 z-10">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Moves</CardTitle>
                <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent className="z-10 p-2 sm:p-4 pt-1 sm:pt-0 sm:-mt-5">
                <div className="text-xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {gameState.moveCount == 0 ? "--" : gameState.moveCount.toString().padStart(2, "0")}
                </div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">
                  {challenge.moveLimit ? `Limit: ${challenge.moveLimit}` : "Unlimited"}
                </p>
              </CardContent>
            </Card>

            <Card className="px-1 py-1 sm:py-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent border-amber-200 shadow-xs relative overflow-hidden">
              <div className="absolute right-0 top-0 h-16 w-16 sm:h-24 sm:w-24 translate-x-6 sm:translate-x-8 -translate-y-6 sm:-translate-y-8 bg-amber-500/10 rounded-full blur-xl sm:blur-2xl pointer-events-none"></div>
              <CardHeader className="flex flex-row items-center sm:items-start justify-between space-y-0 p-2 sm:p-4 pb-0 z-10">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Target Tile</CardTitle>
                <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
                </div>
              </CardHeader>
              <CardContent className="z-10 p-2 sm:p-4 pt-1 sm:pt-0 sm:-mt-5">
                <div className="text-xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {challenge.target}
                </div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">Goal tile</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
            <div className="lg:col-span-7 flex flex-col gap-2.5 sm:gap-4 bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-zinc-200/80 shadow-xs">
              <div className="relative w-full my-1 sm:my-2">
                <GameBoard board={gameState.board} onMove={handleMove} />

                {gameState.won && !keepPlayingAfterWin && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 sm:p-6 bg-white/95 backdrop-blur-xs rounded-xl sm:rounded-2xl text-center shadow-xl animate-fade-in border-2 border-emerald-400">
                    <Trophy className="w-10 h-10 sm:w-14 sm:h-14 text-emerald-500 mb-2 animate-bounce" />
                    <h2 className="text-xl sm:text-2xl font-black text-zinc-900 mb-1">Target Reached!</h2>
                    <p className="text-xs text-zinc-500 mb-3 sm:mb-4 max-w-xs">
                      Achieved {challenge.target} in {gameState.moveCount} moves with {gameState.score} points!
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setKeepPlayingAfterWin(true)}
                        className="px-3.5 py-2 sm:px-4 sm:py-2 rounded-lg text-xs font-bold text-white bg-[#c76628] hover:bg-[#b05820] transition-colors shadow-xs"
                      >
                        Keep Playing
                      </button>
                      <button
                        onClick={() => startNewGame(challenge)}
                        className="px-3.5 py-2 sm:px-4 sm:py-2 rounded-lg text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                      >
                        New Game
                      </button>
                    </div>
                  </div>
                )}

                {gameState.over && (!gameState.won || keepPlayingAfterWin) && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 sm:p-6 bg-white/95 backdrop-blur-xs rounded-xl sm:rounded-2xl text-center shadow-xl animate-fade-in border-2 border-rose-200">
                    <Flame className="w-10 h-10 sm:w-12 sm:h-12 text-[#c76628] mb-2" />
                    <h2 className="text-xl sm:text-2xl font-black text-zinc-900 mb-1">Game Over</h2>
                    <p className="text-xs text-zinc-500 mb-3 sm:mb-4">
                      {challenge.moveLimit && gameState.moveCount >= challenge.moveLimit
                        ? "Move budget reached!"
                        : "No legal moves remain on the board."}
                    </p>
                    <button
                      onClick={() => startNewGame(challenge)}
                      className="px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-[#c76628] hover:bg-[#b05820] transition-colors shadow-xs"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-3 sm:gap-4">
              {gameCode && (
                <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col gap-2.5 sm:gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                    <span className="text-xs uppercase font-bold text-[#c76628] tracking-wider">
                      Live Session Broadcast
                    </span>
                    {gameCode && (
                      <span className="font-mono text-xs font-bold text-[#c76628] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                        {gameCode}
                      </span>
                    )}
                  </div>

                  {gameCode && (
                    <div className="flex flex-col gap-3">
                      <p className="text-xs text-zinc-500">
                        Anyone with this link can watch the board update live in the AI Strategy Center.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={aiCenterUrl}
                          className="w-full bg-zinc-50 text-[11px] sm:text-xs text-zinc-800 px-3 py-2 rounded-lg border border-zinc-200 font-mono outline-none truncate"
                        />
                        <button
                          onClick={handleCopyLink}
                          className="p-2 bg-[#c76628] text-white rounded-lg hover:bg-[#b05820] transition-colors shadow-xs"
                          title="Copy link"
                        >
                          {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <Link
                          href={`/ai-center/${gameCode}`}
                          target="_blank"
                          className="p-2 bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-200 transition-colors"
                          title="Open AI Center"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                      {liveNote && (
                        <p className="text-[11px] text-zinc-500 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200">
                          {liveNote}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col gap-2.5 sm:gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <span className="text-xs uppercase font-bold text-[#c76628] tracking-wider">
                    Challenge Configuration
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">Rules V1</span>
                </div>

                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-zinc-50">
                    <span className="text-zinc-500">Challenge Mode</span>
                    <span className="font-bold text-zinc-800">{challenge.title}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-zinc-50">
                    <span className="text-zinc-500">Target Goal</span>
                    <span className="font-bold text-zinc-800">{challenge.target}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-zinc-500">Move Budget</span>
                    <span className="font-semibold text-zinc-700">
                      {challenge.moveLimit ? `${challenge.moveLimit} moves` : "Unlimited"}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between gap-2">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1.5 justify-center flex-1 py-2 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-semibold text-zinc-700 transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Customize</span>
                  </button>
                  <button
                    onClick={handleUndo}
                    disabled={gameState.undoStack.length === 0}
                    className="flex justify-center items-center gap-1.5 flex-1 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Undo ({gameState.undoStack.length})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ChallengeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApplyChallenge={startNewGame}
      />

      <ToastContainer
        position="top-right"
        autoClose={3000}
        closeOnClick
        theme="colored"
      />
    </div>
  );
}
