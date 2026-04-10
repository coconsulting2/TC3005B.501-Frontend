/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for the Toast base component. Covers rendering of message,
 * type styles, custom duration and the auto-dismiss behavior using
 * fake timers (slide-out animation + 300ms delay before unmount).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import Toast from "@components/Toast";

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the message", () => {
    render(<Toast message="Operación exitosa" type="success" />);
    expect(screen.getByText("Operación exitosa")).toBeInTheDocument();
  });

  it.each([
    ["success", /border-success-400/],
    ["error", /border-accent-400/],
    ["warning", /border-warning-400/],
    ["info", /border-/],
  ] as const)("applies %s style", (type, classRegex) => {
    render(<Toast message="hola" type={type} />);
    const inner = screen.getByText("hola").parentElement as HTMLElement;
    expect(inner.className).toMatch(classRegex);
  });

  it("auto-dismisses after the default duration (4000ms + 300ms)", () => {
    render(<Toast message="bye" type="info" />);
    expect(screen.getByText("bye")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByText("bye")).not.toBeInTheDocument();
  });

  it("auto-dismisses after a custom duration", () => {
    render(<Toast message="custom" type="info" duration={1000} />);
    expect(screen.getByText("custom")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByText("custom")).not.toBeInTheDocument();
  });

  it("remains visible before the duration elapses", () => {
    render(<Toast message="aún" type="info" duration={2000} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("aún")).toBeInTheDocument();
  });
});
