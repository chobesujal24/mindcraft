import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  disabledReason?: string;
  leading?: ReactNode;
  block?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  loadingLabel = "Working",
  disabledReason,
  leading,
  block,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: Props) {
  const blocked = Boolean(disabled) || loading;
  const reason = blocked ? disabledReason : undefined;
  return (
    <button
      type={type}
      className={cx(
        "btn",
        `btn--${variant}`,
        size !== "md" && `btn--${size}`,
        block && "btn--block",
        className,
      )}
      disabled={blocked}
      aria-busy={loading || undefined}
      data-reason={reason}
      title={reason}
      {...rest}
    >
      {loading ? (
        <span className="spin" aria-hidden="true" style={{ display: "inline-flex" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" strokeLinecap="round" />
          </svg>
        </span>
      ) : (
        leading
      )}
      <span>{loading ? loadingLabel : children}</span>
      <span className="sr-only">{loading ? " in progress" : ""}</span>
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  pressed?: boolean;
  loading?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  tone?: "neutral" | "danger" | "accent";
};

export function IconButton({
  label,
  children,
  pressed,
  loading,
  size = "md",
  tone = "neutral",
  className,
  disabled,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        "icon-btn",
        size !== "md" && `icon-btn--${size}`,
        tone !== "neutral" && `icon-btn--${tone}`,
        className,
      )}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="spin" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" strokeLinecap="round" />
          </svg>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
