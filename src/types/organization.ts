/**
 * Tipos del módulo Organizations (multi-tenant).
 */

export type OrganizationKind = "ROOT" | "CLIENT";
export type OrganizationStatus = "CONFIGURING" | "ACTIVE" | "SUSPENDED";

export interface Organization {
  id: string;
  nombre: string;
  razonSocial: string | null;
  rfc: string | null;
  logoUrl: string | null;
  timezone: string;
  baseCurrency: string;
  kind: OrganizationKind;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationInput {
  nombre: string;
  rfc?: string | null;
  razonSocial?: string | null;
  timezone?: string;
  baseCurrency?: string;
  adminEmail: string;
  adminNombre: string;
  adminPassword: string;
}

export interface OrganizationListResponse {
  data: Organization[];
  total: number;
  page: number;
  pageSize: number;
}
