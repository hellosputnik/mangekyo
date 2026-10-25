import { useId } from "react";
export function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const identifier = useId();
  return (
    <label className="switch-setting" htmlFor={identifier}>
      <span>{label}</span>
      <span className="switch-control">
        <input
          type="checkbox"
          role="switch"
          id={identifier}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch-track" aria-hidden="true">
          <span />
        </span>
      </span>
    </label>
  );
}
