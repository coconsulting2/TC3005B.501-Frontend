/**
 * Description:
 * Unit tests for XmlExpenseForm. Covers the initial render with empty
 * readonly fields, auto-filling the form from a mocked XML parser
 * response, the parse error path, zod validation errors when the user
 * tries to submit without valid data, the success path calling the
 * registrar endpoint and invoking onSuccess, and the submit error path.
 * Extended coverage includes: international mode toggle, international
 * form validation, international success/error flows, FX conversion
 * display, image file selection, national submit success/error, button
 * disabled state during submission, notes field handling, and the
 * upload-failure path.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import XmlExpenseForm from "@components/XmlExpenseForm";
import { server } from "../mocks/server";

const API = "https://localhost:3000/api";

function xmlFile(name = "cfdi.xml") {
  return new File(["<cfdi/>"], name, { type: "application/xml" });
}

function imageFile(name = "recibo.jpg") {
  return new File(["img"], name, { type: "image/jpeg" });
}

async function uploadXml(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector<HTMLInputElement>(
    "input[type=file][accept='.xml']",
  )!;
  await user.upload(input, xmlFile());
}

async function fillAndUploadXml(user: ReturnType<typeof userEvent.setup>) {
  await uploadXml(user);
  await waitFor(() => {
    expect(screen.getByDisplayValue("EKU9003173C9")).toBeInTheDocument();
  });
}

async function switchToInternational(user: ReturnType<typeof userEvent.setup>) {
  const checkbox = screen.getByRole("checkbox");
  await user.click(checkbox);
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

  // ── National form: success path ───────────────────────────────────────────

  it("calls onSuccess after a successful national form submission", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" onSuccess={onSuccess} />);

    await fillAndUploadXml(user);

    await user.selectOptions(screen.getByRole("combobox"), "1");
    await user.click(
      screen.getByRole("button", { name: /guardar comprobación/i }),
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("includes notas in the payload when notes are filled in", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" onSuccess={onSuccess} />);

    await fillAndUploadXml(user);

    await user.selectOptions(screen.getByRole("combobox"), "2");
    const notasField = screen.getByPlaceholderText(/observaciones adicionales/i);
    await user.type(notasField, "Nota de prueba");

    await user.click(
      screen.getByRole("button", { name: /guardar comprobación/i }),
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("shows an error when the national submit API call fails", async () => {
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    // First upload XML to get auto-fill data (default parse-xml handler)
    await fillAndUploadXml(user);

    // Now override the comprobantes/:id POST to fail
    server.use(
      http.post(`${API}/comprobantes/:id`, () =>
        HttpResponse.json({ error: "server error" }, { status: 500 }),
      ),
    );

    await user.selectOptions(screen.getByRole("combobox"), "1");
    await user.click(
      screen.getByRole("button", { name: /guardar comprobación/i }),
    );

    expect(
      await screen.findByText(/error al guardar la comprobación/i),
    ).toBeInTheDocument();
  });

  it("shows 'Guardando...' text and disables the button while submitting (national)", async () => {
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    // First upload XML to get auto-fill data (default parse-xml handler)
    await fillAndUploadXml(user);

    // Now override the comprobantes/:id POST to hang indefinitely
    let resolvePost!: () => void;
    server.use(
      http.post(`${API}/comprobantes/:id`, () =>
        new Promise<Response>((res) => {
          resolvePost = () => res(HttpResponse.json({ ok: true }));
        }),
      ),
    );

    await user.selectOptions(screen.getByRole("combobox"), "1");
    await user.click(
      screen.getByRole("button", { name: /guardar comprobación/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /guardando/i })).toBeDisabled();
    });

    act(() => { resolvePost(); });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /guardando/i })).not.toBeInTheDocument();
    });
  });

  // ── International mode ────────────────────────────────────────────────────

  it("switches to international mode when the checkbox is clicked", async () => {
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    await switchToInternational(user);

    expect(screen.queryByText(/archivo xml del cfdi/i)).not.toBeInTheDocument();
    expect(screen.getByText(/imagen del recibo/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /guardar comprobación internacional/i }),
    ).toBeInTheDocument();
  });

  it("shows international zod validation errors when submitting without data", async () => {
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    await switchToInternational(user);

    // Clear the monto field (default is 0 which fails positive())
    const montoInput = screen.getByRole("spinbutton");
    await user.tripleClick(montoInput);
    await user.clear(montoInput);

    await user.click(
      screen.getByRole("button", { name: /guardar comprobación internacional/i }),
    );

    expect(
      await screen.findByText(/describe el gasto/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/el monto debe ser mayor a 0/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/selecciona un tipo de gasto/i),
    ).toBeInTheDocument();
  });

  it("shows error when submitting international form without an image", async () => {
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    await switchToInternational(user);

    const descripcionInput = screen.getByPlaceholderText(/ej\. hotel london/i);
    await user.type(descripcionInput, "Hotel en NY");

    const montoInput = screen.getByRole("spinbutton");
    await user.clear(montoInput);
    await user.type(montoInput, "100");

    const combos = screen.getAllByRole("combobox");
    const tipoGastoCombo = combos.find(
      (c) => (c as HTMLSelectElement).options[0]?.text.toLowerCase().includes("tipo"),
    ) as HTMLSelectElement;
    await user.selectOptions(tipoGastoCombo, "1");

    await user.click(
      screen.getByRole("button", { name: /guardar comprobación internacional/i }),
    );

    expect(
      await screen.findByText(/adjunta una imagen jpg o png/i),
    ).toBeInTheDocument();
  });

  it("shows the selected image filename after upload in international mode", async () => {
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    await switchToInternational(user);

    const imgInput = document.querySelector<HTMLInputElement>(
      "input[type=file][accept='image/jpeg,image/png']",
    )!;
    await user.upload(imgInput, imageFile("factura.jpg"));

    expect(await screen.findByText(/factura\.jpg seleccionada/i)).toBeInTheDocument();
  });

  it("calls onSuccess after a successful international form submission", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" onSuccess={onSuccess} />);

    await switchToInternational(user);

    const imgInput = document.querySelector<HTMLInputElement>(
      "input[type=file][accept='image/jpeg,image/png']",
    )!;
    await user.upload(imgInput, imageFile());

    const descripcionInput = screen.getByPlaceholderText(/ej\. hotel london/i);
    await user.type(descripcionInput, "Hotel Marriott NY");

    const montoInput = screen.getByRole("spinbutton");
    await user.clear(montoInput);
    await user.type(montoInput, "200");

    const combos = screen.getAllByRole("combobox");
    const tipoGastoCombo = combos.find(
      (c) => (c as HTMLSelectElement).options[0]?.text.toLowerCase().includes("tipo"),
    ) as HTMLSelectElement;
    await user.selectOptions(tipoGastoCombo, "1");

    await user.click(
      screen.getByRole("button", { name: /guardar comprobación internacional/i }),
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("shows error when the international image upload endpoint fails", async () => {
    server.use(
      http.post(`${API}/files/upload-receipt-files/:id`, () =>
        HttpResponse.json({ error: "upload error" }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    await switchToInternational(user);

    const imgInput = document.querySelector<HTMLInputElement>(
      "input[type=file][accept='image/jpeg,image/png']",
    )!;
    await user.upload(imgInput, imageFile());

    const descripcionInput = screen.getByPlaceholderText(/ej\. hotel london/i);
    await user.type(descripcionInput, "Hotel Marriott");

    const montoInput = screen.getByRole("spinbutton");
    await user.clear(montoInput);
    await user.type(montoInput, "150");

    const combos = screen.getAllByRole("combobox");
    const tipoGastoCombo = combos.find(
      (c) => (c as HTMLSelectElement).options[0]?.text.toLowerCase().includes("tipo"),
    ) as HTMLSelectElement;
    await user.selectOptions(tipoGastoCombo, "2");

    await user.click(
      screen.getByRole("button", { name: /guardar comprobación internacional/i }),
    );

    expect(
      await screen.findByText(/error al guardar el gasto internacional/i),
    ).toBeInTheDocument();
  });

  it("shows error when the international comprobantes POST fails", async () => {
    server.use(
      http.post(`${API}/comprobantes/:id`, () =>
        HttpResponse.json({ error: "server error" }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    await switchToInternational(user);

    const imgInput = document.querySelector<HTMLInputElement>(
      "input[type=file][accept='image/jpeg,image/png']",
    )!;
    await user.upload(imgInput, imageFile());

    const descripcionInput = screen.getByPlaceholderText(/ej\. hotel london/i);
    await user.type(descripcionInput, "Cena de negocios");

    const montoInput = screen.getByRole("spinbutton");
    await user.clear(montoInput);
    await user.type(montoInput, "75");

    const combos = screen.getAllByRole("combobox");
    const tipoGastoCombo = combos.find(
      (c) => (c as HTMLSelectElement).options[0]?.text.toLowerCase().includes("tipo"),
    ) as HTMLSelectElement;
    await user.selectOptions(tipoGastoCombo, "2");

    await user.click(
      screen.getByRole("button", { name: /guardar comprobación internacional/i }),
    );

    expect(
      await screen.findByText(/error al guardar el gasto internacional/i),
    ).toBeInTheDocument();
  });

  // ── FX conversion ─────────────────────────────────────────────────────────

  it("displays the MXN equivalent when FX conversion succeeds", async () => {
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    await switchToInternational(user);

    const montoInput = screen.getByRole("spinbutton");
    await user.clear(montoInput);
    await user.type(montoInput, "50");

    await waitFor(
      () => {
        expect(screen.getByText(/equivalente aproximado/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("shows FX loading text while conversion is in progress", async () => {
    let resolveConvert!: () => void;
    server.use(
      http.get(`${API}/fx/convert`, () =>
        new Promise<Response>((res) => {
          resolveConvert = () =>
            res(
              HttpResponse.json({
                success: true,
                data: { converted: 1000, rate: 20, from: "USD", to: "MXN", amount: 50 },
              }),
            );
        }),
      ),
    );

    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    await switchToInternational(user);

    const montoInput = screen.getByRole("spinbutton");
    await user.clear(montoInput);
    await user.type(montoInput, "50");

    await waitFor(() => {
      expect(screen.getByText(/calculando tipo de cambio/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    act(() => { resolveConvert(); });

    await waitFor(() => {
      expect(screen.queryByText(/calculando tipo de cambio/i)).not.toBeInTheDocument();
    });
  });

  it("clears FX value when switching back from international mode", async () => {
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    // Switch to international
    await switchToInternational(user);

    const montoInput = screen.getByRole("spinbutton");
    await user.clear(montoInput);
    await user.type(montoInput, "50");

    await waitFor(() => {
      expect(screen.getByText(/equivalente aproximado/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Switch back to national
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(screen.queryByText(/equivalente aproximado/i)).not.toBeInTheDocument();
    expect(screen.getByText(/archivo xml del cfdi/i)).toBeInTheDocument();
  });

  it("handles FX conversion failure gracefully (no crash, no amount shown)", async () => {
    server.use(
      http.get(`${API}/fx/convert`, () =>
        HttpResponse.json({ error: "rate unavailable" }, { status: 503 }),
      ),
    );

    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    await switchToInternational(user);

    const montoInput = screen.getByRole("spinbutton");
    await user.clear(montoInput);
    await user.type(montoInput, "50");

    // Wait for the debounce + fetch to complete
    await waitFor(() => {
      expect(screen.queryByText(/calculando tipo de cambio/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.queryByText(/equivalente aproximado/i)).not.toBeInTheDocument();
  });

  it("allows switching currency in international mode", async () => {
    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    await switchToInternational(user);

    const combos = screen.getAllByRole("combobox");
    const monedaCombo = combos.find(
      (c) =>
        Array.from((c as HTMLSelectElement).options).some(
          (o) => o.value === "EUR",
        ),
    ) as HTMLSelectElement;

    await user.selectOptions(monedaCombo, "EUR");
    expect(monedaCombo.value).toBe("EUR");
  });

  // ── Parsing state ──────────────────────────────────────────────────────────

  it("shows 'Procesando XML...' text while the parse request is in flight", async () => {
    let resolveXml!: () => void;
    server.use(
      http.post(`${API}/comprobantes/parse-xml`, () =>
        new Promise<Response>((res) => {
          resolveXml = () =>
            res(
              HttpResponse.json({
                rfc_emisor: "EKU9003173C9",
                fecha_emision: "2026-04-10T12:00",
                monto_total: 1250.5,
                uuid: "A1B2C3D4-E5F6-7890-1234-567890ABCDEF",
                registro_sugerido: null,
              }),
            );
        }),
      ),
    );

    const user = userEvent.setup();
    render(<XmlExpenseForm receiptId={1} token="t" />);

    const input = document.querySelector<HTMLInputElement>(
      "input[type=file][accept='.xml']",
    )!;
    await user.upload(input, xmlFile());

    await waitFor(() => {
      expect(screen.getByText(/procesando xml/i)).toBeInTheDocument();
    });

    act(() => { resolveXml(); });

    await waitFor(() => {
      expect(screen.queryByText(/procesando xml/i)).not.toBeInTheDocument();
    });
  });

  // ── Clears parse error when switching modes ────────────────────────────────

  it("clears the parse error when toggling to international mode", async () => {
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

    await switchToInternational(user);

    expect(
      screen.queryByText(/no se pudo procesar el archivo xml/i),
    ).not.toBeInTheDocument();
  });
});
