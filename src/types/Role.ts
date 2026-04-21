/**
 * Role + permissions types for the admin view (M2-003).
 * Backend integration will arrive on M2-00x.
 */

export interface Role {
  role_id: number;
  name: string;
  permissions: string[];
  max_authorization_amount: number | null;
  expiration_date: string | null;
  is_admin: boolean;
  active_users_count: number;
}

export type RoleCreatePayload = Omit<Role, "role_id" | "active_users_count">;
export type RoleUpdatePayload = Partial<RoleCreatePayload>;
