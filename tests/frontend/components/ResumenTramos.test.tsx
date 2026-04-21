/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for ResumenTramos. Covers the loading state, the error
 * path, the empty state when there are no tramos, rendering of tramos
 * with origin/destination and formatted MXN money, the total general
 * in the footer, expanding a tramo row to reveal comprobantes with
 * their validation pills, and the fallback for tramos with no
 * comprobantes.
 */

import { describe, it, expect } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import ResumenTramos from "@components/ResumenTramos";
import { server } from "../mocks/server";

const API = "https://localhost:3000/api";

const fullPayload = {
  viaje_id: 42,
  total_general: 12500.75,
  tramos: [
    {
      tramo_id: 1,
      router_index: 0,
      origin_country: "MX",
      origin_city: "Monterrey",
      destination_country: "MX",
      destination_city: "CDMX",
      beginning_date: "2026-04-01T00:00:00.000Z",
      ending_date: "2026-04-03T00:00:00.000Z",
      total_tramo: 7500.5,
      comprobantes: [
        {
          gasto_tramo_id: 101,
          receipt_id: 9001,
          receipt_type: "Hospedaje",
          amount: 5000,
          validation: "approved",
          submission_date: "2026-04-02T10:00:00.000Z",
        },
        {
          gasto_tramo_id: 102,
          receipt_id: 9002,
          receipt_type: "Comida",
          amount: 2500.5,
          validation: "pending",
          submission_date: "2026-04-02T14:00:00.000Z",
        },
      ],
    },
    {
      tramo_id: 2,
      router_index: 1,
      origin_country: "MX",
      origin_city: "CDMX",
      destination_country: "US",
      destination_city: "Austin",
      beginning_date: "2026-04-04T00:00:00.000Z",
      ending_date: "2026-04-06T00:00:00.000Z",
      total_tramo: 5000.25,
      comprobantes: [],
    },
  ],
};

describe("ResumenTramos", () => {
  it("shows the loading message while the request is in flight", () => {
    server.use(
      http.get(`${API}/viajes/:id/resumen-tramos`, async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json(fullPayload);
      }),
    );
    render(<ResumenTramos requestId={42} token="t" />);
    expect(screen.getByText(/cargando resumen de tramos/i)).toBeInTheDocument();
  });

  it("shows the empty state when the payload contains no tramos", async () => {
    render(<ResumenTramos requestId={42} token="t" />);
    expect(
      await screen.findByText(/no hay tramos registrados/i),
    ).toBeInTheDocument();
  });

  it("shows an error alert when the request fails", async () => {
    server.use(
      http.get(`${API}/viajes/:id/resumen-tramos`, () =>
        HttpResponse.json({ error: "x" }, { status: 500 }),
      ),
    );
    render(<ResumenTramos requestId={42} token="t" />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/error 500/i);
  });

  it("renders the tramos with origin → destination and segment count", async () => {
    server.use(
      http.get(`${API}/viajes/:id/resumen-tramos`, () =>
        HttpResponse.json(fullPayload),
      ),
    );
    render(<ResumenTramos requestId={42} token="t" />);
    expect(
      await screen.findByText(/monterrey → cdmx/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/cdmx → austin/i)).toBeInTheDocument();
    expect(screen.getByText("2 tramos")).toBeInTheDocument();
  });

  it("renders the total general formatted in MXN currency", async () => {
    server.use(
      http.get(`${API}/viajes/:id/resumen-tramos`, () =>
        HttpResponse.json(fullPayload),
      ),
    );
    render(<ResumenTramos requestId={42} token="t" />);
    await screen.findByText(/monterrey → cdmx/i);
    const totals = screen.getAllByText((_t, node) =>
      !!node?.textContent?.includes("12,500.75"),
    );
    expect(totals.length).toBeGreaterThan(0);
  });

  it("expands a tramo row to reveal its comprobantes with validation pills", async () => {
    server.use(
      http.get(`${API}/viajes/:id/resumen-tramos`, () =>
        HttpResponse.json(fullPayload),
      ),
    );
    const user = userEvent.setup();
    render(<ResumenTramos requestId={42} token="t" />);
    const summaryRow = (await screen.findByText(/monterrey → cdmx/i)).closest(
      "tr",
    ) as HTMLElement;

    expect(screen.queryByText("Hospedaje")).not.toBeInTheDocument();

    await user.click(summaryRow);

    await waitFor(() => {
      expect(screen.getByText("Hospedaje")).toBeInTheDocument();
    });
    expect(screen.getByText("Comida")).toBeInTheDocument();
    expect(screen.getByText("#9001")).toBeInTheDocument();

    const approvedPill = screen.getByText("Aprobado");
    expect(approvedPill.className).toMatch(/bg-success-50/);
    const pendingPill = screen.getByText("Pendiente");
    expect(pendingPill.className).toMatch(/bg-warning-50/);
  });

  it("collapses an expanded tramo row on second click", async () => {
    server.use(
      http.get(`${API}/viajes/:id/resumen-tramos`, () =>
        HttpResponse.json(fullPayload),
      ),
    );
    const user = userEvent.setup();
    render(<ResumenTramos requestId={42} token="t" />);
    const summaryRow = (await screen.findByText(/monterrey → cdmx/i)).closest(
      "tr",
    ) as HTMLElement;

    await user.click(summaryRow);
    await waitFor(() =>
      expect(screen.getByText("Hospedaje")).toBeInTheDocument(),
    );
    await user.click(summaryRow);
    await waitFor(() =>
      expect(screen.queryByText("Hospedaje")).not.toBeInTheDocument(),
    );
  });

  it("shows the 'sin comprobantes' message when expanding a tramo with no receipts", async () => {
    server.use(
      http.get(`${API}/viajes/:id/resumen-tramos`, () =>
        HttpResponse.json(fullPayload),
      ),
    );
    const user = userEvent.setup();
    render(<ResumenTramos requestId={42} token="t" />);
    const secondRow = (await screen.findByText(/cdmx → austin/i)).closest(
      "tr",
    ) as HTMLElement;
    await user.click(secondRow);
    expect(
      await screen.findByText(/sin comprobantes asociados/i),
    ).toBeInTheDocument();
  });

  it("renders rejected validation pill with accent styles when present", async () => {
    const payloadWithRejected = {
      ...fullPayload,
      tramos: [
        {
          ...fullPayload.tramos[0],
          comprobantes: [
            {
              gasto_tramo_id: 201,
              receipt_id: 9100,
              receipt_type: "Transporte",
              amount: 500,
              validation: "rejected",
              submission_date: "2026-04-02T10:00:00.000Z",
            },
          ],
        },
      ],
    };
    server.use(
      http.get(`${API}/viajes/:id/resumen-tramos`, () =>
        HttpResponse.json(payloadWithRejected),
      ),
    );
    const user = userEvent.setup();
    render(<ResumenTramos requestId={42} token="t" />);
    const row = (await screen.findByText(/monterrey → cdmx/i)).closest(
      "tr",
    ) as HTMLElement;
    await user.click(row);
    const rejected = await screen.findByText("Rechazado");
    expect(rejected.className).toMatch(/bg-accent-50/);
  });

  it("uses singular 'tramo' in the header when there is exactly one", async () => {
    server.use(
      http.get(`${API}/viajes/:id/resumen-tramos`, () =>
        HttpResponse.json({
          viaje_id: 1,
          total_general: 100,
          tramos: [fullPayload.tramos[1]],
        }),
      ),
    );
    render(<ResumenTramos requestId={1} token="t" />);
    expect(await screen.findByText("1 tramo")).toBeInTheDocument();
  });
});
