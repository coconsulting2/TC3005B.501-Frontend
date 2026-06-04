/**
 * Description:
 * Unit tests for OnboardingImportAdmin — the bulk user import view (JSON / CSV).
 * Drives the full import flow end to end: the "Crear organización nueva"
 * checkbox (enabled vs. disabled while impersonating, JSON-only guard), file
 * selection + parsing for CSV and JSON, the preview phase (summary pills,
 * societies / cost-centers tables, roles catalog, the per-user preview table
 * with the "auto-detectado" badge, per-row role override <select>, per-user
 * and global password fields), opening the custom role and extra-permission
 * modals, the external-role mapping panel, validation errors on apply, and
 * the success / failure / done branches of the import submit.
 *
 * The onboarding upload util (uploadImportPreview / applyImportPreview) is
 * mocked so the preview / apply responses are fully deterministic and no real
 * HTTP call escapes the MSW "onUnhandledRequest: error" guard. The
 * organization store is mocked to toggle impersonation per test.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  PreviewImportResponse,
  ApplyImportResponse,
  ImportUserPreview,
  PermissionsCatalog,
} from "@type/onboardingImport";

/* ── Mocks ─────────────────────────────────────────────────────── */

// Mutable impersonation flag so each test can flip super-admin Ditta impersonation.
let impersonatedOrgIdValue: string | null = null;

vi.mock("@stores/organizationStore", () => ({
  getImpersonatedOrgId: () => impersonatedOrgIdValue,
  IMPERSONATED_ORG_CHANGE_EVENT: "coco:impersonatedOrgIdChanged",
  IMPERSONATED_ORG_ID_STORAGE_KEY: "coco:impersonatedOrgId",
}));

// Mock the onboarding upload util entirely: it is the only thing that hits the
// network, and mocking it keeps every backend interaction inside this file.
const uploadImportPreviewMock = vi.fn();
const applyImportPreviewMock = vi.fn();

vi.mock("@utils/uploadOnboarding", () => ({
  uploadImportPreview: (...args: unknown[]) => uploadImportPreviewMock(...args),
  applyImportPreview: (...args: unknown[]) => applyImportPreviewMock(...args),
}));

// Import the component AFTER the mocks are registered.
import OnboardingImportAdmin from "@views/admin/OnboardingImportAdmin";

/* ── Fixtures ──────────────────────────────────────────────────── */

const CATALOG: PermissionsCatalog = {
  groups: [
    {
      resource: "travel_request",
      label: "Solicitudes",
      items: [
        { code: "travel_request:create", action: "create", description: "Crear" },
        { code: "travel_request:view_own", action: "view_own", description: "Ver propias" },
        { code: "travel_request:authorize", action: "authorize", description: "Autorizar" },
      ],
    },
    {
      resource: "receipt",
      label: "Comprobantes",
      items: [
        { code: "receipt:upload", action: "upload", description: "Subir" },
        { code: "receipt:validate", action: "validate", description: "Validar" },
      ],
    },
  ],
};

const ROLES_CATALOG = [
  {
    roleName: "Solicitante",
    effectivePermissions: ["travel_request:create", "travel_request:view_own"],
  },
  {
    roleName: "N1",
    effectivePermissions: [
      "travel_request:create",
      "travel_request:view_own",
      "travel_request:authorize",
    ],
  },
  {
    roleName: "N2",
    effectivePermissions: [
      "travel_request:create",
      "travel_request:view_own",
      "travel_request:authorize",
      "receipt:validate",
    ],
  },
];

function makeUser(overrides: Partial<ImportUserPreview> = {}): ImportUserPreview {
  return {
    userName: "ana.lopez",
    email: "ana.lopez@example.com",
    roleName: "Solicitante",
    rolePermissionCodes: ["travel_request:create", "travel_request:view_own"],
    effectivePermissions: ["travel_request:create", "travel_request:view_own"],
    needsRoleMapping: false,
    department: "Ventas",
    ...overrides,
  };
}

function makePreview(overrides: Partial<PreviewImportResponse> = {}): PreviewImportResponse {
  return {
    previewToken: "tok-" + Math.random().toString(36).slice(2),
    strategy: "JSON",
    totalRows: 1,
    validRows: 1,
    invalidRows: 0,
    conflictRows: 0,
    needsRoleMappingCount: 0,
    unmappedExternalRoles: [],
    preview: [makeUser()],
    permissionsCatalog: CATALOG,
    rolesCatalog: ROLES_CATALOG,
    errors: [],
    conflicts: [],
    ...overrides,
  };
}

