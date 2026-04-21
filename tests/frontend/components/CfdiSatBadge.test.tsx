/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for CfdiSatBadge. Covers the loading skeleton, the three
 * SAT statuses (vigente / cancelado / no_encontrado) with their correct
 * colored pills and labels, the error state with retry button, the
 * manual re-verify button, and the formatted verification timestamp.
 * All HTTP calls go through MSW.
 */

import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import CfdiSatBadge from "@components/CfdiSatBadge";
import { server } from "../mocks/server";

const API = "https://localhost:3000/api";

describe("CfdiSatBadge", () => {
  it("renders the loading skeleton before the request resolves", () => {
    render(<CfdiSatBadge receiptId={1} token="t" />);
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).not.toBeNull();
  });

  it("renders the 'Vigente' pill with success styles when status is vigente", async () => {
    render(<CfdiSatBadge receiptId={1} token="t" />);
    expect(await screen.findByText("Vigente")).toBeInTheDocument();
    const pill = screen.getByText("Vigente");
    expect(pill.className).toMatch(/bg-\[var\(--color-success-50\)\]/);
    expect(pill.className).toMatch(/text-\[var\(--color-success-500\)\]/);
  });

  it("renders the 'Cancelado' pill with error styles", async () => {
    server.use(
      http.get(`${API}/comprobantes/:id/validacion-sat`, () =>
        HttpResponse.json({
          status: "cancelado",
          verified_at: "2026-04-15T10:00:00.000Z",
        }),
      ),
    );
    render(<CfdiSatBadge receiptId={2} token="t" />);
    const pill = await screen.findByText("Cancelado");
    expect(pill.className).toMatch(/bg-\[var\(--color-error-50\)\]/);
    expect(pill.className).toMatch(/text-\[var\(--color-error-400\)\]/);
  });

  it("renders the 'No encontrado' pill with neutral styles", async () => {
    server.use(
      http.get(`${API}/comprobantes/:id/validacion-sat`, () =>
        HttpResponse.json({
          status: "no_encontrado",
          verified_at: "2026-04-15T10:00:00.000Z",
        }),
      ),
    );
    render(<CfdiSatBadge receiptId={3} token="t" />);
    const pill = await screen.findByText("No encontrado");
    expect(pill.className).toMatch(/bg-\[var\(--color-neutral-100\)\]/);
  });

  it("shows the verification timestamp formatted as a Spanish date", async () => {
    render(<CfdiSatBadge receiptId={1} token="t" />);
    const timestamp = await screen.findByText(/Verificado:/i);
    expect(timestamp.textContent).toMatch(/\d{2}/);
  });

  it("renders the 'Sin datos' fallback and a retry button when the request fails", async () => {
    server.use(
      http.get(`${API}/comprobantes/:id/validacion-sat`, () =>
        HttpResponse.json({ error: "boom" }, { status: 500 }),
      ),
    );
    render(<CfdiSatBadge receiptId={4} token="t" />);
    expect(await screen.findByText("Sin datos")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reintentar/i }),
    ).toBeInTheDocument();
  });

  it("re-fetches the validation when the Verificar button is clicked", async () => {
    const user = userEvent.setup();
    let callCount = 0;
    server.use(
      http.get(`${API}/comprobantes/:id/validacion-sat`, () => {
        callCount += 1;
        return HttpResponse.json({
          status: callCount === 1 ? "cancelado" : "vigente",
          verified_at: "2026-04-15T10:00:00.000Z",
        });
      }),
    );
    render(<CfdiSatBadge receiptId={5} token="t" />);
    expect(await screen.findByText("Cancelado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /verificar/i }));

    await waitFor(() =>
      expect(screen.getByText("Vigente")).toBeInTheDocument(),
    );
    expect(callCount).toBe(2);
  });

  it("retry button on error state re-triggers the fetch and can recover", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get(`${API}/comprobantes/:id/validacion-sat`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ error: "x" }, { status: 500 });
        }
        return HttpResponse.json({
          status: "vigente",
          verified_at: "2026-04-15T10:00:00.000Z",
        });
      }),
    );
    render(<CfdiSatBadge receiptId={6} token="t" />);
    await user.click(
      await screen.findByRole("button", { name: /reintentar/i }),
    );
    expect(await screen.findByText("Vigente")).toBeInTheDocument();
  });
});
