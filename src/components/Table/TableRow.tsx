/**
 * Author: Diego Ortega Fernandez
 *
 * Description:
 * TableRow component for rendering individual data rows.
 * Handles action columns with role-based routing.
 *
 * @param row - Data object for this row
 * @param columns - Column definitions
 * @param index - Row index for zebra striping
 * @param roleHref - Route prefix based on user role
 * @returns React tr element
 */

import type { TableColumn } from "@components/Table/DataTable";

interface Props {
  row: Record<string, string | number | boolean>;
  columns: TableColumn[];
  index: number;
  roleHref: string;
}

export default function TableRow({ row, columns, index, roleHref }: Props) {
  return (
    <tr className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
      {columns.map((col) => (
        <td
          key={col.key}
          className={`py-2 border-b border-gray-200 ${col.key === "action" ? "text-center" : "px-3"}`}
        >
          {col.key === "action" ? (
            <a
              href={`/${roleHref}/${row.request_id}`}
              className="text-blue-500 hover:text-blue-700"
            >
              <button className="bg-primary-300 hover:bg-secondary-500 text-white font-bold py-2 px-6 rounded-md shadow-sm transition duration-300 ease-in-out">
                Ver mas
              </button>
            </a>
          ) : (
            <span className="text-sm">{String(row[col.key] ?? "")}</span>
          )}
        </td>
      ))}
    </tr>
  );
}
