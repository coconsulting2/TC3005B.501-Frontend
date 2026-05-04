/**
 * Tests para RefundDashboard (M2-006 reescritura /reembolso.astro).
 */
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import RefundDashboard from "@components/RefundDashboard";
import { server } from "../mocks/server";

const API = "https://localhost:3000/api";

describe("RefundDashboard", () => {
  it("renders balance and history from initialData (no fetch)", () => {
    render(<RefundDashboard userId={1} initialData={{
      balance: 1234.56,
      history: [
        { requestId: 10, date: "2026-04-15", amount: 500, status: 8, tripEndDate: "2026-04-10", notes: null, receiptCount: 2 },
      ],
      pendingDeadlineWarning: null,
    }} />);
    expect(screen.getByText(/\$1,234\.56/)).toBeInTheDocument();
    expect(screen.getByText("#10")).toBeInTheDocument();
  });

  it("shows fallback when history is empty", async () => {
    server.use(
      http.get(`${API}/refunds/by-user/:userId`, () => HttpResponse.json({
        balance: 0, history: [], pendingDeadlineWarning: null,
      })),
    );
    render(<RefundDashboard userId={2} />);
    await waitFor(() => expect(screen.getByText(/Sin reembolsos previos/i)).toBeInTheDocument());
  });

  it("renders deadline warning banner when present", () => {
    render(<RefundDashboard userId={1} initialData={{
      balance: 0, history: [], pendingDeadlineWarning: "La solicitud #5 excedió el plazo.",
    }} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/excedió el plazo/i)).toBeInTheDocument();
  });

  it("displays error when API fails", async () => {
    server.use(
      http.get(`${API}/refunds/by-user/:userId`, () => HttpResponse.json({ error: "boom" }, { status: 500 })),
    );
    render(<RefundDashboard userId={3} />);
    await waitFor(() => expect(screen.getByText(/boom/i)).toBeInTheDocument());
  });
});
