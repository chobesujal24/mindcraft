import type { ElementType, ReactNode } from "react";
import { cx } from "../utils/cx";

type PanelProps = {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: ElementType;
  eyebrow?: string;
  title?: ReactNode;
  sub?: ReactNode;
  tools?: ReactNode;
  flush?: boolean;
  tight?: boolean;
  footer?: ReactNode;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/**
 * One hairline surface. Headers are inset by a soft divider. Never nest a
 * Panel inside another Panel's body; split sections at the page level.
 */
export function Panel({
  children,
  className,
  bodyClassName,
  as: Tag = "section",
  eyebrow,
  title,
  sub,
  tools,
  flush,
  tight,
  footer,
  id,
  ...aria
}: PanelProps) {
  const hasHead = Boolean(eyebrow || title || sub || tools);
  return (
    <Tag className={cx("panel", className)} id={id} {...aria}>
      {hasHead && (
        <header className="panel__head">
          <div className="panel__heading">
            {eyebrow && <div className="panel__eyebrow">{eyebrow}</div>}
            {title && <h2 className="panel__title">{title}</h2>}
            {sub && <p className="panel__sub">{sub}</p>}
          </div>
          {tools && <div className="panel__tools">{tools}</div>}
        </header>
      )}
      <div className={cx("panel__body", flush && "panel__body--flush", tight && "panel__body--tight", bodyClassName)}>
        {children}
      </div>
      {footer && <div className="panel__foot">{footer}</div>}
    </Tag>
  );
}
