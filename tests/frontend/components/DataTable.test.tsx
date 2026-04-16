/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for the DataTable base component. Covers loading state,
 * column header rendering, row rendering, sort cycle (asc → desc → none),
 * pagination boundaries and the action column link generation.
 */

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataTable from "@components/Table/DataTable";
import type { TableColumn } from "@components/Table/DataTable";

const columns: TableColumn[] = [
  { key: "request_id", label: "ID" },
  { key: "applicant", label: "Solicitante" },
  { key: "amount", label: "Monto" },
  { key: "action", label: "Acción" },
];

const sampleRows = [
  { request_id: 1, applicant: "Carla", amount: 300 },
  { request_id: 2, applicant: "Bruno", amount: 100 },
  { request_id: 3, applicant: "Ana", amount: 200 },
];

describe("DataTable", () => {
  it("shows a loading state when rows is empty", () => {
    render(<DataTable columns={columns} rows={[]} role="N1" />);
    expect(screen.getByText(/cargando datos/i)).toBeInTheDocument();
  });

  it("renders all column headers", () => {
    render(<DataTable columns={columns} rows={sampleRows} role="N1" />);
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Solicitante")).toBeInTheDocument();
    expect(screen.getByText("Monto")).toBeInTheDocument();
    expect(screen.getByText("Acción")).toBeInTheDocument();
  });

  it("renders one row per data item", () => {
    render(<DataTable columns={columns} rows={sampleRows} role="N1" />);
    expect(screen.getByText("Carla")).toBeInTheDocument();
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("sorts a string column ascending then descending then resets", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={sampleRows} role="N1" />);

    const header = screen.getByText("Solicitante").closest("th") as HTMLElement;

    await user.click(header);
    let bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByText("Ana")).toBeInTheDocument();
    expect(within(bodyRows[2]).getByText("Carla")).toBeInTheDocument();

    await user.click(header);
    bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByText("Carla")).toBeInTheDocument();
    expect(within(bodyRows[2]).getByText("Ana")).toBeInTheDocument();

    await user.click(header);
    bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByText("Carla")).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText("Bruno")).toBeInTheDocument();
    expect(within(bodyRows[2]).getByText("Ana")).toBeInTheDocument();
  });

  it("sorts numeric columns numerically, not lexically", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={sampleRows} role="N1" />);

    const header = screen.getByText("Monto").closest("th") as HTMLElement;
    await user.click(header);

    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByText("100")).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText("200")).toBeInTheDocument();
    expect(within(bodyRows[2]).getByText("300")).toBeInTheDocument();
  });

  it("does not toggle sort on the action column", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={sampleRows} role="N1" />);
    const actionHeader = screen.getByText("Acción").closest("th") as HTMLElement;
    await user.click(actionHeader);
    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByText("Carla")).toBeInTheDocument();
  });

  it("paginates rows according to rowsPerPage", async () => {
    const user = userEvent.setup();
    const manyRows = Array.from({ length: 12 }, (_, i) => ({
      request_id: i + 1,
      applicant: `User ${i + 1}`,
      amount: (i + 1) * 10,
    }));
    render(
      <DataTable
        columns={columns}
        rows={manyRows}
        role="N1"
        rowsPerPage={5}
      />
    );

    expect(screen.getByText("User 1")).toBeInTheDocument();
    expect(screen.getByText("User 5")).toBeInTheDocument();
    expect(screen.queryByText("User 6")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("User 6")).toBeInTheDocument();
    expect(screen.getByText("User 10")).toBeInTheDocument();
    expect(screen.queryByText("User 1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByText("User 11")).toBeInTheDocument();
    expect(screen.getByText("User 12")).toBeInTheDocument();
  });

  it("does not render Pagination when there is only one page", () => {
    render(<DataTable columns={columns} rows={sampleRows} role="N1" />);
    expect(
      screen.queryByRole("button", { name: "2" })
    ).not.toBeInTheDocument();
  });

  it("builds the action link from role + request_id", () => {
    render(<DataTable columns={columns} rows={sampleRows} role="N1" />);
    const link = screen.getAllByRole("link", { name: /ver más/i })[0];
    expect(link).toHaveAttribute("href", "/autorizar-solicitud/1");
  });

  it("uses the type prop as the link prefix when provided", () => {
    render(
      <DataTable
        columns={columns}
        rows={sampleRows}
        role="N1"
        type="custom-route"
      />
    );
    const link = screen.getAllByRole("link", { name: /ver más/i })[0];
    expect(link).toHaveAttribute("href", "/custom-route/1");
  });

  it("falls back to /error/:id when role has no mapping and no type", () => {
    render(
      <DataTable columns={columns} rows={sampleRows} role={"Solicitante"} />
    );
    const link = screen.getAllByRole("link", { name: /ver más/i })[0];
    expect(link).toHaveAttribute("href", "/error/1");
  });
});
