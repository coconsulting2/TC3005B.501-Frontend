/**
 * Tests para PolicyExceptionModal (M2-006 RF-45).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import PolicyExceptionModal from "@components/PolicyExceptionModal";
import { server } from "../mocks/server";

const API = "https://localhost:3000/api";

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onCreated: vi.fn(),
  requestId: 5,
  receiptId: 50,
  policyId: 1,
  capId: 100,
  amountClaimed: 5000,
  excessAmount: 1500,
};

describe("PolicyExceptionModal", () => {
  it("does NOT render when open=false", () => {
    render(<PolicyExceptionModal {...baseProps} open={false} />);
    expect(screen.queryByLabelText(/Justificación/i)).toBeNull();
  });

  it("blocks submit when justification is too short", async () => {
    render(<PolicyExceptionModal {...baseProps} />);
    const textarea = screen.getByLabelText(/Justificación/i);
    await userEvent.type(textarea, "no");
    await userEvent.click(screen.getByRole("button", { name: /enviar/i }));
    const matches = await screen.findAllByText(/10 caracteres/i);
    expect(matches.length).toBeGreaterThan(1); // mensaje del Modal + error inline del <small>
    expect(matches.some((el) => el.tagName.toLowerCase() === "small")).toBe(true);
    expect(baseProps.onCreated).not.toHaveBeenCalled();
  });

  it("submits and invokes onCreated when justification is valid", async () => {
    server.use(
      http.post(`${API}/refunds/exceptions`, async () => HttpResponse.json({ exceptionId: 99, status: "PENDING" })),
    );
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(<PolicyExceptionModal {...baseProps} onCreated={onCreated} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/Justificación/i), "Justificación válida con motivo claro y suficiente.");
    await userEvent.click(screen.getByRole("button", { name: /enviar/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ exceptionId: 99, status: "PENDING" }));
    expect(onClose).toHaveBeenCalled();
  });
});
