import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  Firestore,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getAuth, signInAnonymously, Auth, User } from "firebase/auth";
import { Board, Challenge } from "./gameEngine";

export type LiveGameDocument = {
  schemaVersion: 1;
  ownerUid: string;
  status: "active" | "finished" | "closed";
  challenge: Challenge;
  state: {
    board: Board;
    score: number;
    moveCount: number;
    won: boolean;
    over: boolean;
    rngState: number;
    updatedAt: any;
    revision: number;
  };
  createdAt: any;
  expiresAt: any;
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { app, auth: auth!, db: db! };
}

export async function ensureAnonymousAuth(): Promise<User> {
  const { auth } = getFirebaseApp();
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export function generateGameCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function broadcastLocalUpdate(gameCode: string, docData: LiveGameDocument) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`live_game_${gameCode}`, JSON.stringify(docData));
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(`live_game_channel_${gameCode}`);
      bc.postMessage(docData);
      bc.close();
    }
  } catch (e) { }
}

export async function createLiveGame(
  gameCode: string,
  challenge: Challenge,
  initialBoard: Board,
  rngState: number
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  let ownerUid = "anonymous-player";
  let authError: string | null = null;

  try {
    const user = await ensureAnonymousAuth();
    ownerUid = user.uid;
  } catch (err: any) {
    authError = err?.message || "Anonymous sign-in failed";
  }

  const localDoc: LiveGameDocument = {
    schemaVersion: 1,
    ownerUid,
    status: "active",
    challenge,
    state: {
      board: initialBoard,
      score: 0,
      moveCount: 0,
      won: false,
      over: false,
      rngState,
      updatedAt: new Date().toISOString(),
      revision: 1,
    },
    createdAt: new Date().toISOString(),
    expiresAt: expiry.toISOString(),
  };

  broadcastLocalUpdate(gameCode, localDoc);

  try {
    const { db } = getFirebaseApp();
    const gameDocRef = doc(db, "liveGames", gameCode);

    const firestoreData: LiveGameDocument = {
      ...localDoc,
      state: {
        ...localDoc.state,
        updatedAt: serverTimestamp(),
      },
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiry),
    };

    await setDoc(gameDocRef, firestoreData);
    return { success: true };
  } catch (err: any) {
    if (authError) {
      return {
        success: true,
        error: `Firebase Note: ${authError}. Local sync active across tabs. To enable global sync, turn on Anonymous Sign-in in Firebase Console.`,
      };
    }
    return {
      success: true,
      error: `Firestore Note: ${err?.message || "Network issue"}. Local cross-tab sync active.`,
    };
  }
}

let coalescingTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUpdate: {
  gameCode: string;
  board: Board;
  score: number;
  moveCount: number;
  won: boolean;
  over: boolean;
  rngState: number;
  revision: number;
} | null = null;

async function flushPendingUpdate() {
  if (!pendingUpdate) return;
  const target = pendingUpdate;
  pendingUpdate = null;

  try {
    const stored = localStorage.getItem(`live_game_${target.gameCode}`);
    if (stored) {
      const parsed = JSON.parse(stored) as LiveGameDocument;
      parsed.state = {
        ...parsed.state,
        board: target.board,
        score: target.score,
        moveCount: target.moveCount,
        won: target.won,
        over: target.over,
        rngState: target.rngState,
        updatedAt: new Date().toISOString(),
        revision: target.revision,
      };
      broadcastLocalUpdate(target.gameCode, parsed);
    }
  } catch (e) { }

  try {
    const { db } = getFirebaseApp();
    const docRef = doc(db, "liveGames", target.gameCode);

    await setDoc(
      docRef,
      {
        state: {
          board: target.board,
          score: target.score,
          moveCount: target.moveCount,
          won: target.won,
          over: target.over,
          rngState: target.rngState,
          updatedAt: serverTimestamp(),
          revision: target.revision,
        },
      },
      { merge: true }
    );
  } catch (err) { }
}

export function coalescedGameUpdate(
  gameCode: string,
  state: {
    board: Board;
    score: number;
    moveCount: number;
    won: boolean;
    over: boolean;
    rngState: number;
    revision: number;
  }
) {
  pendingUpdate = { gameCode, ...state };
  if (coalescingTimer) {
    clearTimeout(coalescingTimer);
  }
  coalescingTimer = setTimeout(() => {
    flushPendingUpdate();
  }, 250);
}

export function subscribeLiveGame(
  gameCode: string,
  onUpdate: (doc: LiveGameDocument) => void,
  onError: (err: Error) => void
): () => void {
  let hasReceivedUpdate = false;

  const tryLocal = () => {
    try {
      const stored = localStorage.getItem(`live_game_${gameCode}`);
      if (stored) {
        const parsed = JSON.parse(stored) as LiveGameDocument;
        hasReceivedUpdate = true;
        onUpdate(parsed);
      }
    } catch (e) { }
  };

  tryLocal();

  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      bc = new BroadcastChannel(`live_game_channel_${gameCode}`);
      bc.onmessage = (event) => {
        if (event.data) {
          hasReceivedUpdate = true;
          onUpdate(event.data);
        }
      };
    } catch (e) { }
  }

  const storageHandler = (e: StorageEvent) => {
    if (e.key === `live_game_${gameCode}` && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        hasReceivedUpdate = true;
        onUpdate(parsed);
      } catch (err) { }
    }
  };
  window.addEventListener("storage", storageHandler);

  let unsubscribeFirestore = () => { };
  try {
    const { db } = getFirebaseApp();
    const docRef = doc(db, "liveGames", gameCode);

    unsubscribeFirestore = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          hasReceivedUpdate = true;
          onUpdate(snapshot.data() as LiveGameDocument);
        } else if (!hasReceivedUpdate) {
          tryLocal();
        }
      },
      (err) => {
        if (!hasReceivedUpdate) {
          tryLocal();
        }
      }
    );
  } catch (err: any) {
    if (!hasReceivedUpdate) {
      tryLocal();
    }
  }

  return () => {
    window.removeEventListener("storage", storageHandler);
    if (bc) bc.close();
    unsubscribeFirestore();
  };
}
