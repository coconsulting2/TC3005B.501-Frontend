/**
 * Author: Diego Ortega Fernandez
 *
 * Description:
 * DataTable component with sorting and pagination.
 * Supports column-based ascending/descending sorting,
 * configurable rows per page, and responsive layout.
 *
 * @param columns - Array of { key, label, sortable? } column definitions
 * @param rows - Array of row data objects
 * @param role - User role for action routing
 * @param type - Optional custom route type
 * @param rowsPerPage - Rows per page (default: 10)
 * @returns React DataTable element
 */

import { useState, useMemo } from "react";
import TableHeader from "@components/Table/TableHeader";
import TableRow from "@components/Table/TableRow";
import Pagination from "@components/Table/Pagination";
import type { UserRole } from "@type/roles";

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
}

type SortDirection = "asc" | "desc" | null;

interface SortState {
  column: string;
  direction: SortDirection;
}

interface Props {
  columns: TableColumn[];
  rows: Record<string, string | number | boolean>[];
  role: UserRole;
  type?: string;
  rowsPerPage?: number;
}

const roleDictionary = {
  N1: "autorizar-solicitud",
  N2: "autorizar-solicitud",
  "Cuentas por pagar": "cotizar-solicitud",
  "Agencia de viajes": "atender-solicitud",
} as const;

type ValidRole = keyof typeof roleDictionary;

/**
 * Description: Determines the href path based on user role and optional type override.
 * @param role - The current user role
 * @param type - Optional route type override
 * @returns The resolved route string
 */
function getRoleHref(role: UserRole, type: string): string {
  if (type) {
    return type;
  }
  if (role in roleDictionary) {
    return roleDictionary[role as ValidRole];
  }
  return "error";
}

/**
 * Description: Compares two row values for sorting.
 * @param a - First value
 * @param b - Second value
 * @param direction - Sort direction
 * @returns Comparison number
 */
function compareValues(
  a: string | number | boolean | undefined,
  b: string | number | boolean | undefined,
  direction: "asc" | "desc"
): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;

  let comparison = 0;
  if (typeof a === "number" && typeof b === "number") {
    comparison = a - b;
  } else {
    comparison = String(a).localeCompare(String(b), "es", { sensitivity: "base" });
  }

  return direction === "desc" ? -comparison : comparison;
}

export default function DataTable({
  columns,
  rows,
  type,
  role,
  rowsPerPage = 10,
}: Props) {
  const [sort, setSort] = useState<SortState>({ column: "", direction: null });
  const [page, setPage] = useState(1);

  const roleHref = getRoleHref(role, type ?? "");
  const isLoading = rows.length === 0;

  const handleSort = (columnKey: string) => {
    setSort((prev) => {
      if (prev.column !== columnKey) {
        return { column: columnKey, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { column: columnKey, direction: "desc" };
      }
      return { column: "", direction: null };
    });
    setPage(1);
  };

  const sortedRows = useMemo(() => {
    if (!sort.column || !sort.direction) return rows;

    return [...rows].sort((a, b) =>
      compareValues(a[sort.column], b[sort.column], sort.direction as "asc" | "desc")
    );
  }, [rows, sort]);

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
  const paginatedRows = sortedRows.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Cargando datos...
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="rounded-md shadow-md overflow-x-auto">
        <table className="min-w-full bg-white">
          <TableHeader
            columns={columns}
            sortColumn={sort.column}
            sortDirection={sort.direction}
            onSort={handleSort}
          />
          <tbody>
            {paginatedRows.map((row, index) => (
              <TableRow
                key={index}
                row={row}
                columns={columns}
                index={index}
                roleHref={roleHref}
              />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination totalPages={totalPages} page={page} setPage={setPage} />
      )}
    </div>
  );
}