function makeApplyResult(overrides: Partial<ApplyImportResponse> = {}): ApplyImportResponse {
  return {
    created: 1,
    skipped: 0,
    createdUsers: [
      { userId: 10, userName: "ana.lopez", email: "ana.lopez@example.com" },
    ],
    appliedBy: 1,
    ...overrides,
  };
}

/* ── Helpers ───────────────────────────────────────────────────── */

const VALID_PWD = "Password1";

/** Builds a File of the requested type/name with arbitrary text content. */
function makeFile(name: string, type: string, content = "{}"): File {
  return new File([content], name, { type });
}

/**
 * Selects a file through the hidden <input type="file"> in the drop zone and
 * waits for the preview phase to render.
 */
async function uploadFile(_user: ReturnType<typeof userEvent.setup>, file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  // fireEvent.change bypasses the input's `accept` filter (which
  // userEvent.upload enforces) so we can also exercise the JSON-only guard
  // for create-org by feeding a CSV through the dropzone.
  fireEvent.change(input, { target: { files: [file] } });
}

/** Renders, resolves a preview, drives a file upload and waits for the table. */
async function renderWithPreview(
  preview: PreviewImportResponse,
  fileName = "users.json",
  fileType = "application/json",
) {
  uploadImportPreviewMock.mockResolvedValueOnce(preview);
  const user = userEvent.setup();
  render(<OnboardingImportAdmin />);
  await uploadFile(user, makeFile(fileName, fileType));
  // Preview phase rendered once the summary pills appear.
  await screen.findByText("Total filas");
  return user;
}

beforeEach(() => {
  impersonatedOrgIdValue = null;
  uploadImportPreviewMock.mockReset();
  applyImportPreviewMock.mockReset();
  window.localStorage.clear();
});

/* ── Tests ─────────────────────────────────────────────────────── */

