// Portal-neutral adapter. The game talks only to `Portal`; each web portal
// (CrazyGames today, GameDistribution later) supplies a `PortalAdapter`.
// With no adapter, or an SDK that fails to load (ad blocker), every call is a
// no-op and ads resolve "unavailable" without pausing the game.
import { crazyGamesAdapter } from "./crazygames";

export type AdKind = "midgame" | "rewarded";
/** "finished" is the only result that may grant a rewarded-ad reward. */
export type AdResult = "finished" | "error" | "unavailable";

/** Game-side callbacks the portal drives during an ad break. */
export interface AdHooks {
  /** Ad requested: freeze the game loop and block all input. */
  pause(): void;
  /** Ad actually playing: silence game audio. */
  mute(): void;
  /** Ad over or failed: restore audio (only called after `mute`). */
  unmute(): void;
  /** Ad over or failed: unfreeze and accept input again. */
  resume(): void;
}

export interface AdEvents {
  started(): void;
  finished(): void;
  error(reason?: unknown): void;
}

/**
 * What a portal SDK must provide. Adapters translate SDK callbacks into
 * `AdEvents`; e.g. a GameDistribution adapter would map SDK_GAME_PAUSE to
 * `started` and SDK_GAME_START to `finished`, with no change to the game.
 */
export interface PortalAdapter {
  readonly name: string;
  /** Resolve true only when the SDK is present, initialised and usable. */
  init(): Promise<boolean>;
  loadingStart(): void;
  loadingStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  showAd(kind: AdKind, events: AdEvents): void;
}

export interface Portal {
  readonly name: string;
  readonly active: boolean;
  init(): Promise<void>;
  loadingStart(): void;
  loadingStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  requestMidgameAd(): Promise<AdResult>;
  requestRewardedAd(): Promise<AdResult>;
}

const INIT_TIMEOUT_MS = 5000;

function safely(action: () => void): void {
  try { action(); } catch { /* Portal failures must never break the puzzle. */ }
}

export function createPortal(adapter: PortalAdapter | null, hooks: AdHooks): Portal {
  let active = false;
  let playing = false;
  let loading = false;
  let adOpen = false;

  const call = (action: (sdk: PortalAdapter) => void) => {
    if (active && adapter) safely(() => action(adapter));
  };

  const requestAd = (kind: AdKind): Promise<AdResult> => {
    if (!active || !adapter || adOpen) return Promise.resolve("unavailable");
    adOpen = true;
    safely(() => hooks.pause());
    return new Promise((resolve) => {
      let muted = false;
      let settled = false;
      const end = (result: AdResult) => {
        if (settled) return;
        settled = true;
        if (muted) safely(() => hooks.unmute());
        safely(() => hooks.resume());
        adOpen = false;
        resolve(result);
      };
      try {
        adapter.showAd(kind, {
          started: () => {
            if (settled || muted) return;
            muted = true;
            safely(() => hooks.mute());
          },
          finished: () => end("finished"),
          error: () => end("error"),
        });
      } catch {
        end("error");
      }
    });
  };

  return {
    get name() { return active && adapter ? adapter.name : "none"; },
    get active() { return active; },
    async init() {
      if (!adapter) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), INIT_TIMEOUT_MS); });
      try {
        active = await Promise.race([adapter.init().catch(() => false), timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
    loadingStart() {
      if (loading) return;
      loading = true;
      call((sdk) => sdk.loadingStart());
    },
    loadingStop() {
      if (!loading) return;
      loading = false;
      call((sdk) => sdk.loadingStop());
      // Gameplay that became ready during loading is reported after it.
      if (playing) call((sdk) => sdk.gameplayStart());
    },
    gameplayStart() {
      if (playing) return;
      playing = true;
      if (!loading) call((sdk) => sdk.gameplayStart());
    },
    gameplayStop() {
      if (!playing) return;
      playing = false;
      if (!loading) call((sdk) => sdk.gameplayStop());
    },
    requestMidgameAd: () => requestAd("midgame"),
    requestRewardedAd: () => requestAd("rewarded"),
  };
}

/** Pick the adapter from the build flag (`vite build --mode crazygames`). */
export function selectAdapter(mode: string, win: Window | undefined = globalThis.window): PortalAdapter | null {
  if (mode === "crazygames") return crazyGamesAdapter(win);
  return null;
}
