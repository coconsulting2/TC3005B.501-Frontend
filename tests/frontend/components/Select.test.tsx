/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for the Select base component. Covers rendering, opening
 * the listbox, selecting options, search filter, keyboard navigation
 * (Enter/Escape/ArrowDown/ArrowUp), error/helper text and disabled state.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Select from "@components/Select";

const options = [
  { value: "mx", label: "México" },
  { value: "us", label: "Estados Unidos" },
  { value: "ca", label: "Canadá" },
];

describe("Select", () => {
  it("renders with placeholder when no value is selected", () => {
    render(<Select name="country" options={options} />);
    expect(screen.getByText("Seleccionar...")).toBeInTheDocument();
  });

  it("renders the selected option label", () => {
    render(<Select name="country" options={options} value="us" />);
    expect(screen.getByText("Estados Unidos")).toBeInTheDocument();
  });

  it("renders with label", () => {
    render(<Select name="c" label="País" options={options} />);
    expect(screen.getByText("País")).toBeInTheDocument();
  });

  it("opens the listbox on click and shows all options", async () => {
    const user = userEvent.setup();
    render(<Select name="c" options={options} />);
    await user.click(screen.getByRole("button"));
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("México")).toBeInTheDocument();
    expect(within(listbox).getByText("Estados Unidos")).toBeInTheDocument();
    expect(within(listbox).getByText("Canadá")).toBeInTheDocument();
  });

  it("calls onChange and closes the listbox when an option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select name="c" options={options} onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Canadá"));
    expect(onChange).toHaveBeenCalledWith("ca");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("filters options when searchable and user types", async () => {
    const user = userEvent.setup();
    render(<Select name="c" options={options} searchable />);
    await user.click(screen.getByRole("button"));
    const search = screen.getByPlaceholderText("Buscar...") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "esta" } });
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Estados Unidos")).toBeInTheDocument();
    expect(within(listbox).queryByText("Canadá")).not.toBeInTheDocument();
    expect(within(listbox).queryByText("México")).not.toBeInTheDocument();
  });

  it("shows 'Sin resultados' when search has no matches", async () => {
    const user = userEvent.setup();
    render(<Select name="c" options={options} searchable />);
    await user.click(screen.getByRole("button"));
    const search = screen.getByPlaceholderText("Buscar...") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("opens with ArrowDown and selects highlighted option with Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select name="c" options={options} onChange={onChange} />);
    const trigger = screen.getByRole("button");
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("mx");
  });

  it("ArrowUp wraps around to the last option from index -1", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select name="c" options={options} onChange={onChange} />);
    const trigger = screen.getByRole("button");
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("ca");
  });

  it("closes the listbox when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<Select name="c" options={options} />);
    const trigger = screen.getByRole("button");
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    trigger.focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    render(<Select name="c" options={options} disabled />);
    await user.click(screen.getByRole("button"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders error message with aria-invalid", () => {
    render(
      <Select
        name="c"
        options={options}
        error="Campo requerido"
      />
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Campo requerido");
  });

  it("renders helperText when no error", () => {
    render(
      <Select name="c" options={options} helperText="Elige uno" />
    );
    expect(screen.getByText("Elige uno")).toBeInTheDocument();
  });

  it("closes when clicking outside the component", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Select name="c" options={options} />
        <button>fuera</button>
      </div>
    );
    await user.click(screen.getByRole("button", { name: /seleccionar/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "fuera" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
