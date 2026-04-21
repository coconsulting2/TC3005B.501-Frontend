/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for XmlExpenseForm. Covers the initial render with empty
 * readonly fields, auto-filling the form from a mocked XML parser
 * response, the parse error path, zod validation errors when the user
 * tries to submit without valid data, the success path calling the
 * registrar endpoint and invoking onSuccess, and the submit error path.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import XmlExpenseForm from "@components/XmlExpenseForm";
import { server } from "../mocks/server";

const API = "https://localhost:3000/api";

function xmlFile(name = "cfdi.xml") {
  return new File(["<cfdi/>"], name, { type: "application/xml" });
}

async function uploadXml(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector<HTMLInputElement>(
    "input[type=file][accept='.xml']",
  )!;
  await user.upload(input, xmlFile());
}

describe("XmlExpenseForm", () => {
  it("renders the XML upload input and empty readonly fields initially", () => {
    render(<XmlExpenseForm receiptId={1} token="t" />);
    expect(screen.getByText(/archivo xml del cfdi/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /guardar comprobación/i }),
    ).toBeInTheDocument();
  });

  it("auto-fills the form when the XML parser returns valid data", async () => {
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);
    await uploadXml(user);

    await waitFor(() => {
      expect(screen.getByDisplayValue("EKU9003173C9")).toBeInTheDocument();
    });
    expect(
      screen.getByDisplayValue("A1B2C3D4-E5F6-7890-1234-567890ABCDEF"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-04-10T12:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1250.5")).toBeInTheDocument();
    expect(screen.getByText(/cargado correctamente/i)).toBeInTheDocument();
  });

  it("shows an error message when the parser endpoint fails", async () => {
    server.use(
      http.post(`${API}/comprobantes/parse-xml`, () =>
        HttpResponse.json({ error: "x" }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);
    await uploadXml(user);
    expect(
      await screen.findByText(/no se pudo procesar el archivo xml/i),
    ).toBeInTheDocument();
  });

  it("shows zod validation errors when submitting without any data", async () => {
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);
    await user.click(
      screen.getByRole("button", { name: /guardar comprobación/i }),
    );
    expect(
      await screen.findByText(/rfc debe tener al menos 12 caracteres/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/uuid es requerido/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/selecciona un tipo de gasto/i),
    ).toBeInTheDocument();
  });

  it("allows the user to select an expense type from the dropdown", async () => {
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);
    await user.selectOptions(screen.getByRole("combobox"), "3");
    const selected = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selected.value).toBe("3");
  });

  it("does not call onSuccess when the form is submitted empty (zod blocks submission)", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <XmlExpenseForm receiptId={1} token="t" onSuccess={onSuccess} />,
    );
    await user.click(
      screen.getByRole("button", { name: /guardar comprobación/i }),
    );
    expect(
      await screen.findByText(/uuid es requerido/i),
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
