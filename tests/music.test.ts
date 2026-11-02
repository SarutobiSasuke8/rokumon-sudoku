import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  src = "";
  volume = 1;
  preload = "";
  hidden = false;
  dataset: Record<string, string> = {};
  paused = true;
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  constructor() { super(); FakeAudio.instances.push(this); }
}

let MusicPlaylist: typeof import("../src/music").MusicPlaylist;
const page = Object.assign(new EventTarget(), { hidden: false, body: { append: vi.fn() } });
const store = new Map<string, string>();

beforeAll(async () => {
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
  ({ MusicPlaylist } = await import("../src/music"));
});

beforeEach(() => { store.clear(); FakeAudio.instances = []; page.hidden = false; });

describe("music playlist lifecycle", () => {
  it("does not fetch before input and advances using one player", async () => {
    const music = new MusicPlaylist("test");
    expect(FakeAudio.instances).toHaveLength(0);
    music.unlock();
    const player = FakeAudio.instances[0];
    await Promise.resolve();
    expect(player.paused).toBe(false);
    const first = player.src;
    player.dispatchEvent(new Event("ended"));
    expect(player.src).not.toBe(first);
    player.dispatchEvent(new Event("ended"));
    expect(player.src).toBe(first);
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it("keeps mute and game pause authoritative across visibility changes", () => {
    const music = new MusicPlaylist("test");
    music.unlock();
    const player = FakeAudio.instances[0];
    page.hidden = true;
    page.dispatchEvent(new Event("visibilitychange"));
    expect(player.paused).toBe(true);
    music.setPaused(true);
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));
    expect(player.paused).toBe(true);
    music.setPaused(false);
    expect(player.paused).toBe(false);
    music.setEnabled(false);
    music.next();
    music.unlock();
    expect(player.paused).toBe(true);
  });

  it("restores bounded volume and disabled preference", () => {
    const music = new MusicPlaylist("test");
    music.setVolume(0.37);
    music.setEnabled(false);
    const restored = new MusicPlaylist("test");
    expect(restored.volume).toBe(0.37);
    restored.unlock();
    expect(FakeAudio.instances).toHaveLength(0);
    restored.setVolume(3);
    expect(restored.volume).toBe(1);
    restored.setVolume(NaN);
    expect(restored.volume).toBe(1);
  });

  it("reports a failed asset without an endless retry loop", async () => {
    const music = new MusicPlaylist("test");
    music.unlock();
    await Promise.resolve();
    const player = FakeAudio.instances[0];
    player.dispatchEvent(new Event("error"));
    expect(music.status).toContain("Unavailable");
    expect(player.play).toHaveBeenCalledTimes(1);
    music.next();
    expect(player.play).toHaveBeenCalledTimes(2);
  });
});

 it("retries a blocked first attempt on later input without restarting playback", async () => {
    const music = new MusicPlaylist("retry");
    music.unlock();
    const player = FakeAudio.instances[0];
    await Promise.resolve();
    player.pause();
    player.play.mockRejectedValueOnce(new DOMException("Blocked", "NotAllowedError"));
    music.unlock();
    await Promise.resolve(); await Promise.resolve();
    expect(music.status).toBe("Press Music to play");
    music.unlock();
    await Promise.resolve();
    expect(player.paused).toBe(false);
    const calls = player.play.mock.calls.length;
    music.unlock();
    expect(player.play).toHaveBeenCalledTimes(calls);
 });
