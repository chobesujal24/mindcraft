import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cx } from "../utils/cx";

type FieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  mono?: boolean;
  className?: string;
  children: ReactNode;
  htmlFor?: string;
};

export function Field({
  label,
  hint,
  error,
  required,
  disabled,
  mono,
  className,
  children,
  htmlFor,
}: FieldProps) {
  const generated = useId();
  const child = isValidElement(children) ? (children as ReactElement<Record<string, unknown>>) : null;
  const childId = typeof child?.props?.id === "string" ? child.props.id : generated;
  const id = htmlFor ?? childId;
  const hintId = hint ? `${childId}-hint` : undefined;
  const errorId = error ? `${childId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control =
    child && childId
      ? cloneElement(child, {
          id: child.props?.id ?? childId,
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : child.props?.["aria-invalid"],
          "aria-required": required ? true : child.props?.["aria-required"],
          disabled: disabled ? true : child.props?.disabled,
        })
      : children;

  return (
    <div className={cx("field", className)} data-disabled={disabled || undefined} data-mono={mono || undefined}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {control}
      {hint && !error && (
        <div className="field__hint" id={hintId}>
          {hint}
        </div>
      )}
      {error && (
        <div className="field__error" id={errorId} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
