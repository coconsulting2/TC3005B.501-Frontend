/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for UploadReceiptFiles, the integrated file uploader that
 * wraps the real POST /files/upload-receipt-files/:id call. Covers the
 * happy path (onDone is invoked once files are uploaded), the no-op
 * case when both files are null, the error path (onError is called
 * when the server rejects), and the receiptToReplace flow that
 * additionally issues a DELETE to remove the previous receipt.
 */

import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import UploadReceiptFiles from "@components/UploadReceiptFiles";
import { server } from "../mocks/server";

const API = "https://localhost:3000/api";

function pdf(name = "recibo.pdf") {
  return new File(["pdf-bytes"], name, { type: "application/pdf" });
}

function xml(name = "recibo.xml") {
  return new File(["<xml/>"], name, { type: "application/xml" });
}

describe("UploadReceiptFiles", () => {
  it("does not call onDone or onError when both files are null", async () => {
    const onDone = vi.fn();
    const onError = vi.fn();
    render(
      <UploadReceiptFiles
        receiptId={1}
        pdfFile={null}
        xmlFile={null}
        token="t"
        onDone={onDone}
        onError={onError}
      />,
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("uploads the files and calls onDone on success", async () => {
    const onDone = vi.fn();
    const onError = vi.fn();
    let requestPath = "";

    server.use(
      http.post(`${API}/files/upload-receipt-files/:id`, ({ request, params }) => {
        requestPath = new URL(request.url).pathname;
        expect(params.id).toBe("42");
        return HttpResponse.json({ ok: true });
      }),
    );

    render(
      <UploadReceiptFiles
        receiptId={42}
        pdfFile={pdf()}
        xmlFile={xml()}
        token="abc"
        onDone={onDone}
        onError={onError}
      />,
    );

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onError).not.toHaveBeenCalled();
    expect(requestPath).toBe("/api/files/upload-receipt-files/42");
  });

  it("uploads just the pdf when xmlFile is null", async () => {
    const onDone = vi.fn();
    server.use(
      http.post(`${API}/files/upload-receipt-files/:id`, () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    render(
      <UploadReceiptFiles
        receiptId={42}
        pdfFile={pdf()}
        xmlFile={null}
        token="t"
        onDone={onDone}
        onError={vi.fn()}
      />,
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it("calls onError when the upload endpoint fails", async () => {
    const onDone = vi.fn();
    const onError = vi.fn();
    server.use(
      http.post(`${API}/files/upload-receipt-files/:id`, () =>
        HttpResponse.json({ error: "boom" }, { status: 500 }),
      ),
    );
    render(
      <UploadReceiptFiles
        receiptId={42}
        pdfFile={pdf()}
        xmlFile={null}
        token="t"
        onDone={onDone}
        onError={onError}
      />,
    );
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onDone).not.toHaveBeenCalled();
    const err = onError.mock.calls[0][0] as Error;
    expect(err.message).toMatch(/error al subir los archivos/i);
  });

  it("issues a DELETE for the previous receipt when receiptToReplace is provided", async () => {
    const onDone = vi.fn();
    let deleteCalled = false;
    let deletedId = "";
    server.use(
      http.delete(`${API}/applicant/delete-receipt/:id`, ({ params }) => {
        deleteCalled = true;
        deletedId = String(params.id);
        return HttpResponse.json({ ok: true });
      }),
    );
    render(
      <UploadReceiptFiles
        receiptId={42}
        pdfFile={pdf()}
        xmlFile={null}
        token="t"
        receiptToReplace="77"
        onDone={onDone}
        onError={vi.fn()}
      />,
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(deleteCalled).toBe(true);
    expect(deletedId).toBe("77");
  });

  it("still calls onDone even if the DELETE of the previous receipt fails", async () => {
    const onDone = vi.fn();
    const onError = vi.fn();
    server.use(
      http.delete(`${API}/applicant/delete-receipt/:id`, () =>
        HttpResponse.json({ error: "nope" }, { status: 500 }),
      ),
    );
    render(
      <UploadReceiptFiles
        receiptId={42}
        pdfFile={pdf()}
        xmlFile={null}
        token="t"
        receiptToReplace="88"
        onDone={onDone}
        onError={onError}
      />,
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onError).not.toHaveBeenCalled();
  });
});
