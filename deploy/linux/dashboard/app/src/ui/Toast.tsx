import type { Toast as ToastModel } from "../data/types";
import { cx } from "../utils/cx";
import { Icon } from "./icons";

const icons = {
  ok: "check",
  warn: "alert",
  danger: "alert",
  info: "spark",
} as const;

export function Toast({ toast, onDismiss }: { toast: ToastModel; onDismiss: (id: number) => void }) {
  return (
    <div className={cx("toast")} data-tone={toast.tone} role="status">
      <span className="toast__icon">
        <Icon name={icons[toast.tone]} size={15} />
      </span>
      <div className="toast__copy">
        <div className="toast__title">{toast.title}</div>
        {toast.detail && <div className="toast__detail">{toast.detail}</div>}
      </div>
      <button
        type="button"
        className="toast__close"
        aria-label={`Dismiss: ${toast.title}`}
        onClick={() => onDismiss(toast.id)}
      >
        <Icon name="x" size={12} />
      </button>
      <span className="toast__timer" aria-hidden="true" />
    </div>
  );
}
