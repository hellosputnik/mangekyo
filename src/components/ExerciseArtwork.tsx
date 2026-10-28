import type { ReactNode } from "react";
import type { ExerciseKind } from "../engine/model";

const artwork: Record<ExerciseKind, ReactNode> = {
  tracking: (
    <>
      <circle cx="7" cy="9" r="4" />
      <circle cx="25" cy="11" r="4" />
      <circle cx="17" cy="25" r="4" />
      <circle cx="7" cy="9" r="1" fill="currentColor" />
      <path d="M14 7c4-1 7 0 10 1M25 18c-1 3-3 5-5 6" opacity="0.55" />
    </>
  ),
  search: (
    <>
      <path
        d="M10 5a4 4 0 1 0 0 7M23 4a4 4 0 1 0 0 7M10 19a4 4 0 1 0 0 7"
        opacity="0.65"
      />
      <circle cx="22" cy="22" r="6" />
      <path d="m26 26 4 4" />
    </>
  ),
  memory: (
    <>
      <rect x="5" y="5" width="8" height="8" rx="2" />
      <rect x="19" y="5" width="8" height="8" rx="2" opacity="0.45" />
      <rect x="5" y="19" width="8" height="8" rx="2" opacity="0.45" />
      <rect x="19" y="19" width="8" height="8" rx="2" />
      <path d="m21 23 2 2 3-4" />
    </>
  ),
  sequence: (
    <>
      <circle cx="7" cy="8" r="4" />
      <circle cx="24" cy="8" r="4" />
      <circle cx="24" cy="25" r="4" />
      <path d="M14 8h3m7 7v3M7 7v2m16-2h2m-2 2h2m-2 15h2m-2 2h2" />
    </>
  ),
  alignment: (
    <>
      <path d="M13 3v11m6 4v11" />
    </>
  ),
  crowding: (
    <>
      <path d="M7 13a5 5 0 1 0 0 6M21 11a7 7 0 1 0 0 10M30 13a5 5 0 1 0 0 6" />
    </>
  ),
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
