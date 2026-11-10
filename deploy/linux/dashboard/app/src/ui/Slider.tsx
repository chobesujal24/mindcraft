import { useId } from "react";
import { cx } from "../utils/cx";

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  hint?: string;
};

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  disabled,
  className,
  hint,
}: SliderProps) {
  const id = useId();
  const safeValue = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  const pct = max === min ? 0 : ((safeValue - min) / (max - min)) * 100;
  const shown = format ? format(safeValue) : String(safeValue);
  return (
    <div className={cx("slider", className)}>
      <div className="slider__head">
        <label className="slider__label" htmlFor={id}>
          {label}
        </label>
        <output className="slider__value" htmlFor={id}>
          {shown}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        disabled={disabled}
        aria-valuetext={`${shown}${hint ? `, ${hint}` : ""}`}
        style={{ ["--fill" as string]: `${pct}%` }}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  );
}