describe("OnboardingImportAdmin — initial render", () => {
  it("shows the drop zone, the create-org checkbox and the accepted formats", () => {
    render(<OnboardingImportAdmin />);
    expect(
      screen.getByText(/arrastra tu archivo aquí o haz clic para seleccionarlo/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Crear organización nueva")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    expect(checkbox).not.toBeDisabled();
  });

  it("disables the create-org checkbox and warns while impersonating", () => {
    impersonatedOrgIdValue = "101";
    render(<OnboardingImportAdmin />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(
      screen.getByText(/antes de marcar esta opción/i),
    ).toBeInTheDocument();
  });

  it("uses a JSON-only accept attribute once create-org is checked", async () => {
    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.getAttribute("accept")).toBe(".json,.csv,.txt");
    await user.click(screen.getByRole("checkbox"));
    expect(input.getAttribute("accept")).toBe(".json,application/json");
  });
});

describe("OnboardingImportAdmin — file selection & parsing", () => {
  it("parses a JSON file and renders the preview summary", async () => {
    const preview = makePreview({ totalRows: 3, validRows: 2, invalidRows: 1 });
    await renderWithPreview(preview, "team.json", "application/json");

    expect(uploadImportPreviewMock).toHaveBeenCalledTimes(1);
    // Format detected line uses the strategy from the response.
    expect(screen.getByText("JSON")).toBeInTheDocument();
    expect(screen.getByText("team.json")).toBeInTheDocument();
    // Summary pills
    expect(screen.getByText("Total filas")).toBeInTheDocument();
    expect(screen.getByText("Válidos")).toBeInTheDocument();
    expect(screen.getByText("Con errores")).toBeInTheDocument();
  });

  it("parses a CSV file and reports the CSV strategy", async () => {
    const preview = makePreview({ strategy: "CSV" });
    await renderWithPreview(preview, "people.csv", "text/csv", );

    const callArgs = uploadImportPreviewMock.mock.calls[0];
    // 3rd arg carries createNewOrganization flag; should be false here.
    expect(callArgs[2]).toMatchObject({ createNewOrganization: false });
    expect(screen.getByText("CSV")).toBeInTheDocument();
  });

  it("shows a loading banner is replaced by the preview when parsing resolves", async () => {
    await renderWithPreview(makePreview(), "users.json");
    // After resolution, no loading text should be visible.
    expect(screen.queryByText(/analizando/i)).not.toBeInTheDocument();
    expect(screen.getByText(/vista previa/i)).toBeInTheDocument();
  });

  it("surfaces a parse error and offers to retry", async () => {
    uploadImportPreviewMock.mockRejectedValueOnce(new Error("Archivo inválido"));
    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    await uploadFile(user, makeFile("bad.json", "application/json"));

    expect(await screen.findByText("Archivo inválido")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: /intentar de nuevo/i });
    await user.click(retry);
    // Back to idle: the drop zone reappears.
    expect(
      screen.getByText(/arrastra tu archivo aquí/i),
    ).toBeInTheDocument();
  });
});

describe("OnboardingImportAdmin — create new organization flow", () => {
  it("blocks a non-JSON file when create-org is checked", async () => {
    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);
    await waitFor(() => expect(checkbox).toBeChecked());
    await uploadFile(user, makeFile("data.csv", "text/csv"));

    expect(await screen.findByText(/solo aplica a archivos JSON/i)).toBeInTheDocument();
    expect(uploadImportPreviewMock).not.toHaveBeenCalled();
  });

  it("passes createNewOrganization=true to the preview for a JSON file", async () => {
    uploadImportPreviewMock.mockResolvedValueOnce(
      makePreview({ previewCreateNewOrganization: true, organizationFromFile: { nombre: "Acme" } }),
    );
    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);
    // Wait for the checkbox state to commit so handleFile's closure sees it.
    await waitFor(() => expect(checkbox).toBeChecked());
    await uploadFile(user, makeFile("org.json", "application/json"));

    await screen.findByText("Total filas");
    expect(uploadImportPreviewMock.mock.calls[0][2]).toMatchObject({
      createNewOrganization: true,
    });
    // The org-name override field shows up with the file's name prefilled.
    const nameField = await screen.findByDisplayValue("Acme");
    expect(nameField).toBeInTheDocument();
  });

  it("lets the admin override the new organization name and sends it on apply", async () => {
    const preview = makePreview({
      previewCreateNewOrganization: true,
      organizationFromFile: { nombre: "Acme" },
    });
    uploadImportPreviewMock.mockResolvedValueOnce(preview);
    applyImportPreviewMock.mockResolvedValueOnce(
      makeApplyResult({ createdOrganization: { id: "55", nombre: "Acme Renamed" } }),
    );

    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);
    await waitFor(() => expect(checkbox).toBeChecked());
    await uploadFile(user, makeFile("org.json", "application/json"));
    await screen.findByText("Total filas");

    const nameField = (await screen.findByDisplayValue("Acme")) as HTMLInputElement;
    await user.clear(nameField);
    await user.type(nameField, "Acme Renamed");
    // Hint about the JSON name being overridden appears.
    expect(screen.getByText(/En el JSON venía/i)).toBeInTheDocument();

    // Global password to satisfy validation, then import.
    await user.type(
      screen.getByPlaceholderText(/contraseña común para todos/i),
      VALID_PWD,
    );
    await user.click(screen.getByRole("button", { name: /importar 1 usuario/i }));

    await screen.findByText(/importación completada/i);
    const applyArgs = applyImportPreviewMock.mock.calls[0];
    expect(applyArgs[2]).toMatchObject({
      createNewOrganization: true,
      newOrganizationName: "Acme Renamed",
    });
    expect(screen.getByText(/Organización nueva:/i)).toBeInTheDocument();
  });

  it("warns when the file describes an org but no new org is created", async () => {
    await renderWithPreview(
      makePreview({ organizationFromFile: { nombre: "Globex" } }),
      "users.json",
    );
    expect(
      screen.getByText(/El archivo describe la organización «Globex»/i),
    ).toBeInTheDocument();
  });

  it("warns that users land in Ditta when there is no impersonation and no new org", async () => {
    await renderWithPreview(makePreview(), "users.json");
    expect(
      screen.getByText(/se importarán en la organización Ditta/i),
    ).toBeInTheDocument();
  });
});

