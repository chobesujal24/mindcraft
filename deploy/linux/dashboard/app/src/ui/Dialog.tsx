import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./Button";
import { Icon } from "./icons";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Dialogs stack (confirm-on-top-of-a-dialog, for example). Only the topmost
// dialog should consume Escape and trap Tab. The body scroll lock is shared
// so closing an inner dialog cannot re-enable scrolling underneath it.
const dialogStack: number[] = [];
let dialogSequence = 0;
let bodyLockCount = 0;
let bodyOverflowBeforeLock = "";

function lockBodyScroll() {
  if (bodyLockCount === 0) bodyOverflowBeforeLock = document.body.style.overflow;
  bodyLockCount += 1;
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0) document.body.style.overflow = bodyOverflowBeforeLock;
}

export function Dialog({ open, onClose, title, eyebrow, description, children, footer, wide }: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const dialogIdRef = useRef(0);
  const onCloseRef = useRef(onClose);
  if (dialogIdRef.current === 0) dialogIdRef.current = ++dialogSequence;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = dialogIdRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogStack.push(id);
    lockBodyScroll();
    const panel = panelRef.current;
    const initial =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE) ??
      panel;
    const focusTimer = window.setTimeout(() => initial?.focus(), 20);

    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== id) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null,
      );
      if (nodes.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown, true);
      const index = dialogStack.lastIndexOf(id);
      if (index >= 0) dialogStack.splice(index, 1);
      unlockBodyScroll();
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={wide ? "dialog dialog--wide" : "dialog"}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <header className="dialog__head">
          <div>
            {eyebrow && <div className="dialog__eyebrow eyebrow">{eyebrow}</div>}
            <h2 className="dialog__title" id={titleId}>
              {title}
            </h2>
            {description && (
              <p className="dialog__desc" id={descId}>
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close dialog" className="dialog__close" onClick={onClose}>
            <Icon name="x" size={14} />
          </IconButton>
        </header>
        {children && <div className="dialog__body">{children}</div>}
        {footer && <footer className="dialog__foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
