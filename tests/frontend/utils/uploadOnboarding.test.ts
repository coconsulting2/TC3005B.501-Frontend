/**
 * @file tests/frontend/utils/uploadOnboarding.test.ts
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@data/cookies", () => ({
  getSession: () => ({ token: "test-token" }),
}));

vi.mock("@stores/organizationStore", () => ({
  getImpersonatedOrgId: () => null,
}));

describe("applyImportPreview", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ csrfToken: "csrf" }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ created: [] }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends createNewOrganization and newOrganizationName in apply body", async () => {
    const { applyImportPreview } = await import("@utils/uploadOnboarding");

    await applyImportPreview("preview-token-abc", undefined, {
      createNewOrganization: true,
      newOrganizationName: "Acme Corp",
    });

    const applyCall = fetchMock.mock.calls[1];
    expect(applyCall[0]).toContain("/onboarding/import/apply");
    const body = JSON.parse(String(applyCall[1]?.body));
    expect(body.previewToken).toBe("preview-token-abc");
    expect(body.createNewOrganization).toBe(true);
    expect(body.newOrganizationName).toBe("Acme Corp");
  });
});
