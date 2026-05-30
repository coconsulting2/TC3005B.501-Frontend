/**
 * OnboardingImportAdmin — importación masiva de usuarios (JSON / CSV).
 *
 * Flujo:
 *   1. Drag & drop o selección de archivo.
 *   2. POST /preview → tabla de vista previa + errores.
 *   3. Botón "Importar" → POST /apply → resultado.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadImportPreview, applyImportPreview } from "@utils/uploadOnboarding";
import type {
  PreviewImportResponse,
  ApplyImportResponse,
  ImportValidationError,
  ImportConflict,
  PermissionsCatalog,
  ImportUserPreview,
  CustomImportRoleSpec,
} from "@type/onboardingImport";
import { getPermissionFriendlyLabel } from "@utils/permissionLabels";
import {
  getImpersonatedOrgId,
  IMPERSONATED_ORG_CHANGE_EVENT,
  IMPERSONATED_ORG_ID_STORAGE_KEY,
} from "@stores/organizationStore";

/** Misma regla que el backend (importación). */
const ONBOARDING_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_HINT =
  "Mínimo 8 caracteres, una mayúscula, una minúscula y un número.";

/** Tokens visuales alineados con global.css (Coco / editorial). */
const T = {
  ink: "var(--color-ink)",
  inkSecondary: "var(--color-ink-secondary)",
  inkMuted: "var(--color-ink-muted)",
  surface: "var(--color-surface-white)",
  surfaceMuted: "var(--color-surface-secondary)",
  surfaceTertiary: "var(--color-surface-tertiary)",
  border: "var(--color-neutral-300)",
  borderSoft: "var(--color-neutral-200)",
  rowAlt: "var(--color-surface-secondary)",
  headerBg: "var(--color-surface-tertiary)",
  primary: "var(--color-primary-500)",
  primarySoft: "var(--color-primary-100)",
  primaryWash: "var(--color-primary-50)",
  success: "var(--color-success-500)",
  successSoft: "var(--color-success-50)",
  warning: "var(--color-warning-500)",
  warningBg: "var(--color-warning-50)",
  warningBorder: "var(--color-warning-200)",
  error: "var(--color-error-500)",
  errorSoft: "var(--color-error-50)",
  infoBg: "var(--color-primary-50)",
  infoBorder: "var(--color-primary-200)",
  scrim: "rgba(10, 10, 10, 0.42)",
  /** Referencia técnica (código permiso): legible sobre fondo claro */
  technicalRef: "var(--color-primary-800, #2a3820)",
} as const;

interface Props {
  /**
   * Org destino explícita (poco habitual). Si no se pasa, `uploadImportPreview` / `applyImportPreview`
   * usan la org impersonada del selector principal (`getImpersonatedOrgId`), alineado con `apiRequest`.
   */
  orgId?: string;
}

type Phase = "idle" | "loading" | "preview" | "applying" | "done" | "error";

