/**
 * Unit tests for FxConversionPanel (GET /fx/convert via useFxConversion).
 */
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import FxConversionPanel from "@components/FxConversionPanel";
import { server } from "../mocks/server";

const API = "https://localhost:3000/api";

describe("FxConversionPanel", () => {
  it("does not render when disabled or amount is zero", () => {
    const { container } = render(
      <FxConversionPanel moneda="USD" montoOriginal={0} enabled={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows conversion data after debounced FX request", async () => {
    render(<FxConversionPanel moneda="USD" montoOriginal={50} enabled />);

    await waitFor(
      () => {
        expect(screen.getByText(/Equivalente en pesos/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(screen.getByText(/ECB \/ Frankfurter/i)).toBeInTheDocument();
    expect(screen.getByText("20.0000")).toBeInTheDocument();
  });

  it("shows error alert when FX endpoint fails", async () => {
    server.use(
      http.get(`${API}/fx/convert`, () =>
        HttpResponse.json({ error: "unavailable" }, { status: 503 }),
      ),
    );

    render(<FxConversionPanel moneda="USD" montoOriginal={45} enabled />);

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(screen.getByText(/No pudimos obtener el tipo de cambio/i)).toBeInTheDocument();
  });
});
