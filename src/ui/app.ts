import { hub } from "../integrations/hub.js";
import { createPortal, type Portal } from "../portal";
import { CAMPAIGN, DIFFICULTIES, MODES, VARIANTS } from "../game/presets";
import { calculateReward, cellSharesGroup, formatTime } from "../game/sudoku";
import { loadProgress, rankFor, saveProgress, setTheme } from "../game/store";
import { createSession, type Session } from "../game/session";
import { encodeActiveState, loadActiveState, saveActiveState } from "../game/sessionStore";
import type { Difficulty, GameMode, PlayerProgress, ThemeId, VariantId } from "../game/types";

const THEME_OPTIONS: { id: ThemeId; label: string }[] = [
  { id: "parchment", label: "Parchment" },
  { id: "midnight", label: "Midnight" },
  { id: "sakura", label: "Sakura" },
  { id: "moss", label: "Moss" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export class SudokuApp {
  private progress: PlayerProgress = loadProgress();
  private session!: Session;
  private timer?: number;
  private completionShown = false;
  private lastSaved = "";
  private restoreNotice?: string;
  private storageNotice?: string;
  private adBreak = false;
  private levelEnded = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly portal: Portal = createPortal(null, { pause() {}, mute() {}, unmute() {}, resume() {} }),
  ) {}

  /** Portal ad break: freeze the timer and block pointer and keyboard input. */
  setAdBreak(active: boolean): void {
    this.adBreak = active;
    this.root.inert = active;
    this.root.setAttribute("aria-busy", String(active));
    this.syncGameplay();
  }

  private syncGameplay(): void {
    const playing = !this.adBreak && this.session?.status === "playing" && !this.root.querySelector("dialog[open]");
    if (playing) this.portal.gameplayStart();
    else this.portal.gameplayStop();
  }

  mount(): void {
    const restored = loadActiveState(this.progress);
    this.restoreNotice = restored.notice;
    if (restored.state) {
      this.session = restored.state.session;
      this.progress = restored.state.progress;
    }
    setTheme(this.progress.theme);
    if (this.session) this.render();
    else this.startGame("classic", "wanderer", "quick");
    this.timer = window.setInterval(() => this.tick(), 1000);
    window.addEventListener("keydown", (event) => this.onKeyDown(event));
    // `inert` does not reach an open modal dialog (top layer), so swallow
    // input in the capture phase while a portal ad break is active.
    for (const type of ["click", "pointerdown", "keydown", "submit", "cancel"]) {
      this.root.addEventListener(type, (event) => {
        if (!this.adBreak) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);
    }
    window.addEventListener("pagehide", () => this.persistSession());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.persistSession();
    });
    hub.ready();
  }

  private persistSession(): boolean {
    const raw = encodeActiveState(this.session, this.progress);
    if (raw === this.lastSaved) return true;
    const saved = saveActiveState(this.session, this.progress);
    if (saved) {
      this.lastSaved = raw;
      this.storageNotice = undefined;
    } else this.storageNotice = "This browser could not save your puzzle. You can keep playing.";
    return saved;
  }

  private startCampaign(index: number): void {
    const safeIndex = Math.max(0, Math.min(index, this.progress.campaignUnlocked, CAMPAIGN.length - 1));
    const node = CAMPAIGN[safeIndex];
    this.session = createSession(node.variant, node.difficulty, "campaign", `campaign:${node.id}`, safeIndex);
    this.completionShown = false;
    this.render();
  }

  private startGame(variant: VariantId, difficulty: Difficulty, mode: GameMode): void {
    const seed = mode === "daily" ? `daily:${today()}` : `${mode}:${variant}:${difficulty}:${Date.now()}`;
    const chosenVariant = mode === "daily" ? "diagonal" : variant;
    const chosenDifficulty = mode === "daily" ? "adept" : difficulty;
    this.session = createSession(chosenVariant, chosenDifficulty, mode, seed);
    this.restoreNotice = undefined;
    this.completionShown = false;
    this.render();
  }

  private tick(): void {
    if (!this.session || this.adBreak || this.session.status !== "playing" || document.hidden || this.root.querySelector("dialog[open]")) return;
    this.session.elapsed += 1;
    if (this.session.mode === "sprint" && this.session.elapsed >= 300) {
      this.session.status = "failed";
      this.levelEnded = true;
      hub.gameOver(0, this.session.elapsed * 1000);
      this.render();
      return;
    }
    const timer = this.root.querySelector<HTMLElement>("[data-timer]");
    if (timer) timer.textContent = this.displayTime();
    if (this.session.elapsed % 5 === 0) this.persistSession();
  }

  private displayTime(): string {
    return this.session.mode === "sprint" ? formatTime(300 - this.session.elapsed) : formatTime(this.session.elapsed);
  }

  private remember(index: number): void {
    this.session.history.push({ index, entry: this.session.entries[index], notes: [...this.session.notes[index]] });
  }

  private enter(value: number): void {
    const { selected, generated } = this.session;
    if (selected < 0 || generated.puzzle[selected] !== 0 || this.session.status !== "playing") return;
    if (this.session.noteMode && this.session.entries[selected] !== 0) return;
    this.remember(selected);
    if (this.session.noteMode) {
      if (this.session.notes[selected].has(value)) this.session.notes[selected].delete(value);
      else this.session.notes[selected].add(value);
      this.render();
      return;
    }
    if (generated.solution[selected] !== value) {
      this.session.history.pop();
      this.session.mistakes += 1;
      this.session.errorIndex = selected;
      this.announce(`${value} conflicts with this cell. Try another digit.`);
      this.render();
      window.setTimeout(() => {
        if (this.session.errorIndex === selected) {
          this.session.errorIndex = undefined;
          this.render();
        }
      }, 520);
      return;
    }
    this.session.entries[selected] = value;
    this.session.notes[selected].clear();
    this.announce(`${value} placed.`);
    if (this.session.entries.every((entry, index) => entry === generated.solution[index])) this.complete();
    else this.render();
  }

  private erase(): void {
    const index = this.session.selected;
    if (index < 0 || this.session.generated.puzzle[index] !== 0 || this.session.status !== "playing") return;
    this.remember(index);
    this.session.entries[index] = 0;
    this.session.notes[index].clear();
    this.render();
  }

  private hint(): void {
    if (this.session.status !== "playing") return;
    let index = this.session.selected;
    if (index < 0 || this.session.entries[index] !== 0) index = this.session.entries.findIndex((value) => value === 0);
    if (index < 0) return;
    this.remember(index);
    this.session.entries[index] = this.session.generated.solution[index];
    this.session.notes[index].clear();
    this.session.selected = index;
    this.session.hints += 1;
    this.announce(`Hint placed ${this.session.entries[index]} in row ${Math.floor(index / this.session.generated.variant.size) + 1}.`);
    if (this.session.entries.every((entry, cell) => entry === this.session.generated.solution[cell])) this.complete();
    else this.render();
  }

  private undo(): void {
    if (this.session.status !== "playing") return;
    const previous = this.session.history.pop();
    if (!previous) return;
    this.session.entries[previous.index] = previous.entry;
    this.session.notes[previous.index] = new Set(previous.notes);
    this.session.selected = previous.index;
    this.render();
  }

  private complete(): void {
    if (this.session.status !== "playing") return;
    this.session.status = "complete";
    this.levelEnded = true;
    const reward = this.session.mode === "zen" ? 0 : calculateReward(this.session.rewardBase, this.session.elapsed, this.session.mistakes, this.session.hints);
    this.session.reward = reward;
    this.progress.points += reward;
    this.progress.solved += 1;
    const currentDate = today();
    if (this.progress.lastPlayedDate !== currentDate) {
      this.progress.streak = this.progress.lastPlayedDate === yesterday() ? this.progress.streak + 1 : 1;
      this.progress.lastPlayedDate = currentDate;
      this.progress.bestStreak = Math.max(this.progress.bestStreak, this.progress.streak);
    }
    if (this.session.campaignIndex !== undefined) {
      const node = CAMPAIGN[this.session.campaignIndex];
      if (!this.progress.completedNodes.includes(node.id)) this.progress.completedNodes.push(node.id);
      this.progress.campaignUnlocked = Math.min(CAMPAIGN.length - 1, Math.max(this.progress.campaignUnlocked, this.session.campaignIndex + 1));
    }
    // The terminal board and its earned progress are one localStorage write.
    // Keep the legacy mirror behind that checkpoint, so a failed active write
    // cannot leave an older playable board alongside newly awarded points.
    if (this.persistSession()) saveProgress(this.progress);
    hub.score(this.progress.points);
    hub.gameOver(reward, this.session.elapsed * 1000);
    hub.event("puzzle-completed", {
      mode: this.session.mode,
      variant: this.session.generated.variant.id,
      difficulty: this.session.generated.difficulty,
      reward,
      seconds: this.session.elapsed,
    });
    window.dispatchEvent(new Event("sudoku:celebrate"));
    this.render();
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.adBreak || this.root.querySelector("dialog[open]")) return;
    if (event.key >= "1" && event.key <= "9") {
      const value = Number(event.key);
      if (value <= this.session.generated.variant.size) this.enter(value);
    } else if (event.key === "Backspace" || event.key === "Delete") this.erase();
    else if (event.key.toLowerCase() === "n") {
      this.session.noteMode = !this.session.noteMode;
      this.render();
    } else if (event.key.toLowerCase() === "h") this.hint();
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") this.undo();
    else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const size = this.session.generated.variant.size;
      const delta = event.key === "ArrowUp" ? -size : event.key === "ArrowDown" ? size : event.key === "ArrowLeft" ? -1 : 1;
      this.session.selected = Math.max(0, Math.min(this.session.entries.length - 1, this.session.selected + delta));
      this.render();
    }
  }

  private announce(message: string): void {
    const announcer = document.querySelector<HTMLElement>("#announcer");
    if (announcer) announcer.textContent = message;
  }

  private nodeName(): string {
    if (this.session.campaignIndex !== undefined) return CAMPAIGN[this.session.campaignIndex].title;
    if (this.session.mode === "daily") return `Daily Trial · ${this.session.generated.seed.slice(6)}`;
    return MODES.find((mode) => mode.id === this.session.mode)?.label ?? "Puzzle";
  }

  private boardMarkup(): string {
    const { generated, entries, selected } = this.session;
    const selectedValue = selected >= 0 ? entries[selected] : 0;
    return entries.map((value, index) => {
      const row = Math.floor(index / generated.variant.size);
      const col = index % generated.variant.size;
      const classes = ["cell"];
      if (generated.puzzle[index] !== 0) classes.push("is-fixed");
      if (index === selected) classes.push("is-selected");
      else if (selected >= 0 && cellSharesGroup(index, selected, generated.variant)) classes.push("is-peer");
      if (value && value === selectedValue) classes.push("is-matched");
      if (index === this.session.errorIndex) classes.push("is-error");
      if ((col + 1) % generated.variant.boxCols === 0 && col < generated.variant.size - 1) classes.push("box-right");
      if ((row + 1) % generated.variant.boxRows === 0 && row < generated.variant.size - 1) classes.push("box-bottom");
      if (generated.variant.diagonal && (row === col || row + col === generated.variant.size - 1)) classes.push("is-diagonal");
      const notes = value === 0
        ? `<span class="notes" aria-hidden="true">${Array.from({ length: generated.variant.size }, (_, note) => `<i>${this.session.notes[index].has(note + 1) ? note + 1 : ""}</i>`).join("")}</span>`
        : `<span class="digit">${value}</span>`;
      const label = `Row ${row + 1}, column ${col + 1}${value ? `, ${value}` : ", empty"}`;
      return `<button class="${classes.join(" ")}" data-cell="${index}" data-value="${value}" aria-label="${label}" aria-pressed="${index === selected}">${notes}</button>`;
    }).join("");
  }

  private campaignMarkup(): string {
    return CAMPAIGN.map((node, index) => {
      const locked = index > this.progress.campaignUnlocked;
      const complete = this.progress.completedNodes.includes(node.id);
      const active = index === this.session.campaignIndex;
      return `<button class="trail-node ${complete ? "is-complete" : ""} ${active ? "is-active" : ""}" data-campaign="${index}" ${locked ? "disabled" : ""} aria-label="Gate ${node.gate}: ${node.title}${locked ? ", locked" : ""}">
        <span class="trail-node__mark">${locked ? "×" : complete ? "✓" : node.gate}</span>
        <span><b>${node.title}</b><small>${VARIANTS[node.variant].name} · ${node.difficulty}</small></span>
      </button>`;
    }).join("");
  }

  private render(): void {
    this.persistSession();
    const rank = rankFor(this.progress.points);
    const progressToNext = rank.next === this.progress.points ? 100 : Math.min(100, Math.round((this.progress.points / rank.next) * 100));
    const size = this.session.generated.variant.size;
    this.root.innerHTML = `
      <header class="nav-slab">
        <button class="brand" data-action="campaign" aria-label="Open campaign"><span class="brand__seal">六</span><span>ROKUMON<br><b>SUDOKU</b></span></button>
        <nav class="mode-nav" aria-label="Game modes">
          <button data-action="campaign" class="${this.session.mode === "campaign" ? "is-active" : ""}">Journey</button>
          <button data-action="daily" class="${this.session.mode === "daily" ? "is-active" : ""}">Daily</button>
          <button data-action="new">New puzzle</button>
        </nav>
        <button class="points-chip" data-action="themes" aria-label="Open themes"><span>${this.progress.points.toLocaleString()}</span><small>points · ${rank.title}</small></button>
      </header>
      <div class="game-shell reveal">
        <section class="play-space" aria-labelledby="puzzle-title">
          <div class="puzzle-heading">
            <div>
              <p>${this.session.mode === "campaign" ? `Gate ${CAMPAIGN[this.session.campaignIndex ?? 0].gate}` : this.session.generated.variant.name}</p>
              <h1 id="puzzle-title">${this.nodeName()}</h1>
            </div>
            <dl class="run-stats">
              <div><dt>Time</dt><dd data-timer>${this.displayTime()}</dd></div>
              <div><dt>${this.session.mode === "zen" ? "Mode" : "Mistakes"}</dt><dd>${this.session.mode === "zen" ? "Free" : this.session.mistakes}</dd></div>
            </dl>
          </div>
          <div class="board-wrap">
            <div class="board ${this.session.generated.variant.chromatic ? "is-chromatic" : ""}" style="--board-size:${size}" role="grid" aria-label="${this.session.generated.variant.name} Sudoku board">
              ${this.boardMarkup()}
            </div>
            <p class="rule-note">${this.session.generated.variant.description}</p>
            ${this.restoreNotice || this.storageNotice ? `<p class="rule-note" role="status">${this.storageNotice ?? this.restoreNotice}</p>` : ""}
          </div>
          <div class="number-pad" aria-label="Number input">
            ${Array.from({ length: size }, (_, index) => `<button data-number="${index + 1}" aria-label="Place ${index + 1}">${index + 1}</button>`).join("")}
          </div>
          <div class="tool-row">
            <button data-action="notes" aria-pressed="${this.session.noteMode}" class="${this.session.noteMode ? "is-active" : ""}"><span>N</span> Notes</button>
            <button data-action="undo" ${this.session.history.length ? "" : "disabled"}><span>↶</span> Undo</button>
            <button data-action="erase"><span>⌫</span> Erase</button>
            <button data-action="hint"><span>?</span> Hint</button>
          </div>
        </section>
        <aside class="journey-panel" aria-label="Player journey">
          <section class="rank-block">
            <p>Player path</p>
            <div class="rank-line"><strong>Level ${rank.level} · ${rank.title}</strong><span>${progressToNext}%</span></div>
            <div class="progress-track"><span style="--progress-scale:${progressToNext / 100}"></span></div>
            <dl><div><dt>Solved</dt><dd>${this.progress.solved}</dd></div><div><dt>Streak</dt><dd>${this.progress.streak}d</dd></div><div><dt>Open gate</dt><dd>${Math.min(6, CAMPAIGN[this.progress.campaignUnlocked].gate)}</dd></div></dl>
          </section>
          <section class="trail-block">
            <div class="panel-heading"><h2>The Six Gates</h2><button data-action="new">Quick create</button></div>
            <div class="trail">${this.campaignMarkup()}</div>
          </section>
        </aside>
      </div>
      <footer class="foot-marquee" aria-label="Game footer"><div class="foot-marquee__track" aria-hidden="true"><span>FOCUS · PATTERN · PATIENCE · PRECISION ·</span><span>FOCUS · PATTERN · PATIENCE · PRECISION ·</span></div><p class="visually-hidden">Rokumon Games · Sudoku with a path.</p></footer>
      ${this.dialogMarkup()}
    `;
    this.bindEvents();
    if (this.session.status !== "playing" && !this.completionShown) {
      this.completionShown = true;
      window.setTimeout(() => {
        this.root.querySelector<HTMLDialogElement>("#result-dialog")?.showModal();
        this.syncGameplay();
        // Natural break between puzzles. The portal enforces ad frequency.
        if (this.levelEnded) {
          this.levelEnded = false;
          void this.portal.requestMidgameAd();
        }
      }, 0);
    }
    this.syncGameplay();
  }

  private dialogMarkup(): string {
    const variantCards = Object.values(VARIANTS).map((variant) => `<label class="choice-card"><input type="radio" name="variant" value="${variant.id}" ${variant.id === "classic" ? "checked" : ""}><span><b>${variant.name}</b><small>${variant.description}</small></span></label>`).join("");
    const themes = THEME_OPTIONS.map((theme) => `<button class="theme-swatch" data-theme-choice="${theme.id}" aria-pressed="${this.progress.theme === theme.id}"><span></span>${theme.label}</button>`).join("");
    const nextNode = this.session.campaignIndex === undefined ? undefined : CAMPAIGN[this.session.campaignIndex + 1];
    return `
      <dialog id="new-dialog" class="game-dialog"><form method="dialog"><div class="dialog-heading"><div><p>Quick create</p><h2>Choose your trial</h2></div><button value="cancel" aria-label="Close">×</button></div>
        <fieldset><legend>Mode</legend><div class="mode-grid">${MODES.filter((mode) => mode.id !== "campaign" && mode.id !== "daily").map((mode) => `<label><input type="radio" name="mode" value="${mode.id}" ${mode.id === "quick" ? "checked" : ""}><span><b>${mode.label}</b><small>${mode.description}</small></span></label>`).join("")}</div></fieldset>
        <fieldset><legend>Board</legend><div class="choice-grid">${variantCards}</div></fieldset>
        <fieldset><legend>Difficulty</legend><div class="difficulty-row">${DIFFICULTIES.map((difficulty) => `<label><input type="radio" name="difficulty" value="${difficulty.id}" ${difficulty.id === "adept" ? "checked" : ""}><span>${difficulty.label}</span></label>`).join("")}</div></fieldset>
        <button class="primary-action" value="start" data-action="start-custom">Create puzzle</button>
      </form></dialog>
      <dialog id="theme-dialog" class="game-dialog theme-dialog"><form method="dialog"><div class="dialog-heading"><div><p>Board room</p><h2>Choose a theme</h2></div><button value="cancel" aria-label="Close">×</button></div><div class="theme-grid">${themes}</div></form></dialog>
      <dialog id="result-dialog" class="game-dialog result-dialog"><div class="result-mark">${this.session.status === "complete" ? "✓" : "×"}</div><p>${this.session.status === "complete" ? "Trial complete" : "The bell has sounded"}</p><h2>${this.session.status === "complete" ? this.nodeName() : "Sprint ended"}</h2><div class="result-score"><strong>${this.session.reward ?? 0}</strong><span>points earned</span></div><div class="result-actions">${nextNode ? `<button class="primary-action" data-next-campaign>Enter next gate</button>` : `<button class="primary-action" data-action="new">Create another</button>`}<button data-action="replay">Replay trial</button></div></dialog>
    `;
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLElement>("[data-cell]").forEach((cell) => cell.addEventListener("click", () => {
      this.session.selected = Number(cell.dataset.cell);
      this.render();
    }));
    this.root.querySelectorAll<HTMLElement>("[data-number]").forEach((button) => button.addEventListener("click", () => this.enter(Number(button.dataset.number))));
    this.root.querySelectorAll<HTMLElement>("[data-campaign]").forEach((button) => button.addEventListener("click", () => this.startCampaign(Number(button.dataset.campaign))));
    this.root.querySelectorAll<HTMLElement>("[data-action]").forEach((button) => button.addEventListener("click", (event) => {
      const action = button.dataset.action;
      if (action === "campaign") this.startCampaign(Math.min(this.progress.campaignUnlocked, CAMPAIGN.length - 1));
      if (action === "daily") this.startGame("diagonal", "adept", "daily");
      if (action === "new") {
        button.closest("dialog")?.close();
        this.root.querySelector<HTMLDialogElement>("#new-dialog")?.showModal();
        this.syncGameplay();
      }
      if (action === "themes") {
        this.root.querySelector<HTMLDialogElement>("#theme-dialog")?.showModal();
        this.syncGameplay();
      }
      if (action === "notes") { this.session.noteMode = !this.session.noteMode; this.render(); }
      if (action === "undo") this.undo();
      if (action === "erase") this.erase();
      if (action === "hint") this.hint();
      if (action === "replay") {
        if (this.session.mode === "campaign" && this.session.campaignIndex !== undefined) this.startCampaign(this.session.campaignIndex);
        else this.startGame(this.session.generated.variant.id, this.session.generated.difficulty, this.session.mode);
      }
      if (action === "start-custom") {
        event.preventDefault();
        const form = button.closest("form")!;
        const data = new FormData(form);
        this.startGame(data.get("variant") as VariantId, data.get("difficulty") as Difficulty, data.get("mode") as GameMode);
      }
    }));
    this.root.querySelectorAll<HTMLElement>("[data-theme-choice]").forEach((button) => button.addEventListener("click", () => {
      this.progress.theme = button.dataset.themeChoice as ThemeId;
      setTheme(this.progress.theme);
      if (this.persistSession()) saveProgress(this.progress);
      this.render();
    }));
    this.root.querySelector<HTMLElement>("[data-next-campaign]")?.addEventListener("click", () => this.startCampaign((this.session.campaignIndex ?? 0) + 1));
    this.root.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener("close", () => this.syncGameplay());
    });
  }
}
