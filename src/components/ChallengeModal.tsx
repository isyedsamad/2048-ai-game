"use client";

import React, { useState } from "react";
import {
  Challenge,
  SpawnRule,
  CLASSIC_SPAWN_RULE,
  createInitialBoard,
  validateChallenge,
  Board,
} from "@/lib/gameEngine";
import { X, RefreshCw, Sliders } from "lucide-react";

interface ChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyChallenge: (challenge: Challenge) => void;
}

export const DEFAULT_RNG_SEED = 42;
export const DEFAULT_SPAWN_RULE: SpawnRule = CLASSIC_SPAWN_RULE;

const PALETTE_TILES = [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

export default function ChallengeModal({
  isOpen,
  onClose,
  onApplyChallenge,
}: ChallengeModalProps) {
  const [title, setTitle] = useState("Custom Challenge");
  const [target, setTarget] = useState<128 | 256 | 512 | 1024 | 2048>(2048);
  const [moveLimit, setMoveLimit] = useState<number | null>(null);
  const [board, setBoard] = useState<Board>(new Array(16).fill(0));
  const [selectedTile, setSelectedTile] = useState<number>(2);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateSeedBoard = () => {
    const { board: newBoard } = createInitialBoard(
      DEFAULT_RNG_SEED,
      DEFAULT_SPAWN_RULE
    );
    setBoard(newBoard);
  };

  const handleCellClick = (idx: number) => {
    const updated = [...board];
    updated[idx] = updated[idx] === selectedTile ? 0 : selectedTile;
    setBoard(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newChallenge: Challenge = {
      schemaVersion: 1,
      title: title.trim() || "Classic 2048",
      size: 4,
      target,
      initialBoard: board,
      seed: DEFAULT_RNG_SEED,
      spawnRule: DEFAULT_SPAWN_RULE,
      moveLimit: moveLimit && moveLimit > 0 ? moveLimit : null,
    };

    const err = validateChallenge(newChallenge);
    if (err) {
      setError(err);
      return;
    }

    onApplyChallenge(newChallenge);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white text-zinc-900 border border-zinc-200/90 rounded-xl shadow-2xl p-4 sm:p-6 z-50">
        <div className="flex items-center justify-between pb-3.5 sm:pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#c76628] flex items-center justify-center border border-orange-200 shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 leading-tight">
                Customize Challenge
              </h2>
              <p className="text-xs text-zinc-400 font-medium leading-none mt-0.5">
                Configure target goal, move limits, and starting board state
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-zinc-700">Target Tile</label>
              <select
                value={target}
                onChange={(e) => setTarget(parseInt(e.target.value) as any)}
                className="bg-white border border-zinc-200 rounded-xl px-3 py-3 text-xs font-semibold text-zinc-800 focus:outline-none focus:border-[#c76628] focus:ring-1 focus:ring-[#c76628] shadow-xs"
              >
                {[128, 256, 512, 1024, 2048].map((t) => (
                  <option key={t} value={t}>
                    {t} Tile
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-zinc-700">Moves Allowed</label>
              <input
                type="number"
                min={0}
                max={500}
                value={moveLimit || 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setMoveLimit(val > 0 ? val : null);
                }}
                className="bg-white border border-zinc-200 rounded-xl px-3 py-3 text-xs font-semibold text-zinc-800 focus:outline-none focus:border-[#c76628] focus:ring-1 focus:ring-[#c76628] shadow-xs"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 p-4 bg-zinc-50 border border-zinc-200/80 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800">Starting Palette</span>
              <button
                type="button"
                onClick={handleGenerateSeedBoard}
                className="flex items-center gap-1 text-[11px] font-bold text-[#c76628] hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                Initial Board
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5 w-44 mx-auto my-1 aspect-square bg-[#c8b9ab] p-2 rounded-xl shadow-inner border border-[#bcaea0]">
              {board.map((val, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCellClick(idx)}
                  className={`flex items-center justify-center rounded-lg cursor-pointer text-xs font-black transition-all shadow-xs ${val === 0 ? "bg-[#e2d6c9] text-transparent" : "bg-[#c76628] text-white"}`}
                >
                  {val !== 0 ? val : "."}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2.5 border-t border-zinc-200/80">
              <span className="text-[10px] font-bold text-zinc-400 mr-1 uppercase">Palette:</span>
              {PALETTE_TILES.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setSelectedTile(t)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${selectedTile === t ? "bg-[#c76628] text-white border-[#c76628] shadow-xs" : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100"}`}
                >
                  {t === 0 ? "Empty" : t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition-colors shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-md bg-[#c76628] hover:bg-[#b05820] text-white text-xs font-bold transition-all shadow-xs"
            >
              Apply Challenge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
