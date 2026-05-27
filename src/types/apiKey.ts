export interface ApiKeyScope {
  permissions: string[];
}

export interface ApiKeyRecord {
  id: number;
  organizationId: string;
  name: string;
  scope: ApiKeyScope;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  createdBy: number;
  active: boolean;
}

export interface ApiKeyGenerateResponse {
  id: number;
  org_id: string;
  name: string;
  key: string;
  scope: ApiKeyScope;
  expires_at: string;
  active: boolean;
  created_at: string;
  created_by: number;
}

export interface ApiKeyLogEntry {
  id: string;
  keyId: number;
  endpoint: string;
  responseCode: number;
  timestamp: string;
}
