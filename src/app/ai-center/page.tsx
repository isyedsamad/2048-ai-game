"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Radio } from "lucide-react";

export default function AiCenterEntryPage() {
  const [code, setCode] = useState("");
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed) {
      router.push(`/ai-center/${trimmed}`);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-8 max-w-sm mx-auto text-center">
      <div className="w-full flex items-center justify-start mb-8">
        {/* <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Game
        </Link> */}
      </div>

      <div className="w-14 h-14 rounded-xl bg-secondary border border-border text-primary flex items-center justify-center mb-3">
        <Radio className="w-7 h-7" />
      </div>

      <h1 className="text-xl font-bold text-foreground tracking-tight mb-1">
        2048 - AI Center
      </h1>
      <p className="text-xs text-muted-foreground mb-6">
        Enter a 2048 game session code to inspect live board state and Expectimax move advice.
      </p>

      <form onSubmit={handleJoin} className="w-full flex flex-col gap-3">
        <input
          type="text"
          placeholder="Enter game code..."
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full bg-card border border-input rounded-lg px-4 py-2.5 text-sm text-center font-mono tracking-wider text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />

        <button
          type="submit"
          disabled={!code.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-primary-foreground transition-opacity"
        >
          <span>Connect to Live Game</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </main>
  );
}
