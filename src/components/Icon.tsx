type IconName =
  | "Practice"
  | "Progress"
  | "Routines"
  | "Settings"
  | "Edit"
  | "Plus"
  | "Minus"
  | "Up"
  | "Down"
  | "Copy"
  | "Trash"
  | "Chevron"
  | "Check";

const paths: Record<IconName, string> = {
  Practice:
    "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  Progress: "M4 20V11 M12 20V4 M20 20v-6",
  Routines: "M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01",
  Settings: "M4 7h16 M4 17h16 M9 4v6 M16 14v6",
  Edit: "m15 5 4 4 M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z",
  Plus: "M12 5v14 M5 12h14",
  Minus: "M5 12h14",
  Up: "m6 14 6-6 6 6",
  Down: "m6 10 6 6 6-6",
  Copy: "M8 8h12v12H8Z M4 16V4h12",
  Trash: "M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7",
  Chevron: "m8 5 7 7-7 7",
  Check: "m5 12 4 4L19 6",
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
