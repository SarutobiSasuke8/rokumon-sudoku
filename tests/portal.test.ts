import { describe, expect, it, vi } from "vitest";
import { createPortal, selectAdapter, type AdHooks } from "../src/portal";

type Callbacks = { adStarted(): void; adFinished(): void; adError(error: unknown): void };

function stubSdk(environment = "crazygames") {
  const ads: { kind: string; callbacks: Callbacks }[] = [];
  const sdk = {
    environment,
    init: vi.fn(async () => {}),
    game: { loadingStart: vi.fn(), loadingStop: vi.fn(), gameplayStart: vi.fn(), gameplayStop: vi.fn() },
    ad: { requestAd: vi.fn((kind: string, callbacks: Callbacks) => { ads.push({ kind, callbacks }); }) },
  };
  return { sdk, ads, win: { CrazyGames: { SDK: sdk } } as unknown as Window };
}

function recorder() {
  const log: string[] = [];
  const state = { paused: false, muted: false, inputBlocked: false };
  const hooks: AdHooks = {
    pause: () => { log.push("pause"); state.paused = true; state.inputBlocked = true; },
    mute: () => { log.push("mute"); state.muted = true; },
    unmute: () => { log.push("unmute"); state.muted = false; },
    resume: () => { log.push("resume"); state.paused = false; state.inputBlocked = false; },
  };
  return { log, state, hooks };
}

async function crazyPortal(environment?: string) {
  const stub = stubSdk(environment);
  const rec = recorder();
  const portal = createPortal(selectAdapter("crazygames", stub.win), rec.hooks);
  await portal.init();
  return { ...stub, ...rec, portal };
}

describe("CrazyGames portal adapter with a stubbed SDK", () => {
  it("pauses and blocks input on request, mutes only on adStarted, resumes on adFinished", async () => {
    const { portal, ads, state, log } = await crazyPortal();
    expect(portal.active).toBe(true);
    const result = portal.requestMidgameAd();
    expect(ads[0].kind).toBe("midgame");
    expect(state).toEqual({ paused: true, muted: false, inputBlocked: true });
    ads[0].callbacks.adStarted();
    expect(state.muted).toBe(true);
    ads[0].callbacks.adFinished();
    await expect(result).resolves.toBe("finished");
    expect(state).toEqual({ paused: false, muted: false, inputBlocked: false });
    expect(log).toEqual(["pause", "mute", "unmute", "resume"]);
  });

  it("resumes on adError before the ad starts, without ever muting", async () => {
    const { portal, ads, state, log } = await crazyPortal();
    const result = portal.requestRewardedAd();
    expect(ads[0].kind).toBe("rewarded");
    ads[0].callbacks.adError({ code: "adsDisabledBasicLaunch", message: "Ads are disabled" });
    await expect(result).resolves.toBe("error");
    expect(state).toEqual({ paused: false, muted: false, inputBlocked: false });
    expect(log).toEqual(["pause", "resume"]);
  });

  it("resumes and unmutes on adError after the ad started, and ignores late callbacks", async () => {
    const { portal, ads, state, log } = await crazyPortal();
    const result = portal.requestMidgameAd();
    ads[0].callbacks.adStarted();
    ads[0].callbacks.adError({ code: "other" });
    ads[0].callbacks.adFinished();
    ads[0].callbacks.adStarted();
    await expect(result).resolves.toBe("error");
    expect(state).toEqual({ paused: false, muted: false, inputBlocked: false });
    expect(log).toEqual(["pause", "mute", "unmute", "resume"]);
  });

  it("does not stack a second ad while one is open", async () => {
    const { portal, ads } = await crazyPortal();
    void portal.requestMidgameAd();
    await expect(portal.requestMidgameAd()).resolves.toBe("unavailable");
    expect(ads).toHaveLength(1);
  });

  it("resumes if the SDK throws synchronously on requestAd", async () => {
    const { portal, sdk, state } = await crazyPortal();
    sdk.ad.requestAd.mockImplementationOnce(() => { throw new Error("boom"); });
    await expect(portal.requestMidgameAd()).resolves.toBe("error");
    expect(state.paused).toBe(false);
  });

  it("forwards loading and de-duplicated gameplay events, reporting gameplay only after loading stops", async () => {
    const { portal, sdk } = await crazyPortal();
    const order: string[] = [];
    for (const name of ["loadingStart", "loadingStop", "gameplayStart", "gameplayStop"] as const) sdk.game[name].mockImplementation(() => { order.push(name); });
    portal.loadingStart();
    portal.gameplayStart();
    portal.loadingStop();
    portal.gameplayStart();
    portal.gameplayStop();
    portal.gameplayStop();
    portal.gameplayStart();
    expect(order).toEqual(["loadingStart", "loadingStop", "gameplayStart", "gameplayStop", "gameplayStart"]);
  });
});

describe("portal without a usable SDK", () => {
  const cases: [string, () => Promise<{ portal: ReturnType<typeof createPortal>; log: string[] }>][] = [
    ["no portal build flag", async () => { const rec = recorder(); const portal = createPortal(selectAdapter("production", stubSdk().win), rec.hooks); await portal.init(); return { portal, log: rec.log }; }],
    ["SDK blocked (ad blocker)", async () => { const rec = recorder(); const portal = createPortal(selectAdapter("crazygames", {} as Window), rec.hooks); await portal.init(); return { portal, log: rec.log }; }],
    ["SDK environment disabled", async () => { const { portal, log } = await crazyPortal("disabled"); return { portal, log }; }],
    ["SDK init rejects", async () => {
      const stub = stubSdk(); stub.sdk.init.mockRejectedValueOnce(new Error("offline"));
      const rec = recorder(); const portal = createPortal(selectAdapter("crazygames", stub.win), rec.hooks); await portal.init(); return { portal, log: rec.log };
    }],
  ];

  it.each(cases)("%s: every call is a no-op and the game never pauses", async (_label, make) => {
    const { portal, log } = await make();
    expect(portal.active).toBe(false);
    expect(portal.name).toBe("none");
    expect(() => { portal.loadingStart(); portal.loadingStop(); portal.gameplayStart(); portal.gameplayStop(); }).not.toThrow();
    await expect(portal.requestMidgameAd()).resolves.toBe("unavailable");
    await expect(portal.requestRewardedAd()).resolves.toBe("unavailable");
    expect(log).toEqual([]);
  });

  it("does not call the SDK when the build flag is off, even if the SDK is on the page", async () => {
    const stub = stubSdk();
    const portal = createPortal(selectAdapter("production", stub.win), recorder().hooks);
    await portal.init();
    portal.gameplayStart();
    expect(stub.sdk.init).not.toHaveBeenCalled();
    expect(stub.sdk.game.gameplayStart).not.toHaveBeenCalled();
  });
});
