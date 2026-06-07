import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import WorkflowRulesAdmin from "@views/admin/WorkflowRulesAdmin";
import { server } from "../mocks/server";

const API = "https://localhost:3000/api";

const MOCK_RULES = [
  {
    id: "1",
    ruleType: "pre",
    paramType: "importe",
    threshold: 50000,
    paramValue: null,
    approvalLevel: 1,
    skipIfBelow: null,
    priority: 10,
    active: true,
    departmentId: null,
    managerSteps: null,
    targetRole: null,
  },
];

function setupHandlers() {
  server.use(
    http.get(`${API}/workflow-rules`, () => HttpResponse.json(MOCK_RULES)),
    http.get(`${API}/workflow-rules/departments`, () => HttpResponse.json([])),
    http.get(`${API}/workflow-rules/roles`, () =>
      HttpResponse.json(["N1", "N2", "Administrador"]),
    ),
    http.get(`${API}/workflow-rules/countries`, () =>
      HttpResponse.json([
        { countryId: 1, countryName: "México" },
        { countryId: 2, countryName: "Estados Unidos" },
      ]),
    ),
    http.get(`${API}/workflow-rules/receipt-types`, () =>
      HttpResponse.json([
        { receiptTypeId: 1, receiptTypeName: "Hospedaje" },
        { receiptTypeId: 2, receiptTypeName: "Comida" },
      ]),
    ),
    http.post(`${API}/workflow-rules/preview`, async ({ request }) => {
      const body = (await request.json()) as {
        amount: number;
        draftRule?: { paramType?: string };
      };
      const levels = body.amount < 50000 ? [2] : [1, 2];
      const summary =
        body.draftRule?.paramType === "destino"
          ? "Al activarse, la solicitud pasa por N1 e inicia en Primera Revisión (N1)."
          : body.draftRule?.paramType === "nivel"
            ? "Al activarse, la solicitud pasa por N1 e inicia en Primera Revisión (N1)."
            : `Resumen para ${body.amount}`;
      const hints =
        body.draftRule?.paramType === "destino" || body.draftRule?.paramType === "nivel"
          ? ["Condición cumplida → se exige al menos nivel N1."]
          : [];
      return HttpResponse.json({
        levels: body.draftRule?.paramType === "importe" || !body.draftRule?.paramType
          ? levels
          : [1],
        minApprovalLevel: levels[0],
        maxApprovalLevel: levels[levels.length - 1],
        skipApplied: body.amount < 50000,
        initialStatusId: levels[0] === 2 ? 3 : 2,
        initialStatusLabel: levels[0] === 2 ? "Segunda Revisión (N2)" : "Primera Revisión (N1)",
        summary,
        hints,
        amountEvaluated: body.amount,
        currencyEvaluated: "MXN",
      });
    }),
  );
}

describe("WorkflowRulesAdmin", () => {
  beforeEach(() => {
    setupHandlers();
  });

  it("renderiza la tabla con columna Skip", async () => {
    render(<WorkflowRulesAdmin />);
    expect(await screen.findByText("Skip <")).toBeInTheDocument();
    expect(screen.getByText("$50,000")).toBeInTheDocument();
  });

  it("oculta Skip si menor a cuando el parámetro es Destino", async () => {
    const user = userEvent.setup();
    render(<WorkflowRulesAdmin />);
    await screen.findByText("$50,000");

    await user.click(screen.getByRole("button", { name: /nueva regla/i }));

    const dialog = await screen.findByRole("heading", { name: /nueva regla de workflow/i });
    const modal = dialog.closest("div")?.parentElement?.parentElement;
    expect(modal).toBeTruthy();

    const param = screen.getByLabelText(/^parámetro$/i);
    await user.selectOptions(param, "destino");

    await waitFor(() => {
      expect(screen.queryByLabelText(/skip si menor a/i)).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText(/^país de destino$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/monto base/i)).not.toBeInTheDocument();
  });

  it("muestra preview por destino al cambiar parámetro", async () => {
    const user = userEvent.setup();
    render(<WorkflowRulesAdmin />);
    await screen.findByText("$50,000");
    await user.click(screen.getByRole("button", { name: /nueva regla/i }));

    await user.selectOptions(screen.getByLabelText(/^parámetro$/i), "destino");
    const countrySelects = await screen.findAllByLabelText(/^país de destino$/i);
    await user.selectOptions(countrySelects[0], "1");

    await waitFor(() => {
      expect(screen.getByText(/al activarse/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/banda de importe/i)).not.toBeInTheDocument();
  });

  it("muestra vista previa en el modal al crear regla", async () => {
    const user = userEvent.setup();
    render(<WorkflowRulesAdmin />);
    await screen.findByText("$50,000");
    await user.click(screen.getByRole("button", { name: /nueva regla/i }));

    expect(await screen.findByText(/vista previa del efecto/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/resumen para 10000/i)).toBeInTheDocument();
    });
  });

  it("expande la guía rápida", async () => {
    const user = userEvent.setup();
    render(<WorkflowRulesAdmin />);
    await screen.findByText("$50,000");

    await user.click(screen.getByRole("button", { name: /cómo funcionan las reglas/i }));
    expect(await screen.findByText(/guía rápida/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/resumen para 10000/i)).toBeInTheDocument();
    });
  });
});
