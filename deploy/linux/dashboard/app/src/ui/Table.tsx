import type { ReactNode } from "react";
import { cx } from "../utils/cx";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  numeric?: boolean;
  width?: string;
  hideBelow?: "sm";
};

type TableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty?: ReactNode;
  label: string;
  className?: string;
  compact?: boolean;
  fixed?: boolean;
  rowClassName?: (row: T) => string | undefined;
};

export function Table<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing to show yet.",
  label,
  className,
  compact,
  fixed,
  rowClassName,
}: TableProps<T>) {
  return (
    <div className="table-wrap">
      <table className={cx("table", compact && "table--compact", fixed && "table--fixed", className)}>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(column.numeric && "num", column.hideBelow === "sm" && "col-hide-sm")}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="table__empty">
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={rowKey(row, index)} className={rowClassName?.(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={cx(column.numeric && "num", column.hideBelow === "sm" && "col-hide-sm")}>
                    {column.render(row, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
