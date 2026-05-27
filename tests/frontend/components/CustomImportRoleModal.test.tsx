/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for the "Otro" modal inside OnboardingImportAdmin (BUG-003).
 * Exercises the new customRoleName input — typed name flows into onSave,
 * empty name keeps onSave free of the field (backend falls back to its
 * automatic `Imp·…` name), and an over-long name surfaces the validation
 * hint and short-circuits onSave. Mounting the modal directly avoids
 * having to drive the entire import flow for an isolated UI change.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomImportRoleModal } from "@views/admin/OnboardingImportAdmin";
import type {
  CustomImportRoleSpec,
  ImportUserPreview,
  PermissionsCatalog,
} from "@type/onboardingImport";

const ROLES_AVAILABLE = ["Solicitante", "N1", "N2"];

const ROLE_PERMS_BY_NAME = new Map<string, string[]>([
  ["solicitante", ["requests:read", "requests:create"]],
  ["n1", ["requests:read", "requests:approve"]],
  ["n2", ["requests:read", "requests:approve"]],
]);

const CATALOG: PermissionsCatalog = {
  groups: [
    {
      resource: "requests",
      label: "Solicitudes",
      items: [
        { code: "requests:read", action: "read", description: "Leer solicitudes" },
        { code: "requests:create", action: "create", description: "Crear solicitudes" },
        { code: "requests:approve", action: "approve", description: "Aprobar solicitudes" },
      ],
    },
  ],
};

function makePreviewRow(overrides: Partial<ImportUserPreview> = {}): ImportUserPreview {
  return {
    userName: "ana.lopez",
    email: "ana.lopez@example.com",
    roleName: "Solicitante",
    rolePermissionCodes: ["requests:read", "requests:create"],
    effectivePermissions: ["requests:read", "requests:create"],
    needsRoleMapping: false,
    ...overrides,
  };
}

function renderModal(extra: Partial<{
  initialSpec: CustomImportRoleSpec | null;
  onSave: (spec: CustomImportRoleSpec) => void;
  onClose: () => void;
}> = {}) {
  const onSave = extra.onSave ?? vi.fn();
  const onClose = extra.onClose ?? vi.fn();
  render(
    <CustomImportRoleModal
      open
      userName="ana.lopez"
      previewRow={makePreviewRow()}
      initialSpec={extra.initialSpec ?? null}
      rolesAvailable={ROLES_AVAILABLE}
      rolePermissionsByName={ROLE_PERMS_BY_NAME}
      catalog={CATALOG}
      onClose={onClose}
      onSave={onSave}
    />,
  );
  return { onSave, onClose };
}

describe("CustomImportRoleModal — customRoleName (BUG-003)", () => {
  it("renders the custom role name input next to the rol base select", () => {
    renderModal();
    const input = screen.getByLabelText(/nombre del rol personalizado/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", expect.stringMatching(/gerente regional/i));
  });

  it("emits customRoleName in the saved spec when the admin types a name", async () => {
    const onSave = vi.fn();
    renderModal({ onSave });

    await userEvent.type(
      screen.getByLabelText(/nombre del rol personalizado/i),
      "Gerente Regional",
    );
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const spec = onSave.mock.calls[0][0] as CustomImportRoleSpec;
    expect(spec.customRoleName).toBe("Gerente Regional");
    expect(spec.templateRoleName).toBe("Solicitante");
    expect(spec.permissions.length).toBeGreaterThan(0);
  });

  it("omits customRoleName when the input is left empty (backend falls back to Imp·…)", async () => {
    const onSave = vi.fn();
    renderModal({ onSave });

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const spec = onSave.mock.calls[0][0] as CustomImportRoleSpec;
    expect(spec).not.toHaveProperty("customRoleName");
  });

  it("trims whitespace around the typed name before saving", async () => {
    const onSave = vi.fn();
    renderModal({ onSave });

    await userEvent.type(
      screen.getByLabelText(/nombre del rol personalizado/i),
      "  Supervisor de Planta  ",
    );
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    const spec = onSave.mock.calls[0][0] as CustomImportRoleSpec;
    expect(spec.customRoleName).toBe("Supervisor de Planta");
  });

  it("hydrates the input from initialSpec.customRoleName when the modal reopens", () => {
    renderModal({
      initialSpec: {
        templateRoleName: "N1",
        permissions: ["requests:read", "requests:approve"],
        customRoleName: "Coordinador",
      },
    });

    expect(screen.getByLabelText(/nombre del rol personalizado/i)).toHaveValue("Coordinador");
  });

  it("blocks save and surfaces an error when the name exceeds 40 characters", async () => {
    const onSave = vi.fn();
    renderModal({ onSave });
    const tooLong = "x".repeat(45);

    const input = screen.getByLabelText(/nombre del rol personalizado/i) as HTMLInputElement;
    // maxLength=40 atrapa el typing humano, pero el bug puede llegar por
    // hidratación previa del estado (initialSpec viejo, autocompletar) — usamos
    // fireEvent.change para reproducir ese caso sin que React filtre el input.
    fireEvent.change(input, { target: { value: tooLong } });
    fireEvent.blur(input);

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/40 caracteres/i)).toBeInTheDocument();
  });
});
