/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for the FileDropZone base component. Covers the four visual
 * states (idle, hover, error, disabled), drag/drop, click-to-select,
 * file size + extension validation and the onFilesSelected/onError callbacks.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FileDropZone from "@components/FileDropZone";

function makeFile(name: string, sizeBytes: number, type = "application/pdf") {
  const file = new File(["x".repeat(sizeBytes)], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

function getDropZone(): HTMLElement {
  return screen.getByRole("button");
}

describe("FileDropZone", () => {
  it("renders the default label and is in idle state initially", () => {
    render(<FileDropZone onFilesSelected={vi.fn()} />);
    const zone = getDropZone();
    expect(
      screen.getByText(/arrastra archivos aquí/i)
    ).toBeInTheDocument();
    expect(zone.className).toMatch(/border-/);
    expect(zone.className).not.toMatch(/opacity-60/);
  });

  it("renders custom label and hint", () => {
    render(
      <FileDropZone
        onFilesSelected={vi.fn()}
        label="Subir comprobante"
        hint="PDF o XML hasta 10MB"
      />
    );
    expect(screen.getByText("Subir comprobante")).toBeInTheDocument();
    expect(screen.getByText("PDF o XML hasta 10MB")).toBeInTheDocument();
  });

  it("transitions to hover state on dragOver and back to idle on dragLeave", () => {
    render(<FileDropZone onFilesSelected={vi.fn()} />);
    const zone = getDropZone();

    fireEvent.dragOver(zone);
    expect(zone.className).toMatch(/border-\[var\(--color-primary-200\)\]/);

    fireEvent.dragLeave(zone);
    expect(zone.className).toMatch(/border-\[var\(--color-neutral-300\)\]/);
  });

  it("calls onFilesSelected with valid dropped files", () => {
    const onFilesSelected = vi.fn();
    render(<FileDropZone onFilesSelected={onFilesSelected} accept=".pdf" />);
    const file = makeFile("doc.pdf", 1024);
    fireEvent.drop(getDropZone(), {
      dataTransfer: { files: [file] },
    });
    expect(onFilesSelected).toHaveBeenCalledTimes(1);
    expect(onFilesSelected.mock.calls[0][0][0].name).toBe("doc.pdf");
  });

  it("enters error state and calls onError when file exceeds maxSizeMB", () => {
    const onError = vi.fn();
    const onFilesSelected = vi.fn();
    render(
      <FileDropZone
        maxSizeMB={1}
        onFilesSelected={onFilesSelected}
        onError={onError}
      />
    );
    const tooBig = makeFile("big.pdf", 2 * 1024 * 1024);
    fireEvent.drop(getDropZone(), {
      dataTransfer: { files: [tooBig] },
    });
    expect(onError).toHaveBeenCalled();
    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(
      screen.getByText(/excede el tamaño máximo/i)
    ).toBeInTheDocument();
    expect(getDropZone().className).toMatch(
      /border-\[var\(--color-warning-200\)\]/
    );
  });

  it("rejects files whose extension is not in accept", () => {
    const onError = vi.fn();
    const onFilesSelected = vi.fn();
    render(
      <FileDropZone
        accept=".pdf"
        onFilesSelected={onFilesSelected}
        onError={onError}
      />
    );
    const txt = makeFile("notas.txt", 100, "text/plain");
    fireEvent.drop(getDropZone(), {
      dataTransfer: { files: [txt] },
    });
    expect(onError).toHaveBeenCalled();
    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(
      screen.getByText(/no es un tipo permitido/i)
    ).toBeInTheDocument();
  });

  it("renders disabled state and ignores drops when disabled", () => {
    const onFilesSelected = vi.fn();
    render(<FileDropZone onFilesSelected={onFilesSelected} disabled />);
    const zone = getDropZone();
    expect(zone.className).toMatch(/opacity-60/);
    fireEvent.drop(zone, {
      dataTransfer: { files: [makeFile("a.pdf", 100)] },
    });
    expect(onFilesSelected).not.toHaveBeenCalled();
  });

  it("opens the file picker when clicked", () => {
    render(<FileDropZone onFilesSelected={vi.fn()} />);
    const zone = getDropZone();
    const input = zone.querySelector("input[type=file]") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(zone);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("handles selection through the underlying file input", () => {
    const onFilesSelected = vi.fn();
    render(<FileDropZone onFilesSelected={onFilesSelected} />);
    const input = getDropZone().querySelector(
      "input[type=file]"
    ) as HTMLInputElement;
    const file = makeFile("via-input.pdf", 100);
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledWith([
      expect.objectContaining({ name: "via-input.pdf" }),
    ]);
  });

  it("can be activated with the Enter key", () => {
    render(<FileDropZone onFilesSelected={vi.fn()} />);
    const zone = getDropZone();
    const input = zone.querySelector("input[type=file]") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.keyDown(zone, { key: "Enter" });
    expect(clickSpy).toHaveBeenCalled();
  });
});
