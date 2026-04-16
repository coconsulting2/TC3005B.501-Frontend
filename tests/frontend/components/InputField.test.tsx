/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for the InputField base component. Covers rendering with
 * label, controlled vs uncontrolled value, change events, error and
 * helperText states, disabled, required indicator and ARIA attributes.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InputField from "@components/InputField";

describe("InputField", () => {
  it("renders with label and links it to the input via htmlFor/id", () => {
    render(<InputField name="email" label="Correo" />);
    const input = screen.getByLabelText("Correo");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("id", "email");
    expect(input).toHaveAttribute("name", "email");
  });

  it("renders without label when none is provided", () => {
    render(<InputField name="anon" placeholder="sin label" />);
    expect(screen.getByPlaceholderText("sin label")).toBeInTheDocument();
  });

  it("shows the required asterisk when required is true", () => {
    render(<InputField name="x" label="Nombre" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("works as uncontrolled input and updates internal value", async () => {
    const user = userEvent.setup();
    render(<InputField name="u" label="U" />);
    const input = screen.getByLabelText("U") as HTMLInputElement;
    await user.type(input, "hola");
    expect(input.value).toBe("hola");
  });

  it("works as controlled input and calls onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <InputField name="c" label="C" value="abc" onChange={onChange} />
    );
    const input = screen.getByLabelText("C") as HTMLInputElement;
    expect(input.value).toBe("abc");
    await user.type(input, "z");
    expect(onChange).toHaveBeenCalled();
  });

  it("renders error message and sets aria-invalid + role=alert", () => {
    render(
      <InputField name="err" label="Err" error="Campo obligatorio" />
    );
    const input = screen.getByLabelText("Err");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "err-error");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Campo obligatorio");
  });

  it("renders helperText when there is no error", () => {
    render(
      <InputField name="h" label="H" helperText="Texto de ayuda" />
    );
    expect(screen.getByText("Texto de ayuda")).toBeInTheDocument();
    expect(screen.getByLabelText("H")).toHaveAttribute(
      "aria-describedby",
      "h-helper"
    );
  });

  it("hides helperText when an error is present", () => {
    render(
      <InputField
        name="he"
        label="HE"
        helperText="Ayuda"
        error="Mal"
      />
    );
    expect(screen.queryByText("Ayuda")).not.toBeInTheDocument();
    expect(screen.getByText("Mal")).toBeInTheDocument();
  });

  it("respects disabled prop", async () => {
    const user = userEvent.setup();
    render(<InputField name="d" label="D" disabled />);
    const input = screen.getByLabelText("D") as HTMLInputElement;
    expect(input).toBeDisabled();
    await user.type(input, "x");
    expect(input.value).toBe("");
  });

  it("applies a default pattern based on type", () => {
    render(<InputField name="mail" label="Mail" type="email" />);
    expect(screen.getByLabelText("Mail")).toHaveAttribute("pattern");
  });

  it("respects an explicit pattern over the default", () => {
    render(
      <InputField name="p" label="P" type="text" pattern="^[a-z]+$" />
    );
    expect(screen.getByLabelText("P")).toHaveAttribute("pattern", "^[a-z]+$");
  });
});
