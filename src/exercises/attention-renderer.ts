import type { Session } from "../engine/model";
import {
  attentionPhase,
  attentionPositions,
  cueMilliseconds,
} from "./attention";

function opening(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  direction: number,
) {
  context.save();
  context.translate(x, y);
  context.rotate((direction * Math.PI) / 2);
  context.lineWidth = Math.max(2, radius / 4);
  context.beginPath();
  context.arc(0, 0, radius, 0.45, Math.PI * 2 - 0.45);
  context.stroke();
  context.restore();
}

export function renderAttention(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  session: Session,
) {
  const round = session.attentionRound;
  if (!round || width <= 0 || height <= 0) return;
  const settings = session.configuration;
  const phase = attentionPhase(session);
  const task = round.presentation.task;
  const elapsed =
    session.activeMilliseconds -
    round.startedAtMilliseconds -
    cueMilliseconds(round);
  context.fillStyle = settings.background;
  context.fillRect(0, 0, width, height);
  context.save();
  context.fillStyle = settings.foreground;
  context.strokeStyle = settings.foreground;
  context.globalAlpha = settings.contrast;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `500 ${Math.min(72, Math.max(36, settings.size * 1.3))}px -apple-system, BlinkMacSystemFont, sans-serif`;
  const points = attentionPositions(
    round,
    session.activeMilliseconds,
    width,
    height,
  );
  const radius = Math.max(
    8,
    Math.min(
      settings.size / 2,
      Math.min(width, height) / 7,
      task === "Track" ? width / round.items.length / 2 - 8 : 1000,
    ),
  );
  const circle = (x: number, y: number, filled = false) => {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    if (filled) context.fill();
    else {
      context.lineWidth = 2;
      context.stroke();
    }
  };
  if (task === "Track") {
    points.forEach(({ x, y }, index) => {
      circle(x, y, phase === "cue" && index === round.cue);
      if (phase === "cue" && index === round.cue) {
        context.beginPath();
        context.arc(x, y, radius + 7, 0, Math.PI * 2);
        context.stroke();
      }
    });
  } else if (task === "Count" || task === "Match") {
    if (phase === "cue")
      opening(context, width / 2, height / 2, radius * 1.4, round.cue);
    else
      round.items.forEach((direction, index) => {
        const point = points[index];
        opening(context, point.x, point.y, radius, direction);
      });
  } else if (task === "Moving") {
    const letter = (value: number) => String.fromCharCode(65 + value);
    if (phase === "cue")
      context.fillText(letter(round.cue), width / 2, height / 2);
    if (phase === "present") {
      const duration = round.presentation.exposureMilliseconds;
      const step = duration / (round.items.length + 2);
      round.items.forEach((value, index) => {
        const progress = (elapsed - index * step) / (step * 2.7);
        if (progress >= 0 && progress <= 1) {
          const x = width + radius * 2 - progress * (width + radius * 4);
          const y = height * [0.3, 0.5, 0.7][index % 3];
          context.fillText(letter(value), x, y);
        }
      });
    }
  } else if (task === "Locations") {
    if (phase === "present" || phase === "answer")
      points.forEach(({ x, y }, index) => {
        context.globalAlpha =
          settings.contrast * (round.selected.includes(index) ? 0.25 : 1);
        circle(x, y, phase === "present" && round.answers.includes(index));
      });
  } else if (task === "Digits" && phase === "present") {
    context.fillText(String(round.items[0]), width / 2, height / 2);
  } else if (task === "Directions" && phase === "present") {
    const index = Math.min(
      round.items.length - 1,
      Math.floor(
        elapsed /
          (round.presentation.exposureMilliseconds / round.items.length),
      ),
    );
    const x = width * [0.35, 0.65, 0.5, 0.35][index];
    const y = height * [0.4, 0.6, 0.5, 0.65][index];
    opening(context, x, y, radius * 1.3, round.items[index]);
  } else if (task === "Compare" && phase === "present") {
    round.items.forEach((direction, index) =>
      opening(
        context,
        width * (index === 0 ? 0.3 : 0.7),
        height / 2,
        radius * 1.3,
        direction,
      ),
    );
  } else if (task === "Numbers" && phase === "answer") {
    points.forEach(({ x, y }, index) => {
      context.globalAlpha =
        settings.contrast * (round.selected.includes(index) ? 0.2 : 0.8);
      circle(x, y);
      if (session.id === "preview") {
        context.font = "500 20px -apple-system, BlinkMacSystemFont, sans-serif";
        context.fillText(String(round.items[index]), x, y);
      }
    });
  }
  if (
    phase === "delay" ||
    (phase === "cue" && !["Track", "Count", "Match", "Moving"].includes(task))
  ) {
    context.globalAlpha = 0.4;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(width / 2 - 6, height / 2);
    context.lineTo(width / 2 + 6, height / 2);
    context.moveTo(width / 2, height / 2 - 6);
    context.lineTo(width / 2, height / 2 + 6);
    context.stroke();
  }
  context.restore();
}
