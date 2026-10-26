import type { ReactNode } from "react";
import type { ExerciseKind } from "../engine/model";

const artwork: Record<ExerciseKind, ReactNode> = {
  pursuit: (
    <path d="M16 16C10 4 2 6 2 16s8 12 14 0C22 4 30 6 30 16s-8 12-14 0Z" />
  ),
  saccades: (
    <>
      <circle cx="8" cy="24" r="4" opacity="0.7" />
      <path d="m13 19 6-6m-4 0h4v4" />
      <circle cx="24" cy="8" r="4" />
      <circle cx="24" cy="8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  visual: <path d="M24 9a10 10 0 1 0 0 14" />,
  contrast: (
    <>
      <circle
        cx="16"
        cy="16"
        r="10.5"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="none"
      />
      <path
        d="M16 5.5a10.5 10.5 0 0 0 0 21Z"
        fill="currentColor"
        fillOpacity="0.8"
        stroke="none"
      />
      <circle cx="16" cy="16" r="10.5" />
    </>
  ),
  tap: (
    <>
      <circle cx="16" cy="16" r="8" />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" stroke="none" />
      <path d="M16 2v3m0 22v3M2 16h3m22 0h3" />
    </>
  ),
  follow: (
    <>
      <path d="M5 10c6-10 12 10 22 0" />
      <circle cx="20" cy="10" r="3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="24" r="5" />
      <path d="m12 19 3-5m-5 9h4m-4 2h4" />
    </>
  ),
};

export function ExerciseArtwork({ kind }: { kind: ExerciseKind }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {artwork[kind]}
    </svg>
  );
}