describe("OnboardingImportAdmin — preview table", () => {
  it("renders user rows with email, department and role permission count", async () => {
    await renderWithPreview(
      makePreview({
        preview: [
          makeUser({ userName: "ana.lopez", department: "Ventas" }),
          makeUser({
            userName: "luis.perez",
            email: "luis.perez@example.com",
            roleName: "N1",
            rolePermissionCodes: ROLES_CATALOG[1].effectivePermissions,
            department: undefined,
          }),
        ],
        totalRows: 2,
        validRows: 2,
      }),
    );

    expect(screen.getByText("ana.lopez")).toBeInTheDocument();
    expect(screen.getByText("luis.perez@example.com")).toBeInTheDocument();
    expect(screen.getByText("Ventas")).toBeInTheDocument();
    // Missing department renders an em dash.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    // Role permission count copy.
    expect(screen.getAllByText(/permisos efectivos/i).length).toBeGreaterThan(0);
  });

  it("shows the auto-detectado badge on an inferred role", async () => {
    await renderWithPreview(
      makePreview({
        preview: [makeUser({ roleAutoDetected: true })],
      }),
    );
    expect(screen.getByText(/auto-detectado/i)).toBeInTheDocument();
  });

  it("changes a user's role through the per-row override select and sends it on apply", async () => {
    const preview = makePreview({
      preview: [makeUser({ userName: "ana.lopez" })],
    });
    uploadImportPreviewMock.mockResolvedValueOnce(preview);
    applyImportPreviewMock.mockResolvedValueOnce(makeApplyResult());

    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    await uploadFile(user, makeFile("users.json", "application/json"));
    await screen.findByText("Total filas");

    // The role select in the row (combobox). Pick the override one (has "Mantener" option).
    const selects = screen.getAllByRole("combobox");
    const roleSelect = selects.find((s) =>
      within(s).queryByRole("option", { name: /mantener/i }),
    ) as HTMLSelectElement;
    expect(roleSelect).toBeTruthy();
    await user.selectOptions(roleSelect, "N2");

    // "Rol cambiado en la UI" note appears.
    expect(await screen.findByText(/rol cambiado en la ui/i)).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/contraseña común para todos/i),
      VALID_PWD,
    );
    await user.click(screen.getByRole("button", { name: /importar 1 usuario/i }));

    await screen.findByText(/importación completada/i);
    expect(applyImportPreviewMock.mock.calls[0][2]).toMatchObject({
      roleOverrides: { "ana.lopez": "N2" },
    });
  });

  it("accepts a per-user password override in the table", async () => {
    const preview = makePreview({ preview: [makeUser({ userName: "ana.lopez" })] });
    uploadImportPreviewMock.mockResolvedValueOnce(preview);
    applyImportPreviewMock.mockResolvedValueOnce(makeApplyResult());

    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    await uploadFile(user, makeFile("users.json", "application/json"));
    await screen.findByText("Total filas");

    const perUserPwd = screen.getByPlaceholderText(/si vacío, usa la global/i);
    await user.type(perUserPwd, VALID_PWD);

    await user.click(screen.getByRole("button", { name: /importar 1 usuario/i }));
    await screen.findByText(/importación completada/i);
    expect(applyImportPreviewMock.mock.calls[0][2]).toMatchObject({
      passwordOverrides: { "ana.lopez": VALID_PWD },
    });
  });

  it("toggles password visibility in the global password field", async () => {
    await renderWithPreview(makePreview());
    const globalPwd = screen.getByPlaceholderText(/contraseña común para todos/i);
    expect(globalPwd).toHaveAttribute("type", "password");
    // The show/hide toggle sits in the same wrapper as the global input;
    // scope to that wrapper to avoid the per-row toggle.
    const wrapper = globalPwd.parentElement as HTMLElement;
    const toggle = within(wrapper).getByRole("button", { name: /mostrar contraseña/i });
    const user = userEvent.setup();
    await user.click(toggle);
    expect(globalPwd).toHaveAttribute("type", "text");
  });

  it("renders detected societies and cost-centers tables", async () => {
    await renderWithPreview(
      makePreview({
        strategy: "CSV",
        societies: [{ code: "S1", name: "Sociedad Uno" }],
        departments: [{ costsCenter: "CC10", departmentName: "Finanzas" }],
      }),
      "data.csv",
      "text/csv",
    );
    expect(screen.getByText(/sociedades contables detectadas/i)).toBeInTheDocument();
    expect(screen.getByText("Sociedad Uno")).toBeInTheDocument();
    expect(screen.getByText(/centros de costos detectados/i)).toBeInTheDocument();
    expect(screen.getByText("Finanzas")).toBeInTheDocument();
  });

  it("renders the roles catalog details with effective permission counts", async () => {
    await renderWithPreview(makePreview());
    expect(screen.getByText(/Roles en esta organización/i)).toBeInTheDocument();
    // Roles listed inside the details (Solicitante / N1 / N2 appear in selects too).
    expect(screen.getAllByText("N1").length).toBeGreaterThan(0);
  });
});

