"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { Board, Direction } from "@/lib/gameEngine";

interface GameBoardProps {
  board: Board;
  onMove?: (direction: Direction) => void;
  readOnly?: boolean;
}

const TILE_STYLES: Record<number, { bg: string; text: string; shadow: string }> = {
  0: { bg: "bg-[#e2d6c9]", text: "text-transparent", shadow: "inset 0 2px 4px rgba(0,0,0,0.06)" },
  2: { bg: "bg-[#fef3c7]", text: "text-[#78350f] font-black", shadow: "0 2px 4px rgba(0,0,0,0.06)" },
  4: { bg: "bg-[#fde68a]", text: "text-[#78350f] font-black", shadow: "0 2px 4px rgba(0,0,0,0.06)" },
  8: { bg: "bg-[#fb923c]", text: "text-white font-black", shadow: "0 4px 8px rgba(251,146,60,0.3)" },
  16: { bg: "bg-[#f97316]", text: "text-white font-black", shadow: "0 4px 10px rgba(249,115,22,0.35)" },
  32: { bg: "bg-[#f43f5e]", text: "text-white font-black", shadow: "0 4px 12px rgba(244,63,94,0.35)" },
  64: { bg: "bg-[#e11d48]", text: "text-white font-black", shadow: "0 6px 14px rgba(225,29,72,0.4)" },
  128: { bg: "bg-[#f59e0b]", text: "text-white font-black", shadow: "0 6px 16px rgba(245,158,11,0.45)" },
  256: { bg: "bg-[#eab308]", text: "text-white font-black", shadow: "0 6px 18px rgba(234,179,8,0.45)" },
  512: { bg: "bg-[#10b981]", text: "text-white font-black", shadow: "0 6px 18px rgba(16,185,129,0.45)" },
  1024: { bg: "bg-[#06b6d4]", text: "text-white font-black", shadow: "0 8px 20px rgba(6,182,212,0.5)" },
  2048: { bg: "bg-[#8b5cf6]", text: "text-white font-black", shadow: "0 8px 24px rgba(139,92,246,0.6)" },
};

export default function GameBoard({ board, onMove, readOnly = false }: GameBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (readOnly || !onMove) return;

      let dir: Direction | null = null;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dir = "up";
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") dir = "down";
      else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") dir = "left";
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") dir = "right";

      if (dir) {
        e.preventDefault();
        onMove(dir);
      }
    },
    [readOnly, onMove]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (readOnly || !onMove) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (readOnly || !onMove || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const threshold = 30;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      onMove(dx > 0 ? "right" : "left");
    } else {
      onMove(dy > 0 ? "down" : "up");
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={readOnly ? -1 : 0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative select-none outline-none touch-none aspect-square w-full max-w-[420px] mx-auto p-2.5 sm:p-4 bg-[#c8b9ab] rounded-xl sm:rounded-2xl shadow-none border-2 sm:border-4 border-[#bcaea0]"
    >
      <div className="grid grid-cols-4 grid-rows-4 gap-2 sm:gap-3 w-full h-full">
        {board.map((val, idx) => {
          const style = TILE_STYLES[val] || {
            bg: "bg-[#ec4899]",
            text: "text-white font-black",
            shadow: "0 8px 24px rgba(236,72,153,0.6)",
          };

          const fontSize =
            val > 999
              ? "text-xl sm:text-2xl md:text-3xl"
              : val > 99
                ? "text-2xl sm:text-3xl md:text-4xl"
                : "text-3xl sm:text-4xl md:text-5xl";

          return (
            <div
              key={idx}
              style={{ boxShadow: style.shadow }}
              className={`flex items-center justify-center rounded-lg sm:rounded-xl transition-all duration-100 ${style.bg} ${style.text}`}
            >
              {val !== 0 && (
                <span className={`${fontSize} leading-none tracking-tight animate-pop select-none drop-shadow-xs`}>
                  {val}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
