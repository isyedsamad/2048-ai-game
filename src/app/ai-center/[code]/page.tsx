"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import GameBoard from "@/components/GameBoard";
import AdvisorView from "@/components/AdvisorView";
import { subscribeLiveGame, LiveGameDocument } from "@/lib/firebase";
import {
  AdvisorSettings,
  AdviceResult,
  searchBestMove,
} from "@/lib/expectimax";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Radio,
  ChevronLeft,
  LayoutDashboard,
  BrainCircuit,
  Sparkles,
  PanelLeftClose,
  Trophy,
  Clock,
  Target,
} from "lucide-react";

export default function SpectatorAiCenterPage() {
  const params = useParams();
  const code = (params?.code as string) || "";

  const [gameDoc, setGameDoc] = useState<LiveGameDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<AdviceResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [settings, setSettings] = useState<AdvisorSettings>({
    depthLimit: 3,
    profile: "balanced",
    timeLimitMs: 1000,
    nodeLimit: 250000,
    showAlternatives: true,
  });

  const workerRef = useRef<Worker | null>(null);
  const currentRequestIdRef = useRef<string>("");

  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL("../../../workers/advisor.worker.ts", import.meta.url)
      );

      workerRef.current.onmessage = (event: MessageEvent<AdviceResult>) => {
        if (event.data.requestId === currentRequestIdRef.current) {
          setAdvice(event.data);
          setIsAnalyzing(false);
        }
      };
    } catch (e) {
      workerRef.current = null;
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const triggerAnalysis = useCallback(
    (board: number[], spawnRule: any, currentSettings: AdvisorSettings) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      currentRequestIdRef.current = requestId;
      setIsAnalyzing(true);

      if (workerRef.current) {
        workerRef.current.postMessage({
          requestId,
          board,
          settings: currentSettings,
          spawnRule,
        });
      } else {
        setTimeout(() => {
          const res = searchBestMove(board, currentSettings, spawnRule, requestId);
          if (currentRequestIdRef.current === requestId) {
            setAdvice(res);
            setIsAnalyzing(false);
          }
        }, 10);
      }
    },
    []
  );

  useEffect(() => {
    if (!code) return;

    setError(null);
    const unsubscribe = subscribeLiveGame(
      code,
      (docData) => {
        setGameDoc(docData);
        if (docData?.state?.board && docData?.challenge?.spawnRule) {
          triggerAnalysis(docData.state.board, docData.challenge.spawnRule, settings);
        }
      },
      (err) => {
        setError(err.message || "Unable to connect to live game");
      }
    );

    return () => {
      unsubscribe();
    };
  }, [code, triggerAnalysis, settings]);

  const handleUpdateSettings = (newSettings: AdvisorSettings) => {
    setSettings(newSettings);
    if (gameDoc?.state?.board && gameDoc?.challenge?.spawnRule) {
      triggerAnalysis(gameDoc.state.board, gameDoc.challenge.spawnRule, newSettings);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#fafafa] text-zinc-900">
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="py-3 px-6 border-b border-zinc-200/80 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-zinc-900 tracking-normal uppercase">
                  AI Strategy Center
                </h1>
                <span className="font-mono text-xs font-bold text-[#c76628] bg-orange-50 px-2.5 py-0.5 rounded-lg border border-orange-200">
                  {code}
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium">
                Real-time probabilistic Expectimax tree evaluation and move decision advisor.
              </p>
            </div>
          </div>

          {gameDoc && (
            <div className="flex items-center gap-3 text-xs bg-white px-3.5 py-2 rounded-xl border border-zinc-200/80 shadow-xs font-medium">
              <span className="text-zinc-500">Board Revision:</span>
              <span className="font-bold text-[#c76628]">
                #{gameDoc.state.revision}
              </span>
              <span className="text-zinc-300">|</span>
              <span className="text-zinc-500">Status:</span>
              <span className="font-bold uppercase text-emerald-600">
                {gameDoc.status}
              </span>
            </div>
          )}
        </header>

        <main className="flex-1 pt-5 pb-3 max-w-6xl w-full mx-auto flex flex-col gap-4">
          {error && !gameDoc ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white rounded-2xl border border-zinc-200/80 shadow-xs">
              <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
              <h2 className="text-lg font-bold text-zinc-900 mb-1">Session Not Found</h2>
              <p className="text-xs text-zinc-500 max-w-sm mb-5">
                {error}. Check the game code or ask the player to share their live session.
              </p>
              <Link
                href="/ai-center"
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#c76628] hover:bg-[#b05820] transition-colors shadow-xs"
              >
                Try Another Code
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="px-1 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border-emerald-200 shadow-sm relative overflow-hidden">
                  <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-0 z-10">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Score</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Trophy className="h-4 w-4 text-emerald-600" />
                    </div>
                  </CardHeader>
                  <CardContent className="z-10 ml-1 -mt-2">
                    <div className="text-3xl font-bold text-foreground tracking-tight">
                      {gameDoc?.state.score == 0 ? "--" : (gameDoc?.state.score?.toLocaleString() ?? "00")}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">Live player score</p>
                  </CardContent>
                </Card>

                <Card className="px-1 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent border-blue-200 shadow-sm relative overflow-hidden">
                  <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-0 z-10">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Moves</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                  </CardHeader>
                  <CardContent className="z-10 ml-1 -mt-2">
                    <div className="text-3xl font-bold text-foreground tracking-tight">
                      {gameDoc?.state.moveCount == 0 ? "--" : (gameDoc?.state.moveCount?.toString().padStart(2, "0") ?? "00")}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">Turns completed</p>
                  </CardContent>
                </Card>

                <Card className="px-1 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent border-amber-200 shadow-sm relative overflow-hidden">
                  <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-0 z-10">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Target Tile</CardTitle>
                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <Target className="h-4 w-4 text-amber-600" />
                    </div>
                  </CardHeader>
                  <CardContent className="z-10 ml-1 -mt-2">
                    <div className="text-3xl font-bold text-foreground tracking-tight">
                      {gameDoc?.challenge?.target ?? 2048}
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">Goal power of 2</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-5 bg-white p-3 rounded-lg border border-zinc-200/80 shadow-xs flex flex-col gap-4">
                  {/* <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <span className="text-xs uppercase font-bold text-[#c76628] tracking-wider">
                      Live Mirror Board
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      READ-ONLY
                    </span>
                  </div> */}
                  <div className="relative">
                    <GameBoard
                      board={gameDoc?.state.board ?? new Array(16).fill(0)}
                      readOnly={true}
                    />
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <AdvisorView
                    advice={advice}
                    settings={settings}
                    onUpdateSettings={handleUpdateSettings}
                    isAnalyzing={isAnalyzing}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
