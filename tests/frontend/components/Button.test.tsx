/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for the Button base component. Covers rendering, default
 * props, all variants/sizes/colors, click events, disabled state and
 * basic accessibility.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Button from "@components/Button";

describe("Button", () => {
  it("renders children content", () => {
    render(<Button>Enviar</Button>);
    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
  });

  it("applies default classes when no props are passed", () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/bg-primary-500/);
    expect(btn.className).toMatch(/text-sm/);
    expect(btn).not.toBeDisabled();
  });

  it("renders all variant + color combinations without crashing", () => {
    const variants = ["filled", "border", "empty"] as const;
    const colors = ["primary", "accent", "success", "danger"] as const;
    for (const v of variants) {
      for (const c of colors) {
        const { unmount } = render(
          <Button variant={v} color={c}>
            {v}-{c}
          </Button>
        );
        expect(
          screen.getByRole("button", { name: `${v}-${c}` })
        ).toBeInTheDocument();
        unmount();
      }
    }
  });

  it("applies size classes for small/medium/big", () => {
    const { rerender } = render(<Button size="small">A</Button>);
    expect(screen.getByRole("button").className).toMatch(/text-xs/);

    rerender(<Button size="medium">A</Button>);
    expect(screen.getByRole("button").className).toMatch(/text-sm/);

    rerender(<Button size="big">A</Button>);
    expect(screen.getByRole("button").className).toMatch(/text-base/);
  });

  it("uses customSizeClass when size is custom", () => {
    render(
      <Button size="custom" customSizeClass="px-99 py-99 my-custom">
        Custom
      </Button>
    );
    expect(screen.getByRole("button").className).toMatch(/my-custom/);
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Clic</Button>);
    await user.click(screen.getByRole("button", { name: "Clic" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button onClick={onClick} disabled>
        Disabled
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Disabled" });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("appends extra className when provided", () => {
    render(<Button className="extra-class">A</Button>);
    expect(screen.getByRole("button").className).toMatch(/extra-class/);
  });

  it("forwards native button attributes (type, aria-label)", () => {
    render(
      <Button type="submit" aria-label="Guardar formulario">
        Save
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Guardar formulario" });
    expect(btn).toHaveAttribute("type", "submit");
  });
});
