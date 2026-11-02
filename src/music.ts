import { MUSIC_TRACKS } from "./music-tracks";

export class MusicPlaylist {
  private player: HTMLAudioElement | null = null;
  private active = false;
  private paused = false;
  private index = 0;
  private request = 0;
  enabled = true;
  volume = 0.22;
  status = "Ready";
  onChange = () => {};

  constructor(private storageKey: string) {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (typeof saved?.enabled === "boolean") this.enabled = saved.enabled;
      if (typeof saved?.volume === "number" && Number.isFinite(saved.volume)) this.volume = Math.max(0, Math.min(1, saved.volume));
    } catch { /* Storage can be unavailable in private browsing. */ }
    document.addEventListener("visibilitychange", () => this.sync());
    window.addEventListener("pagehide", () => this.player?.pause());
    window.addEventListener("pageshow", () => this.sync());
  }

  get title(): string { return MUSIC_TRACKS[this.index].title; }

  unlock(): void { this.active = true; this.sync(); }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.save();
    this.sync();
  }

  setPaused(paused: boolean): void { this.paused = paused; this.sync(); }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.player) this.player.volume = this.volume;
    this.save();
    this.onChange();
  }

  next(): void {
    this.index = (this.index + 1) % MUSIC_TRACKS.length;
    this.request++;
    if (this.player) {
      this.player.pause();
      this.player.src = MUSIC_TRACKS[this.index].url;
    }
    this.status = "Ready";
    this.sync();
  }

  private sync(): void {
    const shouldPlay = this.active && this.enabled && !this.paused && !document.hidden;
    if (!shouldPlay) {
      this.request++;
      this.player?.pause();
      this.status = !this.enabled ? "Off" : this.active ? "Paused" : "Ready";
      this.onChange();
      return;
    }
    if (!this.player) {
      this.player = new Audio();
      this.player.preload = "none";
      this.player.src = MUSIC_TRACKS[this.index].url;
      this.player.addEventListener("ended", () => this.next());
      this.player.addEventListener("error", () => {
        this.status = "Unavailable. Try next track.";
        this.onChange();
      });
      // Kept in the DOM so native media state remains inspectable and accessible to QA.
      this.player.hidden = true;
      this.player.dataset.gameMusic = "true";
      document.body.append(this.player);
    }
    if (!this.player.paused || this.status === "Loading") return;
    this.player.volume = this.volume;
    const request = ++this.request;
    this.status = "Loading";
    void this.player.play().then(() => {
      if (request !== this.request) return;
      this.status = "Playing";
      this.onChange();
    }).catch((error: unknown) => {
      if (request !== this.request) return;
      this.status = error instanceof DOMException && error.name === "NotAllowedError"
        ? "Press Music to play" : "Unavailable. Try next track.";
      this.onChange();
    });
    this.onChange();
  }

  private save(): void {
    try { localStorage.setItem(this.storageKey, JSON.stringify({ enabled: this.enabled, volume: this.volume })); }
    catch { /* Playback still works without persistence. */ }
  }
}

export const music = new MusicPlaylist("rokumon-sudoku-music-v1");
