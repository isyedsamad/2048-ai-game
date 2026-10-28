"use client";

import React from "react";
import { AdviceResult, AdvisorSettings, ProfileName } from "@/lib/expectimax";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RefreshCw, Cpu, Layers, Clock, Activity, Target } from "lucide-react";

interface AdvisorViewProps {
  advice: AdviceResult | null;
  settings: AdvisorSettings;
  onUpdateSettings: (settings: AdvisorSettings) => void;
  isAnalyzing: boolean;
}

const DIRECTION_ICONS: Record<string, React.ReactNode> = {
  up: <ArrowUp className="w-5 h-5" />,
  down: <ArrowDown className="w-5 h-5" />,
  left: <ArrowLeft className="w-5 h-5" />,
  right: <ArrowRight className="w-5 h-5" />,
};

export default function AdvisorView({
  advice,
  settings,
  onUpdateSettings,
  isAnalyzing,
}: AdvisorViewProps) {
  const maxAlternativeVal =
    advice?.alternatives && advice.alternatives.length > 0
      ? Math.max(...advice.alternatives.map((a) => a.value))
      : 1;

  const minAlternativeVal =
    advice?.alternatives && advice.alternatives.length > 0
      ? Math.min(...advice.alternatives.map((a) => a.value))
      : 0;

  const range = Math.max(1, maxAlternativeVal - minAlternativeVal);

  return (
    <div className="flex flex-col gap-5 px-5 pt-3 pb-5 bg-white border border-zinc-200/80 rounded-lg shadow-xs text-zinc-900">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
        <div>
          <span className="text-xs uppercase font-bold text-[#c76628] tracking-wider">
            Decision Strategy Analysis
          </span>
          <p className="text-xs text-zinc-500">
            Expectimax search tree evaluating probabilistic spawns
          </p>
        </div>
        {isAnalyzing && (
          <span className="flex items-center gap-1.5 text-xs text-[#c76628] font-bold bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Analyzing...
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col justify-between p-5 rounded-xl bg-orange-50/40 border border-orange-100">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#c76628] uppercase tracking-wider text-[11px]">
              Optimal Move Choice
            </span>
            {/* <span className="font-mono text-[10px] text-zinc-500 bg-white px-2 py-0.5 rounded border border-orange-200 capitalize">
              Cutoff: {advice?.cutoff || "idle"}
            </span> */}
          </div>

          <div className="flex items-center gap-4 my-3">
            <div className="w-14 h-14 rounded-lg bg-[#c76628] text-white flex items-center justify-center font-black text-2xl shadow-sm">
              {advice?.bestMove ? DIRECTION_ICONS[advice.bestMove] : "-"}
            </div>
            <div>
              <div className="text-2xl font-black uppercase tracking- text-zinc-900">
                {advice?.bestMove ? advice.bestMove : "Awaiting move"}
              </div>
              <div className="text-xs font-semibold text-zinc-500">
                Expected Score: <span className="font-mono font-bold text-zinc-800">{advice?.estimatedValue !== null && advice?.estimatedValue !== undefined ? Math.round(advice.estimatedValue).toLocaleString() : "—"}</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 leading-normal">
            Selected by maximizing chance-node expectations across all valid directions.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {/* <div className="px-4 pt-2 pb-1 rounded-sm bg-blue-50/40 border border-blue-100 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-1 text-[11px] text-blue-700 font-medium">
              <span>Depth</span>
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-black text-zinc-900 mt-0.5">
              {advice?.depthReached ?? 0} <span className="text-xs font-normal text-zinc-500">plies</span>
            </span>
          </div>

          <div className="px-4 pt-2 pb-1 rounded-sm bg-emerald-50/40 border border-emerald-100 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-1 text-[11px] text-emerald-700 font-medium">
              <span>Elapsed</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-black text-zinc-900 mt-0.5">
              {advice?.elapsedMs ?? 0} <span className="text-xs font-normal text-zinc-500">ms</span>
            </span>
          </div> */}

          <div className="px-5 pt-2 pb-1 rounded-sm bg-purple-50/40 border border-purple-100 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-1 text-[11px] text-purple-700 font-medium">
              <span>Nodes</span>
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-black text-zinc-900 mt-0.5">
              {advice?.expandedNodes?.toLocaleString() ?? 0}
            </span>
          </div>

          <div className="px-5 pt-2 pb-1 rounded-sm bg-blue-50/40 border border-blue-100 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-1 text-[11px] text-blue-700 font-medium">
              <span>Chance Outcomes</span>
              <Activity className="w-3.5 h-3.5" />
            </div>
            <span className="text-lg font-black text-zinc-900 mt-0.5">
              {advice?.chanceOutcomes?.toLocaleString() ?? 0}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-5 py-4 pb-5 rounded-xl border border-zinc-200/80 bg-zinc-50/50">
        <span className="text-xs uppercase font-bold text-[#c76628] tracking-wider">
          Legal Direction Rankings
        </span>
        <div className="flex flex-col gap-2.5 mt-1">
          {advice?.alternatives && advice.alternatives.length > 0 ? (
            advice.alternatives.map((alt, i) => {
              if (i > 1) return;
              const pct = Math.max(8, Math.round(((alt.value - minAlternativeVal) / range) * 100));
              const isBest = alt.move === advice.bestMove;

              return (
                <div key={alt.move} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 flex items-center justify-center rounded text-[11px] ${isBest ? "bg-[#c76628] text-white font-bold" : "bg-zinc-200 text-zinc-600"}`}>
                        {DIRECTION_ICONS[alt.move]}
                      </span>
                      <span className={`font-bold uppercase ${isBest ? "text-[#c76628]" : "text-zinc-700"}`}>
                        {alt.move} {isBest && "• Best Pick"}
                      </span>
                    </div>
                    <span className="font-mono text-zinc-600 text-xs font-semibold">
                      {Math.round(alt.value).toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${isBest ? "bg-[#c76628]" : "bg-zinc-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-zinc-400 py-1">No legal moves available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
