/**
 * Tests para PolicyAlert (M2-006 RF-44).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PolicyAlert from "@components/PolicyAlert";

describe("PolicyAlert", () => {
  it("does NOT render when exceeded=false", () => {
    const { container } = render(<PolicyAlert exceeded={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner with cap and unit when exceeded=true", () => {
    render(<PolicyAlert exceeded={true} capAmount={2500} capUnit="per_night" message="msg" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Excede la política de viáticos/i)).toBeInTheDocument();
    expect(screen.getByText(/msg/i)).toBeInTheDocument();
  });

  it("invokes onJustify when button clicked", async () => {
    const onJustify = vi.fn();
    render(<PolicyAlert exceeded={true} capAmount={1000} capUnit="per_event" onJustify={onJustify} />);
    await userEvent.click(screen.getByRole("button", { name: /justificar/i }));
    expect(onJustify).toHaveBeenCalledTimes(1);
  });

  it("falls back to generic message when no message provided", () => {
    render(<PolicyAlert exceeded={true} capAmount={500} capUnit="per_day" />);
    expect(screen.getByText(/por día/i)).toBeInTheDocument();
  });
});