describe("OnboardingImportAdmin — external role mapping", () => {
  it("requires mapping unmapped external roles before the import button shows", async () => {
    const preview = makePreview({
      needsRoleMappingCount: 1,
      unmappedExternalRoles: ["Manager"],
      preview: [
        makeUser({
          userName: "ext.user",
          roleName: undefined,
          needsRoleMapping: true,
          externalRoleLabel: "Manager",
        }),
      ],
    });
    uploadImportPreviewMock.mockResolvedValueOnce(preview);
    applyImportPreviewMock.mockResolvedValueOnce(makeApplyResult());

    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    await uploadFile(user, makeFile("ext.json", "application/json"));
    await screen.findByText("Total filas");

    // Mapping panel present; import button hidden until mapping complete.
    expect(screen.getByText(/Roles de otro sistema/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /importar 1 usuario/i }),
    ).not.toBeInTheDocument();

    // Map the "Manager" label to N1 via its dedicated select.
    const mapSelect = screen
      .getByText("Manager")
      .closest("label")!
      .querySelector("select") as HTMLSelectElement;
    await user.selectOptions(mapSelect, "N1");

    // Now the import button appears and apply receives the mapping.
    const importBtn = await screen.findByRole("button", { name: /importar 1 usuario/i });
    await user.type(
      screen.getByPlaceholderText(/contraseña común para todos/i),
      VALID_PWD,
    );
    await user.click(importBtn);

    await screen.findByText(/importación completada/i);
    expect(applyImportPreviewMock.mock.calls[0][2]).toMatchObject({
      roleMappings: { Manager: "N1" },
    });
  });
});

describe("OnboardingImportAdmin — modals", () => {
  it("opens the custom-role modal from the row's «Otro» option", async () => {
    await renderWithPreview(makePreview({ preview: [makeUser({ userName: "ana.lopez" })] }));
    const user = userEvent.setup();

    const selects = screen.getAllByRole("combobox");
    const roleSelect = selects.find((s) =>
      within(s).queryByRole("option", { name: /otro \(desde base/i }),
    ) as HTMLSelectElement;
    expect(roleSelect).toBeTruthy();

    await user.selectOptions(
      roleSelect,
      within(roleSelect).getByRole("option", { name: /otro \(desde base/i }),
    );

    // The custom-role modal renders with its title.
    expect(
      await screen.findByText(/Otro — rol a medida para ana\.lopez/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/rol base/i)).toBeInTheDocument();
  });

  it("saves a custom role from the modal and sends customImportRoles on apply", async () => {
    const preview = makePreview({ preview: [makeUser({ userName: "ana.lopez" })] });
    uploadImportPreviewMock.mockResolvedValueOnce(preview);
    applyImportPreviewMock.mockResolvedValueOnce(makeApplyResult());

    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    await uploadFile(user, makeFile("users.json", "application/json"));
    await screen.findByText("Total filas");

    const selects = screen.getAllByRole("combobox");
    const roleSelect = selects.find((s) =>
      within(s).queryByRole("option", { name: /otro \(desde base/i }),
    ) as HTMLSelectElement;
    await user.selectOptions(
      roleSelect,
      within(roleSelect).getByRole("option", { name: /otro \(desde base/i }),
    );

    const dialog = await screen.findByRole("dialog");
    // Save with the default selected permissions (Solicitante template).
    const saveBtn = within(dialog).getByRole("button", { name: /guardar/i });
    await user.click(saveBtn);

    // The row now states a new role will be created.
    expect(await screen.findByText(/se creará un rol nuevo al importar/i)).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/contraseña común para todos/i),
      VALID_PWD,
    );
    await user.click(screen.getByRole("button", { name: /importar 1 usuario/i }));
    await screen.findByText(/importación completada/i);

    const sent = applyImportPreviewMock.mock.calls[0][2];
    expect(sent.customImportRoles).toBeTruthy();
    expect(sent.customImportRoles["ana.lopez"].templateRoleName).toBe("Solicitante");
    expect(sent.customImportRoles["ana.lopez"].permissions.length).toBeGreaterThan(0);
  });

  it("opens the per-user extra-permissions modal and adds an extra permission", async () => {
    const preview = makePreview({ preview: [makeUser({ userName: "ana.lopez" })] });
    uploadImportPreviewMock.mockResolvedValueOnce(preview);
    applyImportPreviewMock.mockResolvedValueOnce(makeApplyResult());

    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    await uploadFile(user, makeFile("users.json", "application/json"));
    await screen.findByText("Total filas");

    await user.click(screen.getByRole("button", { name: /ver \/ añadir permisos/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Permisos por persona — ana\.lopez/i)).toBeInTheDocument();

    // "Autorizar" is not part of Solicitante's role → it's an addable extra.
    const autorizar = within(dialog).getByRole("checkbox", { name: /autorizar/i });
    expect(autorizar).not.toBeChecked();
    expect(autorizar).not.toBeDisabled();
    await user.click(autorizar);
    expect(within(dialog).getByText(/adicional al rol/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /cerrar/i }));
    // Row reflects the +1 extra.
    expect(await screen.findByText(/\+1 adicional/i)).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/contraseña común para todos/i),
      VALID_PWD,
    );
    await user.click(screen.getByRole("button", { name: /importar 1 usuario/i }));
    await screen.findByText(/importación completada/i);
    expect(applyImportPreviewMock.mock.calls[0][2].permissionExtras).toMatchObject({
      "ana.lopez": ["travel_request:authorize"],
    });
  });
});

