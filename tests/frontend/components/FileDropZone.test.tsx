/**
 * Description:
 * Unit tests for the FileDropZone component. Covers rendering states
 * (idle, selected, uploading, done, error), file classification
 * (PDF / XML / image / rejected), callbacks (onPdfChange, onXmlChange,
 * onUploadComplete, onUploadError), auto-upload mode with XHR progress,
 * imperative ref (upload / getFiles / reset), international mode,
 * showMissingHighlight, merging incremental drops, and the "done" reset
 * flow.
 *
 * Note: react-dropzone is mocked so we can control the onDrop callback
 * directly without relying on native drag-and-drop events.
 * XMLHttpRequest upload is handled by MSW v2 (intercepts XHR in jsdom).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { http, HttpResponse } from "msw";
import FileDropZone, { type FileDropZoneHandle } from "@components/FileDropZone";
import { server } from "../mocks/server";

const API = "https://localhost:3000/api";
const UPLOAD_URL = `${API}/files/upload-receipt-files/99`;

/* ── Mock react-dropzone ── */

let capturedOnDrop: ((files: File[]) => void) | null = null;
let capturedIsDragActive = false;

vi.mock("react-dropzone", () => ({
  useDropzone: (opts: any) => {
    capturedOnDrop = opts.onDrop;
    return {
      getRootProps: () => ({
        role: "button",
        "aria-label": opts.accept && "image/jpeg" in opts.accept
          ? "Zona de carga de imagen del recibo"
          : "Zona de carga de archivos PDF y XML",
      }),
      getInputProps: () => ({ type: "file", style: { display: "none" } }),
      isDragActive: capturedIsDragActive,
    };
  },
}));

/* ── File factories ── */

function makePdf(name = "factura.pdf"): File {
  return new File(["pdf-content"], name, { type: "application/pdf" });
}

function makeXml(name = "factura.xml"): File {
  return new File(["xml-content"], name, { type: "application/xml" });
}

function makeTxt(name = "notas.txt"): File {
  return new File(["text"], name, { type: "text/plain" });
}

function makeJpg(name = "recibo.jpg"): File {
  return new File(["img-bytes"], name, { type: "image/jpeg" });
}

function makePng(name = "recibo.png"): File {
  return new File(["img-bytes"], name, { type: "image/png" });
}

/* ── Helpers ── */

/** Default success response for upload endpoint */
const DEFAULT_UPLOAD_RESPONSE = {
  message: "OK",
  pdf: { fileId: "pdf-id-1", fileName: "factura.pdf" },
  xml: { fileId: "xml-id-1", fileName: "factura.xml" },
};

/* ── Suite ── */

