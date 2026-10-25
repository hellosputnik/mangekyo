import { type Configuration, type ExerciseKind } from "../engine/model";
export interface Exercise {
  initialize(): void;
  update(seconds: number, level: number): void;
  render(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void;
  answer(choice: number): boolean;
  terminate(): void;
}
export class VisualExercise implements Exercise {
  private seconds = 0;
  private level = 0;
  private target = 0;
  private running = false;
  constructor(
    private kind: ExerciseKind,
    private configuration: Configuration,
    private random: () => number = Math.random,
  ) {}
  initialize() {
    this.running = true;
    this.target = Math.floor(this.random() * 4);
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
    const phase = this.seconds * settings.speed * Math.PI * 2;
    context.fillStyle = settings.foreground;
    context.strokeStyle = settings.foreground;
    context.globalAlpha = settings.contrast;
    if (this.kind === "pursuit") {
      const complexity = settings.complexity;
      const patterns: Record<string, [number, number]> = {
        Horizontal: [Math.sin(phase), 0],
        Vertical: [0, Math.sin(phase)],
        Circle: [Math.cos(phase), Math.sin(phase)],
        "Figure eight": [Math.sin(phase), Math.sin(phase * 2) * 0.75],
        Wandering: [
          Math.sin(phase * 0.73) * 0.65 +
            Math.sin(phase * 1.13 * complexity) * 0.3,
          Math.cos(phase * 0.57) * 0.65 + Math.sin(phase * 0.91) * 0.3,
        ],
      };
      const point = patterns[settings.pattern] ?? patterns.Horizontal;
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
      const size = Math.min(
        width / 3,
        height / 3,
        Math.max(5, settings.size * 1.6 * Math.pow(0.91, this.level)),
      );
      context.save();
      context.translate(x, y);
      context.rotate((this.target * Math.PI) / 2);
      context.lineWidth = Math.max(2, size / 4);
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
      positions.forEach(([horizontal, vertical], index) => {
        context.globalAlpha = 1;
        context.strokeStyle = "#664343";
        context.lineWidth = 1;
        context.strokeRect(
          width * horizontal - 38,
          height * vertical - 38,
          76,
          76,
        );
        if (index === this.target) {
          context.globalAlpha = contrast;
          context.fillStyle = "#ffffff";
          if (settings.contrastStimulus === "Shape") {
            context.beginPath();
            context.arc(
              width * horizontal,
              height * vertical,
              Math.min(30, settings.size),
              0,
              Math.PI * 2,
            );
            context.fill();
          } else
            for (let stripe = -3; stripe <= 3; stripe++)
              context.fillRect(
                width * horizontal + stripe * 8 - 2,
                height * vertical - 28,
                4,
                56,
              );
        }
      });
    }
    context.globalAlpha = 1;
  }
}
