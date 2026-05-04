/**
 * Tests para RefundTimeLimitConfig (M2-006 RF-37).
 */
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import RefundTimeLimitConfig from "@components/RefundTimeLimitConfig";
import { server } from "../mocks/server";

const API = "https://localhost:3000/api";

describe("RefundTimeLimitConfig", () => {
  it("loads current values from API", async () => {
    server.use(
      http.get(`${API}/refunds/time-limit`, () => HttpResponse.json({
        daysAfterTrip: 7, graceDays: 1, blockOnExpiry: false, active: true,
      })),
    );
    render(<RefundTimeLimitConfig />);
    await waitFor(() => expect((screen.getByLabelText(/Días después/i) as HTMLInputElement).value).toBe("7"));
    expect((screen.getByLabelText(/gracia adicionales/i) as HTMLInputElement).value).toBe("1");
  });

  it("submits PUT with edited values", async () => {
    let received: any = null;
    server.use(
      http.get(`${API}/refunds/time-limit`, () => HttpResponse.json({
        daysAfterTrip: 14, graceDays: 0, blockOnExpiry: true, active: true,
      })),
      http.put(`${API}/refunds/time-limit`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ message: "ok" });
      }),
    );
    render(<RefundTimeLimitConfig />);
    await waitFor(() => screen.getByLabelText(/Días después/i));
    const input = screen.getByLabelText(/Días después/i);
    await userEvent.clear(input);
    await userEvent.type(input, "30");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(received).toEqual(expect.objectContaining({ daysAfterTrip: 30 })));
  });
});