describe("FileDropZone", () => {
  beforeEach(() => {
    capturedOnDrop = null;
    capturedIsDragActive = false;
  });

  afterEach(() => {
    capturedIsDragActive = false;
  });

  /* ──────────────────────── Existing baseline tests ──────────────────────── */

  it("renders idle state with upload instructions", () => {
    render(<FileDropZone token="test-token" />);
    expect(screen.getByText(/arrastra tus archivos aquí/i)).toBeInTheDocument();
    expect(screen.getByText(/\.pdf/)).toBeInTheDocument();
  });

  it("shows XML requirement text for domestic trips", () => {
    render(<FileDropZone token="test-token" isInternational={false} />);
    expect(screen.getByText(/\.xml/)).toBeInTheDocument();
  });

  it("does not mention XML for international trips", () => {
    render(<FileDropZone token="test-token" isInternational={true} />);
    const hint = screen.getByText(/haz clic para seleccionar/i);
    expect(hint.textContent).not.toMatch(/\.xml/);
  });

  it("transitions to selected state when a PDF is dropped", async () => {
    render(<FileDropZone token="test-token" />);
    expect(capturedOnDrop).toBeTruthy();

    await act(async () => {
      capturedOnDrop!([makePdf()]);
    });

    expect(screen.getByText(/factura\.pdf/)).toBeInTheDocument();
  });

  it("calls onPdfChange when a PDF is dropped", async () => {
    const onPdfChange = vi.fn();
    render(<FileDropZone token="test-token" onPdfChange={onPdfChange} />);

    await act(async () => {
      capturedOnDrop!([makePdf()]);
    });

    expect(onPdfChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "factura.pdf" }),
    );
  });

  it("calls onXmlChange when an XML is dropped", async () => {
    const onXmlChange = vi.fn();
    render(<FileDropZone token="test-token" onXmlChange={onXmlChange} />);

    await act(async () => {
      capturedOnDrop!([makeXml()]);
    });

    expect(onXmlChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "factura.xml" }),
    );
  });

  it("classifies both PDF and XML from a single drop", async () => {
    const onPdfChange = vi.fn();
    const onXmlChange = vi.fn();
    render(
      <FileDropZone
        token="test-token"
        onPdfChange={onPdfChange}
        onXmlChange={onXmlChange}
      />,
    );

    await act(async () => {
      capturedOnDrop!([makePdf(), makeXml()]);
    });

    expect(onPdfChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "factura.pdf" }),
    );
    expect(onXmlChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "factura.xml" }),
    );
  });

  it("enters error state when a non-PDF/XML file is dropped", async () => {
    render(<FileDropZone token="test-token" />);

    await act(async () => {
      capturedOnDrop!([makeTxt()]);
    });

    expect(screen.getByText(/extensión no válida/i)).toBeInTheDocument();
    expect(screen.getByText(/notas\.txt/)).toBeInTheDocument();
  });

  it("enters error state when no valid files are provided", async () => {
    render(<FileDropZone token="test-token" />);

    await act(async () => {
      capturedOnDrop!([]);
    });

    expect(screen.getByText(/no se seleccionaron archivos válidos/i)).toBeInTheDocument();
  });

  it("shows a reset button after an error and can return to idle", async () => {
    render(<FileDropZone token="test-token" />);

    await act(async () => {
      capturedOnDrop!([makeTxt()]);
    });

    const retryButton = screen.getByText(/intentar de nuevo/i);
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(screen.getByText(/arrastra tus archivos aquí/i)).toBeInTheDocument();
  });

  it("has the correct aria-label for accessibility", () => {
    render(<FileDropZone token="test-token" />);
    expect(
      screen.getByRole("button", { name: /zona de carga/i }),
    ).toBeInTheDocument();
  });

  /* ──────────────────────── New coverage tests ──────────────────────── */

  /* ── International mode ── */

  it("international: accepts a JPG image and enters selected state", async () => {
    render(<FileDropZone token="test-token" isInternational={true} />);

    await act(async () => {
      capturedOnDrop!([makeJpg()]);
    });

    expect(screen.getByText(/recibo\.jpg/i)).toBeInTheDocument();
  });

  it("international: accepts a PNG image", async () => {
    const onPdfChange = vi.fn();
    render(
      <FileDropZone token="test-token" isInternational={true} onPdfChange={onPdfChange} />,
    );

    await act(async () => {
      capturedOnDrop!([makePng()]);
    });

    expect(onPdfChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "recibo.png" }),
    );
  });

  it("international: shows error when a non-image file is dropped", async () => {
    render(<FileDropZone token="test-token" isInternational={true} />);

    await act(async () => {
      capturedOnDrop!([makePdf()]);
    });

    expect(screen.getByText(/extensión no válida/i)).toBeInTheDocument();
    expect(screen.getByText(/solo se aceptan .jpg, .jpeg y .png/i)).toBeInTheDocument();
  });

  it("international: shows 'Gasto internacional' note in selected state", async () => {
    render(<FileDropZone token="test-token" isInternational={true} />);

    await act(async () => {
      capturedOnDrop!([makeJpg()]);
    });

    expect(screen.getByText(/gasto internacional/i)).toBeInTheDocument();
  });

  it("international: aria-label is for image upload", () => {
    render(<FileDropZone token="test-token" isInternational={true} />);
    expect(
      screen.getByRole("button", { name: /zona de carga de imagen/i }),
    ).toBeInTheDocument();
  });

  /* ── SelectedContent — missing file highlights ── */

  it("shows missing PDF chip text when only XML is dropped", async () => {
    render(<FileDropZone token="test-token" />);

    await act(async () => {
      capturedOnDrop!([makeXml()]);
    });

    // FileChip renders: "Falta archivo .pdf" (with space before the dot)
    expect(screen.getByText(/falta archivo \.pdf/i)).toBeInTheDocument();
  });

  it("shows missing XML chip text when only PDF is dropped", async () => {
    render(<FileDropZone token="test-token" />);

    await act(async () => {
      capturedOnDrop!([makePdf()]);
    });

    expect(screen.getByText(/falta archivo \.xml/i)).toBeInTheDocument();
  });

  it("showMissingHighlight prop renders without error", async () => {
    render(
      <FileDropZone token="test-token" showMissingHighlight={true} />,
    );

    await act(async () => {
      capturedOnDrop!([makePdf()]);
    });

    // Both file chips should be visible with one missing
    expect(screen.getByText(/PDF:/i)).toBeInTheDocument();
    expect(screen.getByText(/XML:/i)).toBeInTheDocument();
  });

  it("show-missing class on className triggers highlight logic", async () => {
    render(
      <FileDropZone token="test-token" className="show-missing" />,
    );

    await act(async () => {
      capturedOnDrop!([makePdf()]);
    });

    expect(screen.getByText(/PDF:/i)).toBeInTheDocument();
  });

  /* ── Merging incremental drops ── */

  it("merges a second drop with the first (adds XML after PDF)", async () => {
    const onPdfChange = vi.fn();
    const onXmlChange = vi.fn();
    render(
      <FileDropZone
        token="test-token"
        onPdfChange={onPdfChange}
        onXmlChange={onXmlChange}
      />,
    );

    await act(async () => {
      capturedOnDrop!([makePdf()]);
    });

    await act(async () => {
      capturedOnDrop!([makeXml()]);
    });

    // Both files should now be selected
    expect(screen.getByText(/factura\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/factura\.xml/)).toBeInTheDocument();
  });

  /* ── "Subir más archivos" button after done state ── */

  it("shows 'Subir más archivos' after upload completes and resets on click", async () => {
    server.use(
      http.post(`${API}/files/upload-receipt-files/:id`, () =>
        HttpResponse.json(DEFAULT_UPLOAD_RESPONSE),
      ),
      http.get(`${API}/user/csrf-token`, () =>
        HttpResponse.json({ csrfToken: "csrf-abc" }),
      ),
    );

    render(
      <FileDropZone
        token="test-token"
        uploadUrl={UPLOAD_URL}
      />,
    );

    await act(async () => {
      capturedOnDrop!([makePdf(), makeXml()]);
    });

    await waitFor(() =>
      expect(screen.queryByText(/subir más archivos/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText(/subir más archivos/i));
    expect(screen.getByText(/arrastra tus archivos aquí/i)).toBeInTheDocument();
  });

  /* ── Auto-upload mode (uploadUrl provided) ── */

  it("auto-upload: calls onUploadComplete with server response", async () => {
    const onUploadComplete = vi.fn();
    const onUploadError = vi.fn();

    server.use(
      http.post(`${API}/files/upload-receipt-files/:id`, () =>
        HttpResponse.json(DEFAULT_UPLOAD_RESPONSE),
      ),
      http.get(`${API}/user/csrf-token`, () =>
        HttpResponse.json({ csrfToken: "csrf-abc" }),
      ),
    );

    render(
      <FileDropZone
        token="test-token"
        uploadUrl={UPLOAD_URL}
        onUploadComplete={onUploadComplete}
        onUploadError={onUploadError}
      />,
    );

    await act(async () => {
      capturedOnDrop!([makePdf(), makeXml()]);
    });

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledTimes(1));
    expect(onUploadError).not.toHaveBeenCalled();

    // Done state content
    expect(screen.getByText(/archivos subidos correctamente/i)).toBeInTheDocument();
    expect(screen.getByText(/factura\.pdf/)).toBeInTheDocument();
  });

  it("auto-upload: calls onUploadError when server returns 500", async () => {
    const onUploadComplete = vi.fn();
    const onUploadError = vi.fn();

    server.use(
      http.post(`${API}/files/upload-receipt-files/:id`, () =>
        HttpResponse.json({ error: "Internal error" }, { status: 500 }),
      ),
      http.get(`${API}/user/csrf-token`, () =>
        HttpResponse.json({ csrfToken: "csrf-abc" }),
      ),
    );

    render(
      <FileDropZone
        token="test-token"
        uploadUrl={UPLOAD_URL}
        onUploadComplete={onUploadComplete}
        onUploadError={onUploadError}
      />,
    );

    await act(async () => {
      capturedOnDrop!([makePdf(), makeXml()]);
    });

    await waitFor(() => expect(onUploadError).toHaveBeenCalledTimes(1));
    expect(onUploadComplete).not.toHaveBeenCalled();
    // ErrorContent renders a heading "Error" and a message
    expect(screen.getAllByText(/error/i).length).toBeGreaterThan(0);
  });

  it("auto-upload: does not upload if only PDF is dropped (no XML yet, domestic)", async () => {
    const onUploadComplete = vi.fn();

    render(
      <FileDropZone
        token="test-token"
        uploadUrl={UPLOAD_URL}
        onUploadComplete={onUploadComplete}
      />,
    );

    await act(async () => {
      capturedOnDrop!([makePdf()]);
    });

    // Still in selected state — waiting for XML
    await new Promise((r) => setTimeout(r, 50));
    expect(onUploadComplete).not.toHaveBeenCalled();
    expect(screen.queryByText(/archivos subidos/i)).not.toBeInTheDocument();
  });

  it("auto-upload international: uploads image and calls onUploadComplete", async () => {
    const onUploadComplete = vi.fn();

    server.use(
      http.post(`${API}/files/upload-receipt-files/:id`, () =>
        HttpResponse.json({ message: "OK", receipt_image: { fileId: "img-id-1", fileName: "recibo.jpg" } }),
      ),
      http.get(`${API}/user/csrf-token`, () =>
        HttpResponse.json({ csrfToken: "csrf-abc" }),
      ),
    );

    render(
      <FileDropZone
        token="test-token"
        uploadUrl={UPLOAD_URL}
        isInternational={true}
        onUploadComplete={onUploadComplete}
      />,
    );

    await act(async () => {
      capturedOnDrop!([makeJpg()]);
    });

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/archivos subidos correctamente/i)).toBeInTheDocument();
  });

  /* ── DoneContent sub-component ── */

  it("DoneContent shows file names after successful upload", async () => {
    server.use(
      http.post(`${API}/files/upload-receipt-files/:id`, () =>
        HttpResponse.json(DEFAULT_UPLOAD_RESPONSE),
      ),
      http.get(`${API}/user/csrf-token`, () =>
        HttpResponse.json({ csrfToken: "csrf-abc" }),
      ),
    );

    render(
      <FileDropZone token="test-token" uploadUrl={UPLOAD_URL} />,
    );

    await act(async () => {
      capturedOnDrop!([makePdf(), makeXml()]);
    });

    await waitFor(() =>
      expect(screen.queryByText(/archivos subidos correctamente/i)).toBeInTheDocument(),
    );

    // File names shown in done state
    expect(screen.getByText(/factura\.pdf/)).toBeInTheDocument();
  });

  /* ── Imperative ref handle ── */

  it("ref.getFiles() returns current pdf and xml state", async () => {
    const ref = createRef<FileDropZoneHandle>();
    render(<FileDropZone token="test-token" ref={ref} />);

    // Initially both null
    expect(ref.current!.getFiles()).toEqual({ pdf: null, xml: null });

    await act(async () => {
      capturedOnDrop!([makePdf(), makeXml()]);
    });

    const files = ref.current!.getFiles();
    expect(files.pdf?.name).toBe("factura.pdf");
    expect(files.xml?.name).toBe("factura.xml");
  });

  it("ref.reset() returns component to idle state", async () => {
    const ref = createRef<FileDropZoneHandle>();
    render(<FileDropZone token="test-token" ref={ref} />);

    await act(async () => {
      capturedOnDrop!([makePdf()]);
    });

    expect(screen.getByText(/factura\.pdf/)).toBeInTheDocument();

    await act(async () => {
      ref.current!.reset();
    });

    expect(screen.getByText(/arrastra tus archivos aquí/i)).toBeInTheDocument();
    expect(ref.current!.getFiles()).toEqual({ pdf: null, xml: null });
  });

  it("ref.upload() throws if no PDF has been selected", async () => {
    const ref = createRef<FileDropZoneHandle>();
    render(<FileDropZone token="test-token" ref={ref} />);

    await expect(ref.current!.upload(UPLOAD_URL)).rejects.toThrow(
      /no se ha seleccionado un archivo pdf/i,
    );
  });

  it("ref.upload() throws with international message when isInternational and no file selected", async () => {
    const ref = createRef<FileDropZoneHandle>();
    render(<FileDropZone token="test-token" isInternational={true} ref={ref} />);

    await expect(ref.current!.upload(UPLOAD_URL)).rejects.toThrow(
      /no se ha seleccionado una imagen del recibo/i,
    );
  });

  it("ref.upload() performs upload and resolves with server response", async () => {
    const ref = createRef<FileDropZoneHandle>();

    server.use(
      http.post(`${API}/files/upload-receipt-files/:id`, () =>
        HttpResponse.json(DEFAULT_UPLOAD_RESPONSE),
      ),
      http.get(`${API}/user/csrf-token`, () =>
        HttpResponse.json({ csrfToken: "csrf-abc" }),
      ),
    );

    render(<FileDropZone token="test-token" ref={ref} />);

    await act(async () => {
      capturedOnDrop!([makePdf(), makeXml()]);
    });

    let response: any;
    await act(async () => {
      response = await ref.current!.upload(UPLOAD_URL);
    });

    expect(response).toMatchObject({ message: "OK" });
    expect(screen.getByText(/archivos subidos correctamente/i)).toBeInTheDocument();
  });

  it("ref.upload() sets error state when upload fails", async () => {
    const ref = createRef<FileDropZoneHandle>();

    server.use(
      http.post(`${API}/files/upload-receipt-files/:id`, () =>
        HttpResponse.json({ error: "fail" }, { status: 500 }),
      ),
      http.get(`${API}/user/csrf-token`, () =>
        HttpResponse.json({ csrfToken: "csrf-abc" }),
      ),
    );

    render(<FileDropZone token="test-token" ref={ref} />);

    await act(async () => {
      capturedOnDrop!([makePdf(), makeXml()]);
    });

    let threw = false;
    await act(async () => {
      try {
        await ref.current!.upload(UPLOAD_URL);
      } catch {
        threw = true;
      }
    });

    expect(threw).toBe(true);
    // The component transitions to error state — the "Error" heading should appear
    await waitFor(() =>
      expect(screen.getAllByText(/error/i).length).toBeGreaterThan(0),
    );
  });

  /* ── doUpload: XML missing for domestic ── */

  it("ref.upload() rejects when XML is missing for a domestic trip", async () => {
    const ref = createRef<FileDropZoneHandle>();

    render(<FileDropZone token="test-token" isInternational={false} ref={ref} />);

    await act(async () => {
      // Drop only a PDF — no XML
      capturedOnDrop!([makePdf()]);
    });

    await expect(ref.current!.upload(UPLOAD_URL)).rejects.toThrow(
      /se requiere un archivo xml para viajes nacionales/i,
    );
  });

  /* ── UploadingContent progress bar ── */

  it("UploadingContent renders a progressbar element", async () => {
    // Use a ref to trigger the upload and observe uploading state
    const ref = createRef<FileDropZoneHandle>();

    let resolveUpload!: (v: any) => void;
    // Override MSW to hang until we resolve manually
    server.use(
      http.get(`${API}/user/csrf-token`, () =>
        HttpResponse.json({ csrfToken: "csrf-abc" }),
      ),
      http.post(`${API}/files/upload-receipt-files/:id`, () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }).then(() => HttpResponse.json(DEFAULT_UPLOAD_RESPONSE)),
      ),
    );

    render(<FileDropZone token="test-token" uploadUrl={UPLOAD_URL} ref={ref} />);

    await act(async () => {
      capturedOnDrop!([makePdf(), makeXml()]);
    });

    // The upload is in flight — check for progressbar in the DOM
    const progressbar = await screen.findByRole("progressbar");
    expect(progressbar).toBeInTheDocument();

    // Let the upload complete
    await act(async () => {
      resolveUpload(undefined);
    });

    await waitFor(() =>
      expect(screen.queryByText(/archivos subidos correctamente/i)).toBeInTheDocument(),
    );
  });

  /* ── Error content directly after invalid-file drop ── */

  it("shows the specific error message inside ErrorContent after invalid drop", async () => {
    render(<FileDropZone token="test-token" />);

    await act(async () => {
      capturedOnDrop!([makeTxt()]);
    });

    // ErrorContent renders both the "Error" heading and the message detail
    expect(screen.getByText(/extensión no válida/i)).toBeInTheDocument();
    // The Error heading is also rendered by ErrorContent
    expect(screen.getByText(/^Error$/i)).toBeInTheDocument();
  });

  /* ── classifyFiles: extra coverage ── */

  it("ignores a second PDF when two PDFs are dropped (keeps first)", async () => {
    const onPdfChange = vi.fn();
    render(<FileDropZone token="test-token" onPdfChange={onPdfChange} />);

    await act(async () => {
      capturedOnDrop!([makePdf("a.pdf"), makePdf("b.pdf")]);
    });

    // Only the first PDF name should appear
    expect(screen.getByText(/a\.pdf/)).toBeInTheDocument();
    expect(screen.queryByText(/b\.pdf/)).not.toBeInTheDocument();
  });

  it("ignores a second XML when two XMLs are dropped (keeps first)", async () => {
    const onXmlChange = vi.fn();
    render(<FileDropZone token="test-token" onXmlChange={onXmlChange} />);

    await act(async () => {
      capturedOnDrop!([makeXml("a.xml"), makeXml("b.xml")]);
    });

    expect(screen.getByText(/a\.xml/)).toBeInTheDocument();
    expect(screen.queryByText(/b\.xml/)).not.toBeInTheDocument();
  });

  it("rejects files without extension (empty ext path)", async () => {
    const noExtFile = new File(["data"], "noextension", { type: "application/octet-stream" });
    render(<FileDropZone token="test-token" />);

    await act(async () => {
      capturedOnDrop!([noExtFile]);
    });

    expect(screen.getByText(/extensión no válida/i)).toBeInTheDocument();
  });

  it("international: ignores a second image (keeps first)", async () => {
    const onPdfChange = vi.fn();
    render(
      <FileDropZone token="test-token" isInternational={true} onPdfChange={onPdfChange} />,
    );

    await act(async () => {
      capturedOnDrop!([makeJpg("first.jpg"), makePng("second.png")]);
    });

    expect(screen.getByText(/first\.jpg/)).toBeInTheDocument();
    expect(screen.queryByText(/second\.png/)).not.toBeInTheDocument();
  });

  /* ── DoneContent with empty files array ── */

  it("DoneContent renders correctly when done files list is empty", async () => {
    server.use(
      http.post(`${API}/files/upload-receipt-files/:id`, () =>
        HttpResponse.json({ message: "OK" }),
      ),
      http.get(`${API}/user/csrf-token`, () =>
        HttpResponse.json({ csrfToken: "csrf-abc" }),
      ),
    );

    const ref = createRef<FileDropZoneHandle>();
    render(<FileDropZone token="test-token" uploadUrl={UPLOAD_URL} ref={ref} />);

    await act(async () => {
      capturedOnDrop!([makePdf(), makeXml()]);
    });

    await waitFor(() =>
      expect(screen.queryByText(/archivos subidos correctamente/i)).toBeInTheDocument(),
    );

    expect(screen.getByText(/archivos subidos correctamente/i)).toBeInTheDocument();
  });

  /* ── apiOriginFromUploadUrl: invalid URL path ── */

  it("auto-upload: handles invalid upload URL by showing error", async () => {
    const onUploadError = vi.fn();

    render(
      <FileDropZone
        token="test-token"
        uploadUrl="not-a-valid-url"
        onUploadError={onUploadError}
      />,
    );

    await act(async () => {
      capturedOnDrop!([makePdf(), makeXml()]);
    });

    await waitFor(() => expect(onUploadError).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
