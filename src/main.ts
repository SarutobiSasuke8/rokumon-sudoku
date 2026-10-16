import Phaser from "phaser";
import "./style.css";
import { SudokuApp } from "./ui/app";
import { createPortal, selectAdapter } from "./portal";

class AmbientScene extends Phaser.Scene {
  private ink = 0x8f6f4a;

  create(): void {
    this.drawField();
    this.scale.on("resize", this.drawField, this);
    window.addEventListener("sudoku:celebrate", () => this.celebrate());
  }

  private drawField(): void {
    this.children.removeAll();
    const width = this.scale.width;
    const height = this.scale.height;
    const grid = this.add.graphics().setAlpha(0.11);
    grid.lineStyle(1, this.ink, 1);
    const unit = Math.max(44, Math.floor(Math.min(width, height) / 10));
    for (let x = -unit; x < width + unit; x += unit) grid.lineBetween(x, 0, x + height * 0.22, height);
    for (let y = 0; y < height + unit; y += unit) grid.lineBetween(0, y, width, y - width * 0.08);
    this.add.circle(width * 0.88, height * 0.12, Math.min(width, height) * 0.16).setStrokeStyle(2, this.ink, 0.12);
    this.add.circle(width * 0.88, height * 0.12, Math.min(width, height) * 0.11).setStrokeStyle(1, this.ink, 0.09);
  }

  private celebrate(): void {
    const colors = [0xb94b32, 0xc79542, 0x526b45, 0x3b5d7a];
    for (let index = 0; index < 28; index += 1) {
      const mote = this.add.rectangle(
        this.scale.width * (0.3 + Math.random() * 0.4),
        this.scale.height * 0.55,
        5 + Math.random() * 5,
        5 + Math.random() * 8,
        colors[index % colors.length],
        0.72,
      );
      this.tweens.add({
        targets: mote,
        x: mote.x + (Math.random() - 0.5) * this.scale.width * 0.55,
        y: mote.y - 100 - Math.random() * 260,
        angle: (Math.random() - 0.5) * 180,
        alpha: 0,
        duration: 650 + Math.random() * 450,
        ease: "Expo.Out",
        onComplete: () => mote.destroy(),
      });
    }
  }
}

// Optional web-portal SDK (CrazyGames build only). Without it every call is a no-op.
const portal = createPortal(selectAdapter(import.meta.env.MODE), {
  pause() {
    app.setAdBreak(true);
    game.pause();
    document.documentElement.dataset.adBreak = "paused";
  },
  mute() {
    game.sound.mute = true;
    document.documentElement.dataset.adBreak = "muted";
  },
  unmute() {
    game.sound.mute = false;
  },
  resume() {
    game.resume();
    app.setAdBreak(false);
    delete document.documentElement.dataset.adBreak;
  },
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "phaser-bg",
  width: window.innerWidth,
  height: window.innerHeight,
  transparent: true,
  render: { antialias: true },
  scale: { mode: Phaser.Scale.RESIZE },
  scene: [AmbientScene],
});

const app = new SudokuApp(document.querySelector<HTMLElement>("#app")!, portal);

void portal.init().then(() => {
  portal.loadingStart();
  app.mount();
  portal.loadingStop();
});