describe("OnboardingImportAdmin — validation & apply branches", () => {
  it("rejects a weak global password before calling apply", async () => {
    await renderWithPreview(makePreview());
    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText(/contraseña común para todos/i),
      "weak",
    );
    await user.click(screen.getByRole("button", { name: /importar 1 usuario/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/contraseña global/i);
    expect(applyImportPreviewMock).not.toHaveBeenCalled();
  });

  it("requires a password (global or per-user) and lists the user without one", async () => {
    await renderWithPreview(makePreview({ preview: [makeUser({ userName: "ana.lopez" })] }));
    const user = userEvent.setup();
    // No password at all → apply blocked, alert names the user.
    await user.click(screen.getByRole("button", { name: /importar 1 usuario/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/ana\.lopez/);
    expect(applyImportPreviewMock).not.toHaveBeenCalled();
  });

  it("dismisses the apply-error banner with its Cerrar button", async () => {
    await renderWithPreview(makePreview());
    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText(/contraseña común para todos/i),
      "weak",
    );
    await user.click(screen.getByRole("button", { name: /importar 1 usuario/i }));
    const alert = await screen.findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: /cerrar/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("rejects a weak per-user password override", async () => {
    await renderWithPreview(makePreview({ preview: [makeUser({ userName: "ana.lopez" })] }));
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/si vacío, usa la global/i), "nope");
    await user.click(screen.getByRole("button", { name: /importar 1 usuario/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/contraseña para «ana\.lopez»/i);
    expect(applyImportPreviewMock).not.toHaveBeenCalled();
  });

  it("shows the done panel with created users and a failures list", async () => {
    const preview = makePreview({
      preview: [makeUser({ userName: "ana.lopez" })],
      validRows: 1,
    });
    uploadImportPreviewMock.mockResolvedValueOnce(preview);
    applyImportPreviewMock.mockResolvedValueOnce(
      makeApplyResult({
        created: 2,
        skipped: 1,
        createdUsers: [
          { userId: 10, userName: "ana.lopez", email: "ana.lopez@example.com" },
          { userId: 11, userName: "bob.smith", email: "bob.smith@example.com" },
        ],
        failures: [{ userName: "carl.jones", reason: "userName ya tomado" }],
      }),
    );

    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    await uploadFile(user, makeFile("users.json", "application/json"));
    await screen.findByText("Total filas");
    await user.type(
      screen.getByPlaceholderText(/contraseña común para todos/i),
      VALID_PWD,
    );
    await user.click(screen.getByRole("button", { name: /importar 1 usuario/i }));

    expect(await screen.findByText(/importación completada/i)).toHaveTextContent(/2 usuarios creados/i);
    expect(screen.getByText(/2 omitidos|, 1 omitidos/i)).toBeInTheDocument();
    expect(screen.getByText("bob.smith")).toBeInTheDocument();
    expect(screen.getByText(/filas con conflicto al guardar/i)).toBeInTheDocument();
    expect(screen.getByText("carl.jones")).toBeInTheDocument();

    // "Nueva importación" resets to the idle drop zone.
    await user.click(screen.getByRole("button", { name: /nueva importación/i }));
    expect(screen.getByText(/arrastra tu archivo aquí/i)).toBeInTheDocument();
  });

  it("renders the error phase when apply rejects", async () => {
    const preview = makePreview({ preview: [makeUser({ userName: "ana.lopez" })] });
    uploadImportPreviewMock.mockResolvedValueOnce(preview);
    applyImportPreviewMock.mockRejectedValueOnce(new Error("Fallo al aplicar"));

    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    await uploadFile(user, makeFile("users.json", "application/json"));
    await screen.findByText("Total filas");
    await user.type(
      screen.getByPlaceholderText(/contraseña común para todos/i),
      VALID_PWD,
    );
    await user.click(screen.getByRole("button", { name: /importar 1 usuario/i }));

    expect(await screen.findByText("Fallo al aplicar")).toBeInTheDocument();
  });

  it("shows validation errors and conflicts from the preview", async () => {
    await renderWithPreview(
      makePreview({
        validRows: 0,
        invalidRows: 1,
        conflictRows: 1,
        preview: [],
        errors: [{ row: 2, field: "email", message: "Email inválido" }],
        conflicts: [
          { userName: "dup.user", email: "dup@example.com", reason: "Ya existe" },
        ],
      }),
    );

    expect(screen.getByText(/Errores de validación/i)).toBeInTheDocument();
    expect(screen.getByText(/Email inválido/i)).toBeInTheDocument();
    // "Conflictos" also appears as a stat pill label; match the heading copy.
    expect(screen.getByText(/Conflictos \(ya existen en la org/i)).toBeInTheDocument();
    expect(screen.getByText("dup.user")).toBeInTheDocument();
    // With 0 valid rows there is no import button.
    expect(
      screen.queryByRole("button", { name: /^importar/i }),
    ).not.toBeInTheDocument();
  });

  it("cancels from the preview and returns to the idle drop zone", async () => {
    await renderWithPreview(makePreview());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(screen.getByText(/arrastra tu archivo aquí/i)).toBeInTheDocument();
  });

  it("warns that the file carried passwords which were discarded", async () => {
    await renderWithPreview(makePreview({ fileHadPasswords: true }));
    expect(
      screen.getByText(/El archivo traía contraseñas: fueron descartadas/i),
    ).toBeInTheDocument();
  });
});

describe("OnboardingImportAdmin — truncated preview", () => {
  it("notes that the table shows a subset when applyableUsernames exceeds preview", async () => {
    const preview = makePreview({
      totalRows: 5,
      validRows: 5,
      preview: [makeUser({ userName: "ana.lopez" })],
      applyableUsernames: ["ana.lopez", "u2", "u3", "u4", "u5"],
    });
    uploadImportPreviewMock.mockResolvedValueOnce(preview);
    applyImportPreviewMock.mockResolvedValueOnce(makeApplyResult({ created: 5 }));

    const user = userEvent.setup();
    render(<OnboardingImportAdmin />);
    await uploadFile(user, makeFile("big.json", "application/json"));
    await screen.findByText("Total filas");

    expect(
      screen.getByText(/la tabla muestra 1/i),
    ).toBeInTheDocument();

    // A global password covers the unseen users; import succeeds.
    await user.type(
      screen.getByPlaceholderText(/contraseña común para todos/i),
      VALID_PWD,
    );
    await user.click(screen.getByRole("button", { name: /importar 5 usuarios/i }));
    await waitFor(() => expect(applyImportPreviewMock).toHaveBeenCalledTimes(1));
    expect(applyImportPreviewMock.mock.calls[0][2]).toMatchObject({
      passwordGlobal: VALID_PWD,
    });
  });
});
