/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for the Modal base component. Covers conditional rendering
 * via show, title/message, confirm/cancel buttons, escape key, overlay
 * click, custom labels, type variants and basic accessibility.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "@components/Modal";

describe("Modal", () => {
  const baseProps = {
    title: "Confirmar acción",
    message: "¿Seguro que quieres continuar?",
    onClose: vi.fn(),
    show: true,
  };

  it("does not render when show is false", () => {
    render(<Modal {...baseProps} show={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title, message and dialog with aria-modal", () => {
    render(<Modal {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Confirmar acción")).toBeInTheDocument();
    expect(
      screen.getByText("¿Seguro que quieres continuar?")
    ).toBeInTheDocument();
  });

  it("renders only the cancel button when no onConfirm is provided", () => {
    render(<Modal {...baseProps} />);
    expect(
      screen.getByRole("button", { name: "Cancelar" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirmar" })
    ).not.toBeInTheDocument();
  });

  it("renders the confirm button when onConfirm is provided", () => {
    render(<Modal {...baseProps} onConfirm={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Confirmar" })
    ).toBeInTheDocument();
  });

  it("calls onClose when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal {...baseProps} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Modal {...baseProps} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal {...baseProps} onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the overlay (outside the dialog) is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal {...baseProps} onClose={onClose} />);
    const overlay = screen.getByRole("dialog").parentElement as HTMLElement;
    await user.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal {...baseProps} onClose={onClose} />);
    await user.click(screen.getByText("Confirmar acción"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders custom confirm and cancel labels", () => {
    render(
      <Modal
        {...baseProps}
        onConfirm={vi.fn()}
        confirmLabel="Aceptar"
        cancelLabel="Cerrar"
      />
    );
    expect(
      screen.getByRole("button", { name: "Aceptar" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cerrar" })
    ).toBeInTheDocument();
  });

  it("renders children inside the dialog", () => {
    render(
      <Modal {...baseProps}>
        <p>Contenido extra</p>
      </Modal>
    );
    expect(screen.getByText("Contenido extra")).toBeInTheDocument();
  });

  it("applies error style for type=error", () => {
    render(<Modal {...baseProps} type="error" onConfirm={vi.fn()} />);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm.className).toMatch(/bg-accent-400/);
  });
});
