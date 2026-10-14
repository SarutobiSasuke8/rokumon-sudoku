import { afterEach, describe, expect, it, vi } from "vitest";
import { hub } from "../src/integrations/hub.js";

afterEach(() => vi.unstubAllGlobals());
describe("optional Rokumon API", () => {
  it("forwards ready, score, completion and its declared event", () => {
    const sdk = { ready: vi.fn(), score: vi.fn(), gameOver: vi.fn(), event: vi.fn() };
    vi.stubGlobal("window", { Hub: sdk });
    hub.ready(); hub.score(123); hub.gameOver(12, 5000);
    hub.event("puzzle-completed", { variant: "classic", difficulty: "novice", mode: "campaign" });
    expect(sdk.ready).toHaveBeenCalledOnce();
    expect(sdk.score).toHaveBeenCalledWith(123);
    expect(sdk.gameOver).toHaveBeenCalledWith(12, 5000);
    expect(sdk.event).toHaveBeenCalledWith("puzzle-completed", { variant: "classic", difficulty: "novice", mode: "campaign" });
  });
  it("does not throw with an absent or broken SDK", () => {
    vi.stubGlobal("window", {});
    expect(() => { hub.ready(); hub.score(124); hub.gameOver(0, 10); hub.event("puzzle-completed", {}); }).not.toThrow();
    vi.stubGlobal("window", { Hub: { ready: () => { throw Error("offline"); } } });
    expect(() => hub.ready()).not.toThrow();
  });
});
