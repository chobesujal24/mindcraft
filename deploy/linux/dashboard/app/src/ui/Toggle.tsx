import { cx } from "../utils/cx";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  pending?: boolean;
  size?: "sm" | "md";
  className?: string;
  stateLabels?: [string, string];
};

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  pending,
  size = "md",
  className,
  stateLabels = ["Off", "On"],
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label}: ${checked ? stateLabels[1] : stateLabels[0]}`}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      className={cx("toggle", size !== "md" && `toggle--${size}`, className)}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
      <span className="toggle__state" aria-hidden="true">
        {pending ? "Saving" : checked ? stateLabels[1] : stateLabels[0]}
      </span>
    </button>
  );
}
