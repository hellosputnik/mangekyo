import { type Configuration, type ExerciseKind } from "../engine/model";
import { pursuitPoint } from "./pursuit";
import { visualTargetRadius } from "./visual";
import { crowdingGeometry } from "./crowding";
export interface Exercise {
  initialize(): void;
  update(seconds: number, level: number): void;
  render(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void;
  answer?(choice: number): boolean;
  terminate(): void;
}
export class VisualExercise implements Exercise {
  private seconds = 0;
  private level = 0;
  private target = 0;
  private flankers = [0, 0];
  private running = false;
  constructor(
    private kind: ExerciseKind,
    private configuration: Configuration,
    private random: () => number = Math.random,
  ) {}
  initialize() {
    this.running = true;
    this.target = Math.floor(this.random() * 4);
    this.flankers = [
      Math.floor(this.random() * 4),
      Math.floor(this.random() * 4),
    ];
  }
  update(seconds: number, level: number) {
    if (this.running) {
      this.seconds = seconds;
      this.level = level;
    }
  }
  answer(choice: number) {
    const correct = choice === this.target;
    this.target = Math.floor(this.random() * 4);
    this.flankers = [
      Math.floor(this.random() * 4),
      Math.floor(this.random() * 4),
    ];
    return correct;
  }
  terminate() {
    this.running = false;
  }
  render(context: CanvasRenderingContext2D, width: number, height: number) {
    const settings = this.configuration;
    context.fillStyle = settings.background;
    context.fillRect(0, 0, width, height);
    if (!this.running) return;
    const radius = settings.size / 2;
    const reachX = Math.max(0, width / 2 - radius - 20);
    const reachY = Math.max(0, height / 2 - radius - 20);
    let x = width / 2,
      y = height / 2;
    context.fillStyle = settings.foreground;
    context.strokeStyle = settings.foreground;
    context.globalAlpha = settings.contrast;
    if (this.kind === "pursuit") {
      const point = pursuitPoint(settings, this.seconds);
      x += point[0] * reachX;
      y += point[1] * reachY;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    if (this.kind === "saccades") {
      const interval = settings.exposure + settings.jumpPause;
      const jump = Math.floor(this.seconds / interval);
      if (this.seconds % interval < settings.exposure) {
        x += Math.sin(jump * 127.1 + 4) * reachX * settings.jumpDistance;
        y += Math.sin(jump * 311.7 + 2) * reachY * settings.jumpDistance;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
    if (this.kind === "visual") {
      const pixelRatio = Math.max(
        1,
        Math.min(3, context.getTransform?.().a ?? 1),
      );
      const size = visualTargetRadius(settings, this.level, {
        width,
        height,
        pixelRatio,
      });
      context.save();
      context.translate(x, y);
      context.rotate((this.target * Math.PI) / 2);
      context.lineWidth = Math.max(1 / pixelRatio, size / 4);
      if (settings.stimulus === "Opening") {
        context.beginPath();
        context.arc(0, 0, size, 0.4, Math.PI * 2 - 0.4);
        context.stroke();
      } else if (settings.stimulus === "Orientation") {
        for (let index = -2; index <= 2; index++) {
          context.beginPath();
          context.moveTo(-size, (index * size) / 3);
          context.lineTo(size, (index * size) / 3 + size / 2);
          context.stroke();
        }
        context.beginPath();
        context.moveTo(size, -size / 2);
        context.lineTo(size * 1.3, 0);
        context.lineTo(size, size / 2);
        context.stroke();
      } else {
        context.beginPath();
        context.moveTo(size, 0);
        context.lineTo(-size, -size);
        context.lineTo(-size, size);
        context.closePath();
        context.fill();
      }
      context.restore();
    }
    if (this.kind === "crowding") {
      const pixelRatio = Math.max(
        1,
        Math.min(3, context.getTransform?.().a ?? 1),
      );
      const geometry = crowdingGeometry(settings, this.level, {
        width,
        height,
        pixelRatio,
      });
      [-1, 0, 1].forEach((position, index) => {
        context.save();
        context.translate(x + position * geometry.centerDistance, y);
        context.rotate(
          ((position === 0 ? this.target : this.flankers[index === 0 ? 0 : 1]) *
            Math.PI) /
            2,
        );
        context.lineWidth = Math.max(1 / pixelRatio, geometry.diameter / 8);
        context.beginPath();
        context.arc(0, 0, geometry.diameter / 2, 0.4, Math.PI * 2 - 0.4);
        context.stroke();
        context.restore();
      });
      context.globalAlpha = 1;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x - 5, y + geometry.diameter / 2 + 12);
      context.lineTo(x + 5, y + geometry.diameter / 2 + 12);
      context.stroke();
    }
    if (this.kind === "contrast") {
      const contrast = Math.max(
        0.03,
        settings.contrast * Math.pow(0.84, this.level),
      );
      const positions = [
        [0.28, 0.28],
        [0.72, 0.28],
        [0.28, 0.72],
        [0.72, 0.72],
      ];
      const patternSize = Math.min(
        settings.size,
        Math.max(1, Math.min(width, height) * 0.2 - 10),
      );
      const panelSize = patternSize + 10;
      positions.forEach(([horizontal, vertical], index) => {
        context.globalAlpha = 1;
        context.strokeStyle = "#9c7376";
        context.lineWidth = 1;
        context.strokeRect(
          width * horizontal - panelSize,
          height * vertical - panelSize,
          panelSize * 2,
          panelSize * 2,
        );
        if (index === this.target) {
          context.globalAlpha = contrast;
          context.fillStyle = "#ffffff";
          if (settings.contrastStimulus === "Shape") {
            context.beginPath();
            context.arc(
              width * horizontal,
              height * vertical,
              patternSize,
              0,
              Math.PI * 2,
            );
            context.fill();
          } else
            for (let stripe = -3; stripe <= 3; stripe++)
              context.fillRect(
                width * horizontal +
                  (stripe * patternSize) / 3.5 -
                  patternSize / 14,
                height * vertical - patternSize,
                patternSize / 7,
                patternSize * 2,
              );
        }
      });
    }
    context.globalAlpha = 1;
  }
}
