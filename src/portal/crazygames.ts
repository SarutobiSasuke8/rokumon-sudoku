// CrazyGames HTML5 SDK v3 adapter (https://docs.crazygames.com/sdk/intro/).
// The SDK script tag is injected only by the crazygames build mode; if it is
// blocked or the environment is "disabled", init resolves false and the
// portal stays a no-op.
import type { AdKind, AdEvents, PortalAdapter } from "./index";

interface CrazyGamesSdk {
  init(): Promise<void>;
  environment: "local" | "crazygames" | "disabled" | string;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
  };
  ad: {
    requestAd(kind: AdKind, callbacks: { adStarted(): void; adFinished(): void; adError(error: unknown): void }): void;
  };
}

type CrazyGamesWindow = Window & { CrazyGames?: { SDK?: CrazyGamesSdk } };

export function crazyGamesAdapter(win: Window | undefined): PortalAdapter {
  let sdk: CrazyGamesSdk | undefined;
  return {
    name: "crazygames",
    async init() {
      const candidate = (win as CrazyGamesWindow | undefined)?.CrazyGames?.SDK;
      if (!candidate) return false;
      await candidate.init();
      if (candidate.environment === "disabled") return false;
      sdk = candidate;
      return true;
    },
    loadingStart: () => sdk?.game.loadingStart(),
    loadingStop: () => sdk?.game.loadingStop(),
    gameplayStart: () => sdk?.game.gameplayStart(),
    gameplayStop: () => sdk?.game.gameplayStop(),
    showAd(kind: AdKind, events: AdEvents) {
      if (!sdk) throw new Error("CrazyGames SDK not initialised");
      sdk.ad.requestAd(kind, {
        adStarted: events.started,
        adFinished: events.finished,
        adError: events.error,
      });
    },
  };
}
