/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for the ProgressBar base component. Covers rendering,
 * percentage calculation, value clamping, label visibility, color and
 * size variants, and ARIA attributes for accessibility.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProgressBar from "@components/ProgressBar";

describe("ProgressBar", () => {
  it("renders a progressbar with the correct ARIA attributes", () => {
    render(<ProgressBar value={40} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("computes width as a percentage of max", () => {
    render(<ProgressBar value={25} max={50} />);
    const bar = screen.getByRole("progressbar");
    const inner = bar.firstChild as HTMLElement;
    expect(inner.style.width).toBe("50%");
  });

  it("clamps values below 0 to 0%", () => {
    render(<ProgressBar value={-10} />);
    const bar = screen.getByRole("progressbar");
    const inner = bar.firstChild as HTMLElement;
    expect(inner.style.width).toBe("0%");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
  });

  it("clamps values above max to 100%", () => {
    render(<ProgressBar value={250} max={100} />);
    const bar = screen.getByRole("progressbar");
    const inner = bar.firstChild as HTMLElement;
    expect(inner.style.width).toBe("100%");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });

  it("does not render the label by default", () => {
    render(<ProgressBar value={30} />);
    expect(screen.queryByText("Progreso")).not.toBeInTheDocument();
  });

  it("renders the label and percentage when showLabel is true", () => {
    render(<ProgressBar value={30} showLabel />);
    expect(screen.getByText("Progreso")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("applies the chosen color class", () => {
    render(<ProgressBar value={50} color="success" />);
    const inner = screen.getByRole("progressbar").firstChild as HTMLElement;
    expect(inner.className).toMatch(/bg-\[var\(--color-success-200\)\]/);
  });

  it("applies the chosen size class", () => {
    render(<ProgressBar value={50} size="large" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.className).toMatch(/h-4/);
  });

  it("omits transition classes when animated is false", () => {
    render(<ProgressBar value={50} animated={false} />);
    const inner = screen.getByRole("progressbar").firstChild as HTMLElement;
    expect(inner.className).not.toMatch(/transition-all/);
  });
});
