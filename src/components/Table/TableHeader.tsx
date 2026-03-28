/**
 * Author: Diego Ortega Fernandez
 *
 * Description:
 * TableHeader component with sort indicators.
 * Renders column headers with clickable sorting for sortable columns.
 *
 * @param columns - Array of column definitions
 * @param sortColumn - Currently sorted column key
 * @param sortDirection - Current sort direction
 * @param onSort - Callback when a sortable column header is clicked
 * @returns React thead element
 */

import type { TableColumn } from "@components/Table/DataTable";

type SortDirection = "asc" | "desc" | null;

interface Props {
  columns: TableColumn[];
  sortColumn: string;
  sortDirection: SortDirection;
  onSort: (columnKey: string) => void;
}

/**
 * Description: Returns the sort indicator arrow based on current sort state.
 * @param columnKey - The column to check
 * @param sortColumn - The currently sorted column
 * @param sortDirection - The current sort direction
 * @returns Sort indicator string
 */
function getSortIndicator(
  columnKey: string,
  sortColumn: string,
  sortDirection: SortDirection
): string {
  if (columnKey !== sortColumn || !sortDirection) return "↕";
  return sortDirection === "asc" ? "↑" : "↓";
}

export default function TableHeader({ columns, sortColumn, sortDirection, onSort }: Props) {
  return (
    <thead>
      <tr className="bg-gray-200">
        {columns.map((col) => {
          const isSortable = col.sortable !== false && col.key !== "action";
          const isActive = col.key === sortColumn && sortDirection !== null;

          return (
            <th
              key={col.key}
              className={[
                "px-4 py-3 font-bold text-md text-gray-700",
                col.key === "action" ? "text-center" : "text-left",
                isSortable ? "cursor-pointer select-none hover:bg-gray-300 transition-colors" : "",
              ].join(" ")}
              onClick={isSortable ? () => onSort(col.key) : undefined}
              aria-sort={
                isActive
                  ? sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : undefined
              }
            >
              <span className="inline-flex items-center gap-1">
                {col.label}
                {isSortable && (
                  <span className={`text-xs ${isActive ? "text-primary-500" : "text-neutral-400"}`}>
                    {getSortIndicator(col.key, sortColumn, sortDirection)}
                  </span>
                )}
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