export default function OnboardingImportAdmin({ orgId }: Props) {
  const [phase, setPhase]       = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview]   = useState<PreviewImportResponse | null>(null);
  const [result, setResult]     = useState<ApplyImportResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  /** Etiqueta externa (otra empresa) → rol elegido en esta org */
  const [roleMappingSelections, setRoleMappingSelections] = useState<Record<string, string>>({});
  /** userName → permisos directos adicionales (no incluidos en el rol). */
  const [permissionExtrasByUser, setPermissionExtrasByUser] = useState<
    Record<string, string[]>
  >({});
  const [globalPassword, setGlobalPassword] = useState("");
  const [passwordOverridesByUser, setPasswordOverridesByUser] = useState<Record<string, string>>({});
  /** userName → rol elegido en la UI (sobrescribe el del archivo y los mappings). */
  const [roleOverridesByUser, setRoleOverridesByUser] = useState<Record<string, string>>({});
  /** userName → rol a medida (se crea en BD al importar; base + lista exacta de permisos). */
  const [customImportRolesByUser, setCustomImportRolesByUser] = useState<
    Record<string, CustomImportRoleSpec>
  >({});
  const [previewApplyError, setPreviewApplyError] = useState("");
  /** Vista previa con `?create_new_org=1` (solo JSON con bloque organization + permiso crear org). */
  const [createNewOrgOption, setCreateNewOrgOption] = useState(false);
  /** Nombre editable de la org nueva (sobrescribe el del JSON al aplicar). */
  const [newOrgNameOverride, setNewOrgNameOverride] = useState("");

  /** Snapshot reactivo de impersonación (localStorage + evento al cambiar en la misma pestaña). */
  const [impersonatedOrgId, setImpersonatedOrgSnapshot] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const id = getImpersonatedOrgId();
      setImpersonatedOrgSnapshot(id);
      if (id) setCreateNewOrgOption((prev) => (prev ? false : prev));
    };
    sync();
    window.addEventListener(IMPERSONATED_ORG_CHANGE_EVENT, sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === IMPERSONATED_ORG_ID_STORAGE_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(IMPERSONATED_ORG_CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!preview?.previewToken) return;
    const next: Record<string, string> = {};
    for (const label of preview.unmappedExternalRoles ?? []) {
      next[label] = "";
    }
    setRoleMappingSelections(next);
    setPermissionExtrasByUser({});
    setGlobalPassword("");
    setPasswordOverridesByUser({});
    setRoleOverridesByUser({});
    setCustomImportRolesByUser({});
    setPreviewApplyError("");
    setCreateNewOrgOption(Boolean(preview.previewCreateNewOrganization));
    if (preview.organizationFromFile?.nombre) {
      setNewOrgNameOverride(preview.organizationFromFile.nombre);
    } else {
      setNewOrgNameOverride("");
    }
  }, [preview?.previewToken]);

  const handleFile = useCallback(
    async (file: File) => {
      const impNow = getImpersonatedOrgId();
      const lower = file.name.toLowerCase();
      const isJsonFile =
        lower.endsWith(".json") ||
        file.type === "application/json" ||
        file.type === "text/json";

      if (createNewOrgOption && impNow) {
        setFileName(file.name);
        setErrorMsg(
          "No puedes crear una organización nueva mientras impersonas otra. Sal de la impersonación e inténtalo de nuevo."
        );
        setPhase("error");
        return;
      }
      if (createNewOrgOption && !isJsonFile) {
        setFileName(file.name);
        setErrorMsg(
          "La opción «Crear organización nueva» solo aplica a archivos JSON (bloque organization + usuarios). Elige un archivo .json o desmarca la opción."
        );
        setPhase("error");
        return;
      }

      setFileName(file.name);
      setPhase("loading");
      setErrorMsg("");
      setPreviewApplyError("");
      setPreview(null);
      setResult(null);
      try {
        const res = await uploadImportPreview(file, orgId, {
          createNewOrganization: Boolean(createNewOrgOption && !getImpersonatedOrgId()),
        });
        setPreview(res);
        setPhase("preview");
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    [orgId, createNewOrgOption]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input para permitir re-subir el mismo archivo
    e.target.value = "";
  };

  const handleApply = async () => {
    if (!preview?.previewToken) return;

    const g = globalPassword.trim();
    if (g && !ONBOARDING_PASSWORD_RE.test(g)) {
      setPreviewApplyError(`Contraseña global: ${PASSWORD_HINT}`);
      return;
    }
    for (const [un, pwd] of Object.entries(passwordOverridesByUser)) {
      const t = pwd.trim();
      if (t && !ONBOARDING_PASSWORD_RE.test(t)) {
        setPreviewApplyError(`Contraseña para «${un}»: ${PASSWORD_HINT}`);
        return;
      }
    }
    if (!g) {
      // Lista de usuarios sobre los que validar overrides individuales:
      //  - Si el backend mandó applyableUsernames, lo usamos (cubre filas no visibles).
      //  - Si no, solo confiamos en preview.preview cuando contiene TODOS los válidos.
      //  - Si la tabla está truncada y no hay applyableUsernames, exigimos global.
      let usersToCheck: string[] | null = null;
      if (preview.applyableUsernames) {
        usersToCheck = preview.applyableUsernames;
      } else if (preview.preview.length >= preview.validRows) {
        usersToCheck = preview.preview.map((u) => u.userName);
      }
      if (!usersToCheck) {
        setPreviewApplyError(
          "Define una contraseña global: la tabla solo muestra una porción y no podemos asegurar la contraseña de los usuarios no visibles."
        );
        return;
      }
      const missing = usersToCheck.filter(
        (un) => !(passwordOverridesByUser[un] ?? "").trim()
      );
      if (missing.length > 0) {
        const sample = missing.slice(0, 3).join(", ");
        const more = missing.length > 3 ? ` y ${missing.length - 3} más` : "";
        setPreviewApplyError(
          `Define una contraseña global o una por usuario. Sin contraseña: ${sample}${more}.`
        );
        return;
      }
    }
    setPreviewApplyError("");

    setPhase("applying");
    try {
      const maps: Record<string, string> = {};
      for (const label of preview.unmappedExternalRoles ?? []) {
        const v = roleMappingSelections[label]?.trim();
        if (v) maps[label] = v;
      }
      const extrasPayload: Record<string, string[]> = {};
      for (const [un, codes] of Object.entries(permissionExtrasByUser)) {
        if (codes.length > 0) extrasPayload[un] = codes;
      }
      const pwdOverrides: Record<string, string> = {};
      for (const [un, pwd] of Object.entries(passwordOverridesByUser)) {
        if (pwd.trim()) pwdOverrides[un] = pwd.trim();
      }
      const customPayload: Record<string, CustomImportRoleSpec> = {};
      for (const [un, spec] of Object.entries(customImportRolesByUser)) {
        if (
          spec?.permissions?.length &&
          typeof spec.templateRoleName === "string" &&
          spec.templateRoleName.trim()
        ) {
          const customName =
            typeof spec.customRoleName === "string"
              ? spec.customRoleName.trim()
              : "";
          customPayload[un] = {
            templateRoleName: spec.templateRoleName.trim(),
            permissions: [...spec.permissions],
            ...(customName ? { customRoleName: customName } : {}),
          };
        }
      }

      const roleOverridesPayload: Record<string, string> = {};
      for (const [un, role] of Object.entries(roleOverridesByUser)) {
        if (customPayload[un]) continue;
        if (role.trim()) roleOverridesPayload[un] = role.trim();
      }

      const willCreateNewOrg = Boolean(preview.previewCreateNewOrganization);
      if (willCreateNewOrg && !newOrgNameOverride.trim()) {
        setPreviewApplyError("Indica el nombre de la organización nueva antes de importar.");
        return;
      }

      const res = await applyImportPreview(preview.previewToken, orgId, {
        roleMappings: preview.needsRoleMappingCount > 0 ? maps : undefined,
        roleOverrides:
          Object.keys(roleOverridesPayload).length > 0 ? roleOverridesPayload : undefined,
        permissionExtras:
          Object.keys(extrasPayload).length > 0 ? extrasPayload : undefined,
        passwordGlobal: g || undefined,
        passwordOverrides: Object.keys(pwdOverrides).length > 0 ? pwdOverrides : undefined,
        createNewOrganization: willCreateNewOrg,
        newOrganizationName: willCreateNewOrg ? newOrgNameOverride.trim() : undefined,
        customImportRoles:
          Object.keys(customPayload).length > 0 ? customPayload : undefined,
      });
      setResult(res);
      setPhase("done");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("idle");
    setFileName("");
    setPreview(null);
    setResult(null);
    setErrorMsg("");
    setRoleMappingSelections({});
    setPermissionExtrasByUser({});
    setGlobalPassword("");
    setPasswordOverridesByUser({});
    setRoleOverridesByUser({});
    setCustomImportRolesByUser({});
    setPreviewApplyError("");
    setCreateNewOrgOption(false);
    setNewOrgNameOverride("");
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", fontFamily: "inherit" }}>

      {/* ── Zona de drop ── */}
      {(phase === "idle" || phase === "error") && (
        <>
          <div
            style={{
              marginBottom: 16,
              padding: "16px 18px",
              borderRadius: 10,
              border: `1px solid ${T.borderSoft}`,
              background: T.surfaceMuted,
              fontSize: 16,
              lineHeight: 1.45,
              color: T.ink,
            }}
          >
            <label
              style={{
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                cursor: impersonatedOrgId ? "not-allowed" : "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={createNewOrgOption}
                disabled={Boolean(impersonatedOrgId)}
                onChange={(e) => setCreateNewOrgOption(e.target.checked)}
                style={{
                  marginTop: 4,
                  width: 24,
                  height: 24,
                  minWidth: 24,
                  minHeight: 24,
                  flexShrink: 0,
                  cursor: impersonatedOrgId ? "not-allowed" : "pointer",
                  accentColor: T.primary,
                }}
              />
              <span style={{ fontSize: 16, color: T.ink }}>
                <strong style={{ fontSize: 18, display: "block", marginBottom: 6 }}>
                  Crear organización nueva
                </strong>
                Al importar (solo JSON con bloque{" "}
                <code style={{ fontSize: 14, padding: "2px 6px", background: T.surfaceTertiary, borderRadius: 4 }}>
                  organization
                </code>{" "}
                + usuarios). Requiere permiso de crear organizaciones.
                {impersonatedOrgId ? (
                  <span style={{ display: "block", marginTop: 8, fontSize: 15, color: T.inkSecondary }}>
                    Sal de la <strong>impersonación</strong> de otra org antes de marcar esta opción.
                  </span>
                ) : null}
              </span>
            </label>
          </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? T.primary : T.border}`,
            borderRadius: 12,
            padding: "48px 32px",
            textAlign: "center",
            cursor: "pointer",
            background: dragging ? T.primaryWash : T.surfaceMuted,
            transition: "all 0.15s",
            marginBottom: 24,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: T.inkMuted, display: "block", marginBottom: 8 }}>
            upload_file
          </span>
          <p style={{ margin: 0, fontWeight: 600, color: T.inkSecondary }}>
            Arrastra tu archivo aquí o haz clic para seleccionarlo
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: T.inkMuted }}>
            Se aceptan archivos <strong>JSON</strong> y <strong>CSV</strong> (máx. 2 MB)
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={createNewOrgOption ? ".json,application/json" : ".json,.csv,.txt"}
            onChange={handleInputChange}
            style={{ display: "none" }}
          />
        </div>
        </>
      )}

      {/* ── Cargando ── */}
      {phase === "loading" && (
        <StatusBanner color={T.primary}>
          Analizando <strong>{fileName}</strong>…
        </StatusBanner>
      )}

      {/* ── Error ── */}
      {phase === "error" && (
        <StatusBanner color={T.error}>
          {errorMsg}
          <ResetButton onClick={reset} />
        </StatusBanner>
      )}

      {/* ── Preview ── */}
      {phase === "preview" && preview && (
        <PreviewPanel
          preview={preview}
          fileName={fileName}
          roleMappingSelections={roleMappingSelections}
          onRoleMappingChange={setRoleMappingSelections}
          permissionExtrasByUser={permissionExtrasByUser}
          onPermissionExtrasChange={setPermissionExtrasByUser}
          customImportRolesByUser={customImportRolesByUser}
          onCustomImportRolesChange={setCustomImportRolesByUser}
          globalPassword={globalPassword}
          onGlobalPasswordChange={setGlobalPassword}
          passwordOverridesByUser={passwordOverridesByUser}
          onPasswordOverrideChange={(userName, value) => {
            setPasswordOverridesByUser((prev) => ({ ...prev, [userName]: value }));
          }}
          roleOverridesByUser={roleOverridesByUser}
          onRoleOverrideChange={(userName, roleName) => {
            setRoleOverridesByUser((prev) => {
              const next = { ...prev };
              if (roleName) next[userName] = roleName;
              else delete next[userName];
              return next;
            });
            setCustomImportRolesByUser((prev) => {
              if (!prev[userName]) return prev;
              const next = { ...prev };
              delete next[userName];
              return next;
            });
          }}
          applyError={previewApplyError}
          onDismissApplyError={() => setPreviewApplyError("")}
          newOrgNameOverride={newOrgNameOverride}
          onNewOrgNameOverrideChange={setNewOrgNameOverride}
          impersonatedOrgId={impersonatedOrgId}
          onApply={handleApply}
          onReset={reset}
        />
      )}

      {/* ── Aplicando ── */}
      {phase === "applying" && (
        <StatusBanner color={T.primary}>
          Importando usuarios, por favor espera…
        </StatusBanner>
      )}

      {/* ── Done ── */}
      {phase === "done" && result && (
        <DonePanel result={result} onReset={reset} />
      )}
    </div>
  );
}

/* ── Sub-componentes ──────────────────────────────────────────── */

function StatusBanner({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface-secondary)",
        border: `1px solid ${color}`,
        borderRadius: 8,
        padding: "16px 20px",
        color,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        marginLeft: 12,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        textDecoration: "underline",
        fontSize: 13,
        color: "inherit",
      }}
    >
      Intentar de nuevo
    </button>
  );
}

function PreviewPanel({
  preview,
  fileName,
  roleMappingSelections,
  onRoleMappingChange,
  permissionExtrasByUser,
  onPermissionExtrasChange,
  customImportRolesByUser,
  onCustomImportRolesChange,
  globalPassword,
  onGlobalPasswordChange,
  passwordOverridesByUser,
  onPasswordOverrideChange,
  roleOverridesByUser,
  onRoleOverrideChange,
  applyError,
  onDismissApplyError,
  newOrgNameOverride,
  onNewOrgNameOverrideChange,
  impersonatedOrgId,
  onApply,
  onReset,
}: {
  preview: PreviewImportResponse;
  fileName: string;
  roleMappingSelections: Record<string, string>;
  onRoleMappingChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  permissionExtrasByUser: Record<string, string[]>;
  onPermissionExtrasChange: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  customImportRolesByUser: Record<string, CustomImportRoleSpec>;
  onCustomImportRolesChange: React.Dispatch<React.SetStateAction<Record<string, CustomImportRoleSpec>>>;
  globalPassword: string;
  onGlobalPasswordChange: (v: string) => void;
  passwordOverridesByUser: Record<string, string>;
  onPasswordOverrideChange: (userName: string, value: string) => void;
  roleOverridesByUser: Record<string, string>;
  /** Pasa "" para limpiar el override y volver al rol del archivo. */
  onRoleOverrideChange: (userName: string, roleName: string) => void;
  applyError: string;
  onDismissApplyError: () => void;
  newOrgNameOverride: string;
  onNewOrgNameOverrideChange: (value: string) => void;
  impersonatedOrgId: string | null;
  onApply: () => void;
  onReset: () => void;
}) {
  const [extrasModalUser, setExtrasModalUser] = useState<string | null>(null);
  const [customImportModalUser, setCustomImportModalUser] = useState<string | null>(null);
  const [importRoleSelectBump, setImportRoleSelectBump] = useState<Record<string, number>>({});
  const [showGlobalPassword, setShowGlobalPassword] = useState(false);
  const [passwordPeekByUser, setPasswordPeekByUser] = useState<Record<string, boolean>>({});

  const catalog = preview.permissionsCatalog;
  const applyableTotal = preview.applyableUsernames?.length ?? preview.validRows;

  /** roleName (lower) → códigos de permiso del rol. */
  const rolePermissionsByName = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of preview.rolesCatalog ?? []) {
      m.set(r.roleName.toLowerCase(), r.effectivePermissions);
    }
    return m;
  }, [preview.rolesCatalog]);

  /**
   * Devuelve la fila con `roleName` y `rolePermissionCodes` reemplazados por el
   * rol que el admin haya elegido en la UI. Sin override, devuelve la original.
   */
  const getEffectiveRow = useCallback(
    (u: ImportUserPreview): ImportUserPreview => {
      const custom = customImportRolesByUser[u.userName];
      if (custom?.permissions?.length) {
        const perms = [...custom.permissions];
        const customName = custom.customRoleName?.trim();
        return {
          ...u,
          roleName: customName
            ? customName
            : `Otro (base: ${custom.templateRoleName})`,
          rolePermissionCodes: perms,
          effectivePermissions: perms,
          needsRoleMapping: false,
        };
      }
      const override = (roleOverridesByUser[u.userName] ?? "").trim();
      if (!override) return u;
      const codes = rolePermissionsByName.get(override.toLowerCase()) ?? [];
      return {
        ...u,
        roleName: override,
        rolePermissionCodes: codes,
        effectivePermissions: codes,
        needsRoleMapping: false,
      };
    },
    [roleOverridesByUser, rolePermissionsByName, customImportRolesByUser]
  );

  const extrasModalRow = useMemo(() => {
    if (!extrasModalUser) return null;
    const found = preview.preview.find((u) => u.userName === extrasModalUser);
    return found ? getEffectiveRow(found) : null;
  }, [preview.preview, extrasModalUser, getEffectiveRow]);

  const hasErrors    = preview.errors.length > 0;
  const hasConflicts = preview.conflicts.length > 0;
  const rolesAvailable = (preview.rolesCatalog ?? []).map((r) => r.roleName);
  // El mapping de etiquetas externas se decide en el panel de arriba (afecta a todos
  // los usuarios con esa etiqueta, incluso los que no caben en la tabla). El override
  // por fila cambia el rol final solo para esa persona.
  const mappingComplete =
    !preview.needsRoleMappingCount ||
    (preview.unmappedExternalRoles ?? []).every(
      (label) => (roleMappingSelections[label] ?? "").trim() !== ""
    );
  const canApply     = preview.validRows > 0 && mappingComplete;

  return (
    <div>
      {applyError ? (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 8,
            border: `1px solid ${T.error}`,
            background: "var(--color-error-50)",
            color: T.error,
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <span>{applyError}</span>
          <button
            type="button"
            onClick={onDismissApplyError}
            style={{
              flexShrink: 0,
              border: "none",
              background: "transparent",
              color: T.error,
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: 12,
            }}
          >
            Cerrar
          </button>
        </div>
      ) : null}
      {preview.previewCreateNewOrganization ? (
        <div
          style={{
            marginBottom: 16,
            padding: "14px 16px",
            borderRadius: 8,
            border: `1px solid ${T.infoBorder}`,
            background: T.infoBg,
          }}
        >
          <p style={{ margin: "0 0 10px", fontSize: 14, color: T.ink }}>
            Se creará una organización nueva y después se importarán los usuarios en ella.
          </p>
          <label style={{ display: "block", fontSize: 13, color: T.inkSecondary }}>
            Nombre de la organización
            <input
              type="text"
              value={newOrgNameOverride}
              onChange={(e) => onNewOrgNameOverrideChange(e.target.value)}
              maxLength={200}
              placeholder={preview.organizationFromFile?.nombre ?? "Nombre de la empresa"}
              style={{
                display: "block",
                width: "100%",
                maxWidth: 420,
                marginTop: 6,
                padding: "8px 10px",
                fontSize: 15,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
              }}
            />
          </label>
          {preview.organizationFromFile?.nombre &&
          newOrgNameOverride.trim() !== preview.organizationFromFile.nombre ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: T.inkMuted }}>
              En el JSON venía «{preview.organizationFromFile.nombre}»; se usará el nombre indicado arriba.
            </p>
          ) : null}
        </div>
      ) : preview.organizationFromFile ? (
        <StatusBanner color={T.primary}>
          {`El archivo describe la organización «${preview.organizationFromFile.nombre}»; los usuarios se crearán en la org destino actual (no se crea org nueva).`}
        </StatusBanner>
      ) : null}
      {!preview.previewCreateNewOrganization && !impersonatedOrgId ? (
        <StatusBanner color={T.warning}>
          Sin impersonación activa, los usuarios se importarán en la organización Ditta (ROOT).
          Para importar en una org cliente, impersona esa organización desde Organizaciones.
        </StatusBanner>
      ) : null}
      {/* Resumen */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <StatPill label="Total filas"   value={preview.totalRows}   color={T.primary} />
        <StatPill label="Válidos"       value={preview.validRows}   color={T.success} />
        <StatPill label="Con errores"   value={preview.invalidRows} color={T.error} />
        <StatPill label="Conflictos"    value={preview.conflictRows} color={T.warning} />
      </div>

      <p style={{ fontSize: 13, color: T.inkMuted, marginBottom: 16 }}>
        Archivo: <strong style={{ color: T.ink }}>{fileName}</strong> · Formato detectado:{" "}
        <strong style={{ color: T.ink }}>{preview.strategy}</strong>
      </p>

      {/* ── Catálogos detectados en CSV multi-sección ── */}
      {preview.societies && preview.societies.length > 0 && (
        <details
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            background: T.surfaceMuted,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            fontSize: 13,
            color: T.inkSecondary,
          }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 600, color: T.ink }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: "middle", marginRight: 6 }}>domain</span>
            Sociedades contables detectadas ({preview.societies.length})
          </summary>
          <p style={{ margin: "8px 0", fontSize: 12, color: T.inkMuted }}>
            Se crearán o actualizarán al importar.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 4 }}>
            <thead>
              <tr style={{ background: T.headerBg }}>
                {["Código", "Nombre"].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: T.inkSecondary, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.societies.map((s, i) => (
                <tr key={s.code} style={{ background: i % 2 === 0 ? T.surface : T.rowAlt }}>
                  <td style={{ padding: "6px 10px", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{s.code}</td>
                  <td style={{ padding: "6px 10px" }}>{s.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {preview.departments && preview.departments.length > 0 && (
        <details
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            background: T.surfaceMuted,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            fontSize: 13,
            color: T.inkSecondary,
          }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 600, color: T.ink }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: "middle", marginRight: 6 }}>account_tree</span>
            Centros de costos detectados ({preview.departments.length})
          </summary>
          <p style={{ margin: "8px 0", fontSize: 12, color: T.inkMuted }}>
            Se crearán o actualizarán como departamentos al importar.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 4 }}>
            <thead>
              <tr style={{ background: T.headerBg }}>
                {["CeCo", "Departamento"].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: T.inkSecondary, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.departments.map((d, i) => (
                <tr key={d.costsCenter} style={{ background: i % 2 === 0 ? T.surface : T.rowAlt }}>
                  <td style={{ padding: "6px 10px", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{d.costsCenter}</td>
                  <td style={{ padding: "6px 10px" }}>{d.departmentName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {preview.validRows > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: "14px 16px",
            background: T.surfaceMuted,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            fontSize: 13,
            color: T.inkSecondary,
          }}
        >
          <strong style={{ color: T.ink }}>Contraseñas</strong>
          <p style={{ margin: "8px 0 10px", lineHeight: 1.45 }}>
            Por seguridad, las contraseñas que vinieran en el archivo no se usan al importar:
            define una <strong>contraseña común</strong> para todos los usuarios válidos
            ({applyableTotal}) o una contraseña por usuario en la tabla. {PASSWORD_HINT}
          </p>
          {preview.fileHadPasswords ? (
            <p
              style={{
                margin: "0 0 10px",
                padding: "8px 10px",
                background: T.warningBg,
                border: `1px solid ${T.warningBorder}`,
                borderRadius: 6,
                fontSize: 12,
                color: T.warning,
              }}
            >
              El archivo traía contraseñas: fueron descartadas. Asigna una global o una por usuario
              antes de importar.
            </p>
          ) : null}
          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.inkSecondary, marginBottom: 4 }}>
              Misma contraseña para todo el lote
            </span>
            <div style={{ position: "relative", width: "100%", maxWidth: 380 }}>
              <input
                type={showGlobalPassword ? "text" : "password"}
                autoComplete="new-password"
                value={globalPassword}
                onChange={(e) => onGlobalPasswordChange(e.target.value)}
                placeholder="Define una contraseña común para todos…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 44px 10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  fontSize: 15,
                  background: T.surface,
                }}
              />
              <button
                type="button"
                aria-label={showGlobalPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShowGlobalPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: T.inkSecondary,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                  {showGlobalPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </label>
          {applyableTotal > preview.preview.length ? (
            <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>
              Hay {applyableTotal} usuarios a importar; la tabla muestra {preview.preview.length}. La
              contraseña global aplica también a los que no ves en la tabla.
            </p>
          ) : null}
        </div>
      )}

      {preview.needsRoleMappingCount > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: "14px 16px",
            background: T.warningBg,
            border: `1px solid ${T.warningBorder}`,
            borderRadius: 8,
            fontSize: 13,
            color: T.warning,
          }}
        >
          <strong>Roles de otro sistema:</strong> hay{" "}
          <strong>{preview.needsRoleMappingCount}</strong> usuario
          {preview.needsRoleMappingCount !== 1 ? "s" : ""} con etiquetas que no coinciden con los
          roles de esta organización. Asigna cada etiqueta a un rol de CocoConsulting antes de
          importar.
          {preview.embeddedRoleMappingsFromFile &&
            Object.keys(preview.embeddedRoleMappingsFromFile).length > 0 && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: T.inkSecondary }}>
                El JSON puede incluir en la raíz{" "}
                <code style={{ fontSize: 11, color: T.inkMuted }}>roleMappings</code> para anticipar equivalencias;
                lo que siga sin resolver aparece aquí.
              </p>
            )}
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {(preview.unmappedExternalRoles ?? []).map((label) => (
              <label
                key={label}
                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}
              >
                <span style={{ minWidth: 140, fontWeight: 600 }}>{label}</span>
                <span style={{ color: T.inkMuted }}>→</span>
                <select
                  value={roleMappingSelections[label] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onRoleMappingChange((prev) => ({ ...prev, [label]: v }));
                  }}
                  style={{
                    flex: 1,
                    minWidth: 200,
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: `1px solid ${T.border}`,
                    fontSize: 13,
                    background: T.surface,
                  }}
                >
                  <option value="">Selecciona rol en esta organización…</option>
                  {(preview.rolesCatalog ?? []).map((rc) => (
                    <option key={rc.roleName} value={rc.roleName}>
                      {rc.roleName}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {preview.rolesCatalog && preview.rolesCatalog.length > 0 && (
        <details
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            background: T.surfaceMuted,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            fontSize: 13,
            color: T.inkSecondary,
          }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 600, color: T.ink }}>
            Roles en esta organización ({preview.rolesCatalog.length}) — permisos efectivos por rol (incluye base de solicitante)
          </summary>
          <ul style={{ margin: "12px 0 0", paddingLeft: 18, listStyle: "disc" }}>
            {preview.rolesCatalog.map((rc) => (
              <li key={rc.roleName} style={{ marginBottom: 10 }}>
                <strong>{rc.roleName}</strong>
                {" "}
                <span style={{ color: T.inkMuted }}>
                  ({rc.effectivePermissions.length} permiso
                  {rc.effectivePermissions.length !== 1 ? "s" : ""})
                </span>
                {rc.effectivePermissions.length > 0 && (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, color: T.primary }}>
                      Ver códigos
                    </summary>
                    <ul
                      style={{
                        margin: "6px 0 0",
                        paddingLeft: 18,
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 11,
                        maxHeight: 140,
                        overflowY: "auto",
                        color: T.inkSecondary,
                      }}
                    >
                      {rc.effectivePermissions.map((code) => (
                        <li key={code}>{code}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Tabla de vista previa */}
      {preview.preview.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: T.ink }}>
            Vista previa (primeros {preview.preview.length})
          </h3>
          {catalog?.groups?.length ? (
            <p
              style={{
                margin: "0 0 14px",
                padding: "12px 14px",
                background: T.infoBg,
                border: `1px solid ${T.infoBorder}`,
                borderRadius: 8,
                fontSize: 13,
                color: T.inkSecondary,
                lineHeight: 1.45,
              }}
            >
              <strong>Permisos:</strong> el rol define la base. Puedes elegir <strong>Otro (desde base…)</strong> en
              el desplegable para clonar un rol (p. ej. N1), marcar o desmarcar cualquier permiso del catálogo y, al
              importar, se creará un <strong>rol nuevo solo para esa persona</strong> (nombre tipo{" "}
              <code style={{ fontSize: 12 }}>Imp·usuario</code>). También puedes añadir permisos extra con el botón
              de cada fila cuando uses un rol predefinido.{" "}
              <span style={{ color: T.inkMuted }}>
                En roles predefinidos, el editor de «extras» solo añade permisos; no quita los del rol.
              </span>
            </p>
          ) : null}
          <div style={{ overflowX: "auto", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.headerBg }}>
                  {["Usuario", "Email", "Contraseña", "Rol y permisos", "Departamento"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: T.inkSecondary,
                        borderBottom: `1px solid ${T.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((u, i) => {
                  const eff = getEffectiveRow(u);
                  const overrideValue = roleOverridesByUser[u.userName] ?? "";
                  const hasCustomImport = Boolean(customImportRolesByUser[u.userName]?.permissions?.length);
                  const stillNeedsMapping =
                    Boolean(u.needsRoleMapping) && !overrideValue.trim() && !hasCustomImport;
                  return (
                    <tr
                      key={`${u.userName}-${i}`}
                      style={{ background: i % 2 === 0 ? T.surface : T.rowAlt }}
                    >
                      <td style={tdStyle}>{u.userName}</td>
                      <td style={tdStyle}>{u.email}</td>
                      <td style={tdStyle}>
                        <div style={{ position: "relative", width: "100%", minWidth: 160, maxWidth: 220 }}>
                          <input
                            type={passwordPeekByUser[u.userName] ? "text" : "password"}
                            autoComplete="new-password"
                            value={passwordOverridesByUser[u.userName] ?? ""}
                            onChange={(e) => onPasswordOverrideChange(u.userName, e.target.value)}
                            placeholder="Si vacío, usa la global"
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              padding: "8px 40px 8px 10px",
                              borderRadius: 8,
                              border: `1px solid ${T.border}`,
                              fontSize: 14,
                              background: T.surface,
                            }}
                          />
                          <button
                            type="button"
                            aria-label={
                              passwordPeekByUser[u.userName]
                                ? "Ocultar contraseña"
                                : "Mostrar contraseña"
                            }
                            onClick={() =>
                              setPasswordPeekByUser((prev) => ({
                                ...prev,
                                [u.userName]: !prev[u.userName],
                              }))
                            }
                            style={{
                              position: "absolute",
                              right: 2,
                              top: "50%",
                              transform: "translateY(-50%)",
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              padding: 4,
                              display: "flex",
                              color: T.inkSecondary,
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                              {passwordPeekByUser[u.userName] ? "visibility_off" : "visibility"}
                            </span>
                          </button>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <RolePermissionsCell
                          row={eff}
                          baseRoleName={u.roleName}
                          externalLabel={u.externalRoleLabel}
                          stillNeedsMapping={stillNeedsMapping}
                          rolesAvailable={rolesAvailable}
                          overrideValue={overrideValue}
                          customSpec={customImportRolesByUser[u.userName] ?? null}
                          selectBump={importRoleSelectBump[u.userName] ?? 0}
                          onRequestCustomImport={() => {
                            setCustomImportModalUser(u.userName);
                            setImportRoleSelectBump((prev) => ({
                              ...prev,
                              [u.userName]: (prev[u.userName] ?? 0) + 1,
                            }));
                          }}
                          onOverrideChange={(v) => onRoleOverrideChange(u.userName, v)}
                          extraCount={(permissionExtrasByUser[u.userName] ?? []).length}
                          canEdit={
                            Boolean(catalog?.groups?.length) && !stillNeedsMapping && !hasCustomImport
                          }
                          onEdit={() => setExtrasModalUser(u.userName)}
                        />
                      </td>
                      <td style={tdStyle}>{u.department ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PermissionExtrasModal
        open={extrasModalUser !== null && extrasModalRow !== null && Boolean(catalog)}
        row={extrasModalRow}
        catalog={catalog ?? { groups: [] }}
        selectedExtras={extrasModalUser ? (permissionExtrasByUser[extrasModalUser] ?? []) : []}
        onChangeExtras={(codes) => {
          if (!extrasModalUser) return;
          onPermissionExtrasChange((prev) => ({ ...prev, [extrasModalUser]: codes }));
        }}
        onClose={() => setExtrasModalUser(null)}
      />

      <CustomImportRoleModal
        open={Boolean(customImportModalUser && catalog?.groups?.length && rolesAvailable.length)}
        userName={customImportModalUser}
        previewRow={
          customImportModalUser
            ? preview.preview.find((x) => x.userName === customImportModalUser) ?? null
            : null
        }
        initialSpec={
          customImportModalUser ? customImportRolesByUser[customImportModalUser] ?? null : null
        }
        rolesAvailable={rolesAvailable}
        rolePermissionsByName={rolePermissionsByName}
        catalog={catalog ?? { groups: [] }}
        onClose={() => setCustomImportModalUser(null)}
        onSave={(spec) => {
          if (!customImportModalUser) return;
          onCustomImportRolesChange((prev) => ({
            ...prev,
            [customImportModalUser]: spec,
          }));
          onPermissionExtrasChange((prev) => {
            const next = { ...prev };
            delete next[customImportModalUser];
            return next;
          });
          setCustomImportModalUser(null);
        }}
      />

      {/* Errores de validación */}
      {hasErrors && (
        <ErrorList title="Errores de validación" items={preview.errors} type="error" />
      )}

      {/* Conflictos */}
      {hasConflicts && (
        <ConflictList conflicts={preview.conflicts} />
      )}

      {/* Acciones */}
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        {canApply && (
          <button
            type="button"
            onClick={onApply}
            style={{
              background: T.primary,
              color: T.surface,
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Importar {preview.validRows} usuario{preview.validRows !== 1 ? "s" : ""}
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          style={{
            background: T.surface,
            color: T.inkSecondary,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: "10px 24px",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function DonePanel({
  result,
  onReset,
}: {
  result: ApplyImportResponse;
  onReset: () => void;
}) {
  return (
    <div>
      <StatusBanner color={T.success}>
        ✓ Importación completada: <strong>{result.created}</strong> usuario
        {result.created !== 1 ? "s" : ""} creados
        {result.skipped > 0 ? `, ${result.skipped} omitidos` : ""}.
        {result.createdOrganization ? (
          <span style={{ display: "block", marginTop: 8, fontSize: 14 }}>
            Organización nueva: <strong>{result.createdOrganization.nombre}</strong> (id{" "}
            <code style={{ fontSize: 12 }}>{result.createdOrganization.id}</code>). Puedes activarla desde el panel de organizaciones.
          </span>
        ) : null}
      </StatusBanner>
      {result.failures && result.failures.length > 0 && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 8,
            border: `1px solid ${T.warningBorder}`,
            background: T.warningBg,
            color: T.warning,
            fontSize: 13,
          }}
        >
          <strong>Filas con conflicto al guardar ({result.failures.length}):</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {result.failures.map((f) => (
              <li key={f.userName}>
                <code style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                  {f.userName}
                </code>
                {" — "}
                {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.createdUsers.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.headerBg }}>
                {["ID", "Usuario", "Email"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: T.inkSecondary, borderBottom: `1px solid ${T.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.createdUsers.map((u, i) => (
                <tr key={u.userId} style={{ background: i % 2 === 0 ? T.surface : T.rowAlt }}>
                  <td style={tdStyle}>{u.userId}</td>
                  <td style={tdStyle}>{u.userName}</td>
                  <td style={tdStyle}>{u.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        onClick={onReset}
        style={{
          background: T.primary,
          color: T.surface,
          border: "none",
          borderRadius: 8,
          padding: "10px 24px",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: 14,
          marginTop: 8,
        }}
      >
        Nueva importación
      </button>
    </div>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        background: T.surfaceMuted,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: "8px 16px",
        minWidth: 100,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: T.inkMuted }}>{label}</div>
    </div>
  );
}

function ErrorList({
  title,
  items,
  type,
}: {
  title: string;
  items: ImportValidationError[];
  type: "error" | "warning";
}) {
  const color = type === "error" ? T.error : T.warning;
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 600, color, marginBottom: 8 }}>{title}</h4>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: T.inkSecondary }}>
        {items.slice(0, 30).map((e, i) => (
          <li key={i}>
            Fila {e.row} — <strong>{e.field}</strong>: {e.message}
          </li>
        ))}
        {items.length > 30 && (
          <li style={{ color: T.inkMuted }}>… y {items.length - 30} errores más.</li>
        )}
      </ul>
    </div>
  );
}

function ConflictList({ conflicts }: { conflicts: ImportConflict[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 600, color: T.warning, marginBottom: 8 }}>
        Conflictos (ya existen en la org, serán omitidos)
      </h4>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: T.inkSecondary }}>
        {conflicts.slice(0, 20).map((c, i) => (
          <li key={i}>
            <strong>{c.userName}</strong> ({c.email}) — {c.reason}
          </li>
        ))}
        {conflicts.length > 20 && (
          <li style={{ color: T.inkMuted }}>… y {conflicts.length - 20} más.</li>
        )}
      </ul>
    </div>
  );
}

const IMPORT_CUSTOM_OPEN = "__IMPORT_CUSTOM_OPEN__";
const IMPORT_CUSTOM_SAVED = "__IMPORT_CUSTOM_SAVED__";

/**
 * Modal exportado para que los tests puedan montarlo aislado.
 * Sigue usándose como subcomponente local dentro de OnboardingImportAdmin.
 */
export function CustomImportRoleModal({
  open,
  userName,
  previewRow,
  initialSpec,
  rolesAvailable,
  rolePermissionsByName,
  catalog,
  onClose,
  onSave,
}: {
  open: boolean;
  userName: string | null;
  previewRow: ImportUserPreview | null;
  initialSpec: CustomImportRoleSpec | null;
  rolesAvailable: string[];
  rolePermissionsByName: Map<string, string[]>;
  catalog: PermissionsCatalog;
  onClose: () => void;
  onSave: (spec: CustomImportRoleSpec) => void;
}) {
  const defaultTemplate = useMemo(() => {
    if (initialSpec?.templateRoleName?.trim()) return initialSpec.templateRoleName.trim();
    const fromRow = previewRow?.roleName?.trim();
    if (fromRow && rolesAvailable.some((r) => r.toLowerCase() === fromRow.toLowerCase())) {
      return fromRow;
    }
    return rolesAvailable[0] ?? "";
  }, [initialSpec, previewRow, rolesAvailable]);

  const [template, setTemplate] = useState(defaultTemplate);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customName, setCustomName] = useState<string>(
    initialSpec?.customRoleName?.trim() ?? ""
  );
  const [nameError, setNameError] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setTemplate(defaultTemplate);
    const codes =
      initialSpec?.permissions?.length && initialSpec.templateRoleName === defaultTemplate
        ? initialSpec.permissions
        : rolePermissionsByName.get(defaultTemplate.toLowerCase()) ?? [];
    setSelected(new Set(codes));
    setCustomName(initialSpec?.customRoleName?.trim() ?? "");
    setNameError("");
  }, [open, defaultTemplate, initialSpec, rolePermissionsByName]);

  if (!open || !userName || !previewRow) return null;

  const onTemplateChange = (t: string) => {
    setTemplate(t);
    setSelected(new Set(rolePermissionsByName.get(t.toLowerCase()) ?? []));
  };

  /**
   * Misma regla que el backend (`uniqueRoleNameInOrg` recorta a 40 chars).
   * El admin puede dejarlo vacío y el backend genera `Imp·<userName>` automático.
   */
  const validateCustomName = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return ""; // vacío = automático, válido
    if (trimmed.length > 40) {
      return "El nombre no puede pasar de 40 caracteres.";
    }
    return "";
  };

  const toggleCode = (code: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  };

  const handleSave = () => {
    const t = template.trim();
    if (!t) return;
    const list = [...selected].filter(Boolean);
    if (list.length === 0) return;
    const nameTrim = customName.trim();
    const err = validateCustomName(customName);
    if (err) {
      setNameError(err);
      return;
    }
    onSave({
      templateRoleName: t,
      permissions: list.sort((a, b) => a.localeCompare(b)),
      ...(nameTrim ? { customRoleName: nameTrim } : {}),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-import-role-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        background: T.scrim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: 12,
          maxWidth: 760,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 40px rgba(10, 10, 10, 0.12)",
          overflow: "hidden",
          border: `1px solid ${T.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${T.border}`,
            background: T.surfaceMuted,
          }}
        >
          <h3 id="custom-import-role-title" style={{ margin: 0, fontSize: 18, color: T.ink }}>
            Otro — rol a medida para {userName}
          </h3>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: T.inkSecondary, lineHeight: 1.5 }}>
            Elige un <strong>rol base</strong> de la organización para copiar su lista inicial de permisos; luego
            marca o desmarca libremente y, si quieres, asigna un <strong>nombre personalizado</strong> al rol
            (ej. <em>Gerente Regional</em>). Al importar se creará un <strong>rol nuevo</strong> en la org con ese
            nombre — o uno automático tipo <code style={{ fontSize: 12 }}>Imp·…</code> si lo dejas vacío — con
            exactamente los permisos marcados, y se asignará a esta persona.
          </p>
        </header>

        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}` }}>
          <label
            htmlFor="custom-import-role-template"
            style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.inkSecondary, marginBottom: 6 }}
          >
            Rol base (plantilla)
          </label>
          <select
            id="custom-import-role-template"
            value={template}
            onChange={(e) => onTemplateChange(e.target.value)}
            style={{
              width: "100%",
              maxWidth: 360,
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              fontSize: 14,
              background: T.surface,
            }}
          >
            {rolesAvailable.map((rn) => (
              <option key={rn} value={rn}>
                {rn}
              </option>
            ))}
          </select>

          <label
            htmlFor="custom-import-role-name"
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: T.inkSecondary,
              marginTop: 14,
              marginBottom: 6,
            }}
          >
            Nombre del rol personalizado <span style={{ color: T.inkMuted, fontWeight: 400 }}>(opcional)</span>
          </label>
          <input
            id="custom-import-role-name"
            type="text"
            value={customName}
            maxLength={40}
            placeholder="Ej. Gerente Regional"
            aria-describedby="custom-import-role-name-help"
            aria-invalid={nameError ? true : undefined}
            onChange={(e) => {
              setCustomName(e.target.value);
              if (nameError) setNameError(validateCustomName(e.target.value));
            }}
            onBlur={(e) => setNameError(validateCustomName(e.target.value))}
            style={{
              width: "100%",
              maxWidth: 360,
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${nameError ? T.error : T.border}`,
              fontSize: 14,
              background: T.surface,
              color: T.ink,
            }}
          />
          <p
            id="custom-import-role-name-help"
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: nameError ? T.error : T.inkMuted,
              lineHeight: 1.4,
            }}
          >
            {nameError
              ? nameError
              : "Si lo dejas vacío, el sistema genera un nombre automático (Imp·…). Máx. 40 caracteres."}
          </p>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
          {catalog.groups.map((group) => (
            <section
              key={group.resource}
              style={{
                marginBottom: 18,
                padding: 12,
                background: T.surfaceMuted,
                borderRadius: 10,
                border: `1px solid ${T.border}`,
              }}
            >
              <h4
                style={{
                  margin: "0 0 10px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: T.ink,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                {group.label}
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {group.items.map((item) => {
                  const checked = selected.has(item.code);
                  const { headline, showTechnicalRef } = getPermissionFriendlyLabel(item);
                  return (
                    <label
                      key={item.code}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        cursor: "pointer",
                        fontSize: 13,
                        color: T.ink,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCode(item.code)}
                        style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
                      />
                      <span>
                        <span style={{ fontWeight: 600 }}>{headline}</span>
                        {showTechnicalRef ? (
                          <span
                            style={{
                              display: "block",
                              fontSize: 11,
                              color: T.technicalRef,
                              fontFamily: "ui-monospace, monospace",
                              marginTop: 2,
                            }}
                          >
                            {item.code}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <footer
          style={{
            padding: "14px 20px",
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: T.surfaceMuted,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.surface,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={selected.size === 0}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: selected.size === 0 ? T.border : T.primary,
              color: T.surface,
              cursor: selected.size === 0 ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            Guardar ({selected.size} permisos)
          </button>
        </footer>
      </div>
    </div>
  );
}

function RolePermissionsCell({
  row,
  baseRoleName,
  externalLabel,
  stillNeedsMapping,
  rolesAvailable,
  overrideValue,
  customSpec,
  selectBump,
  onRequestCustomImport,
  onOverrideChange,
  extraCount,
  canEdit,
  onEdit,
}: {
  /** Fila con el rol "efectivo" (override aplicado si existe). */
  row: ImportUserPreview;
  /** Rol que venía del archivo/preview, antes del override. */
  baseRoleName?: string;
  externalLabel?: string;
  stillNeedsMapping: boolean;
  rolesAvailable: string[];
  overrideValue: string;
  customSpec: CustomImportRoleSpec | null;
  selectBump: number;
  onRequestCustomImport: () => void;
  onOverrideChange: (roleName: string) => void;
  extraCount: number;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const roleCodes = row.rolePermissionCodes ?? row.effectivePermissions ?? [];
  const nRole = roleCodes.length;
  const hasCustom = Boolean(customSpec?.permissions?.length);
  const isOverridden = overrideValue.trim().length > 0 || hasCustom;
  const selectValue = hasCustom ? IMPORT_CUSTOM_SAVED : overrideValue;

  return (
    <div>
      {stillNeedsMapping ? (
        <>
          <div style={{ fontWeight: 600, color: T.warning }}>
            Etiqueta en archivo: {externalLabel ?? "—"}
          </div>
          <p style={{ margin: "4px 0 6px", fontSize: 11, color: T.inkMuted }}>
            Sin rol equivalente. Usa el panel de arriba para mapear toda la etiqueta o
            elige aquí un rol solo para esta persona.
          </p>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: T.ink }}>{row.roleName ?? "—"}</span>
            {row.roleAutoDetected && !isOverridden ? (
              <span
                title="Rol asignado automáticamente por jerarquía de jefe inmediato. Puedes cambiarlo."
                style={{
                  display: "inline-block",
                  padding: "1px 7px",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 999,
                  background: "var(--color-primary-50, #eff6ff)",
                  color: "var(--color-primary-600, #2563eb)",
                  border: "1px solid var(--color-primary-200, #bfdbfe)",
                  whiteSpace: "nowrap",
                }}
              >
                auto-detectado
              </span>
            ) : null}
          </div>
          <p style={{ margin: "6px 0 4px", fontSize: 12, color: T.inkMuted }}>
            {nRole} permiso{nRole !== 1 ? "s" : ""} efectivos (rol + base solicitante del sistema)
            {extraCount > 0 ? (
              <span style={{ color: T.primary, fontWeight: 600 }}>
                {" "}
                · +{extraCount} adicional{extraCount !== 1 ? "es" : ""}
              </span>
            ) : null}
          </p>
        </>
      )}

      <select
        key={`role-sel-${row.userName}-${selectBump}`}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === IMPORT_CUSTOM_OPEN) {
            onRequestCustomImport();
            return;
          }
          onOverrideChange(v === IMPORT_CUSTOM_SAVED ? "" : v);
        }}
        title={
          hasCustom && customSpec
            ? customSpec.customRoleName?.trim()
              ? `Rol a medida «${customSpec.customRoleName.trim()}» desde base «${customSpec.templateRoleName}»`
              : `Rol a medida desde base «${customSpec.templateRoleName}»`
            : isOverridden && baseRoleName
              ? `Rol original del archivo: ${baseRoleName}`
              : "Cambiar rol asignado a esta persona"
        }
        style={{
          width: "100%",
          minWidth: 160,
          maxWidth: 220,
          padding: "6px 8px",
          borderRadius: 6,
          border: `1px solid ${isOverridden ? T.primary : T.border}`,
          fontSize: 12,
          background: T.surface,
          color: T.ink,
          marginTop: 4,
        }}
      >
        <option value="">
          {baseRoleName
            ? `Mantener: ${baseRoleName}`
            : stillNeedsMapping
              ? "Elegir rol para esta persona…"
              : "Mantener rol del archivo"}
        </option>
        {!stillNeedsMapping && rolesAvailable.length > 0 ? (
          <option value={IMPORT_CUSTOM_OPEN}>Otro (desde base + permisos libres)…</option>
        ) : null}
        {hasCustom && customSpec ? (
          <option value={IMPORT_CUSTOM_SAVED}>
            Otro ✓ ({customSpec.customRoleName?.trim() || `base: ${customSpec.templateRoleName}`},{" "}
            {customSpec.permissions.length} perm.)
          </option>
        ) : null}
        {rolesAvailable.map((rn) => (
          <option key={rn} value={rn}>
            {rn}
          </option>
        ))}
      </select>
      {hasCustom ? (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: T.primary }}>
          {customSpec?.customRoleName?.trim() ? (
            <>
              Se creará el rol <strong>«{customSpec.customRoleName.trim()}»</strong> al importar.
            </>
          ) : (
            <>
              Se creará un rol nuevo al importar (nombre automático{" "}
              <code style={{ fontSize: 10 }}>Imp·…</code>).
            </>
          )}
        </p>
      ) : isOverridden ? (
        <p style={{ margin: "4px 0 0", fontSize: 11, color: T.primary }}>
          Rol cambiado en la UI{baseRoleName ? ` (archivo: ${baseRoleName})` : ""}.
        </p>
      ) : null}

      {canEdit ? (
        <button
          type="button"
          onClick={onEdit}
          style={{
            marginTop: 8,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: T.surface,
            background: T.primary,
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Ver / añadir permisos
        </button>
      ) : !stillNeedsMapping ? (
        <span style={{ fontSize: 11, color: T.inkMuted }}>
          {hasCustom
            ? "Los extras no se usan con rol a medida."
            : "Sin catálogo de permisos"}
        </span>
      ) : null}
    </div>
  );
}

function PermissionExtrasModal({
  open,
  row,
  catalog,
  selectedExtras,
  onChangeExtras,
  onClose,
}: {
  open: boolean;
  row: ImportUserPreview | null;
  catalog: PermissionsCatalog;
  selectedExtras: string[];
  onChangeExtras: (codes: string[]) => void;
  onClose: () => void;
}) {
  const roleSet = useMemo(() => {
    const codes = row?.rolePermissionCodes ?? row?.effectivePermissions ?? [];
    return new Set(codes);
  }, [row]);

  const selectedSet = useMemo(() => new Set(selectedExtras), [selectedExtras]);

  if (!open || !row) return null;

  const toggleExtra = (code: string) => {
    if (roleSet.has(code)) return;
    const next = new Set(selectedExtras);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChangeExtras([...next].sort((a, b) => a.localeCompare(b)));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: T.scrim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: 12,
          maxWidth: 720,
          width: "100%",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 12px 40px rgba(10, 10, 10, 0.12)",
          overflow: "hidden",
          border: `1px solid ${T.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${T.border}`,
            background: T.surfaceMuted,
          }}
        >
          <h3 id="perm-modal-title" style={{ margin: 0, fontSize: 18, color: T.ink }}>
            Permisos por persona — {row.userName}
          </h3>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: T.inkSecondary, lineHeight: 1.5 }}>
            Rol: <strong style={{ color: T.ink }}>{row.roleName}</strong>. Las secciones agrupan por área
            (p. ej. <strong>Contabilidad (Accounting)</strong>, Usuarios, Comprobantes…). Cada permiso está en
            español; debajo verás la <strong>referencia técnica</strong> del código. Las casillas{" "}
            <span style={{ color: T.primary, fontWeight: 600 }}>del rol</span> no se pueden quitar aquí. Marca los
            adicionales que quieras dar solo a esta persona.
          </p>
        </header>

        <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
          {catalog.groups.map((group) => (
            <section
              key={group.resource}
              style={{
                marginBottom: 22,
                padding: 14,
                background: T.surfaceMuted,
                borderRadius: 10,
                border: `1px solid ${T.border}`,
              }}
            >
              <h4
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: T.ink,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                {group.label}
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {group.items.map((item) => {
                  const fromRole = roleSet.has(item.code);
                  const isExtra = selectedSet.has(item.code);
                  const checked = fromRole || isExtra;
                  const { headline, showTechnicalRef } = getPermissionFriendlyLabel(item);
                  return (
                    <label
                      key={item.code}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        padding: "10px 12px",
                        borderRadius: 8,
                        cursor: fromRole ? "default" : "pointer",
                        background: fromRole ? T.surface : checked ? T.primaryWash : T.surface,
                        border: `1px solid ${
                          fromRole ? T.border : checked ? T.primarySoft : T.border
                        }`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={fromRole}
                        onChange={() => toggleExtra(item.code)}
                        style={{ marginTop: 5, width: 16, height: 16, accentColor: T.primary }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: 600,
                            color: T.ink,
                            lineHeight: 1.35,
                          }}
                        >
                          {headline}
                        </span>
                        {showTechnicalRef ? (
                          <span
                            style={{
                              display: "block",
                              marginTop: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              color: T.technicalRef,
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                              wordBreak: "break-all",
                              letterSpacing: "0.02em",
                            }}
                          >
                            Referencia técnica: {item.code}
                          </span>
                        ) : null}
                        <span style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          {fromRole ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: T.primary,
                                background: T.primarySoft,
                                padding: "3px 8px",
                                borderRadius: 4,
                              }}
                            >
                              Incluido en el rol
                            </span>
                          ) : null}
                          {!fromRole && isExtra ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: T.success,
                                background: T.successSoft,
                                padding: "3px 8px",
                                borderRadius: 4,
                              }}
                            >
                              Adicional al rol
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <footer
          style={{
            padding: "12px 20px",
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: T.surfaceMuted,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: T.inkSecondary,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: `1px solid var(--color-neutral-300)`,
  color: "var(--color-ink-secondary)",
};