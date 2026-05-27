export interface MenuItem {
  label: string;
  route: string;
  icon: string;
}

export const SIDEBAR_CONFIG: Record<string, MenuItem[]> = {
  'Solicitante': [
    { label: 'DASHBOARD', route: '/dashboard', icon: 'home' },
    { label: 'CREAR SOLICITUD', route: '/crear-solicitud', icon: 'flight' },
    { label: 'DRAFT SOLICITUDES', route: '/solicitudes-draft', icon: 'draft' },
    { label: 'GASTOS (COMPROBAR)', route: '/comprobar-gastos', icon: 'payments' },
    { label: 'REEMBOLSOS', route: '/reembolso', icon: 'paid' },
    { label: 'HISTORIAL DE VIAJES', route: '/historial', icon: 'inventory' }
  ],
  'N1': [
    { label: 'DASHBOARD', route: '/dashboard', icon: 'home' },
    { label: 'AUTORIZACIONES', route: '/autorizaciones', icon: 'check_box' },
    { label: 'SOLICITUDES', route: '/solicitudes-autorizador', icon: 'check_box' },
    { label: 'CREAR SOLICITUD', route: '/crear-solicitud', icon: 'flight' },
    { label: 'DRAFT SOLICITUDES', route: '/solicitudes-draft', icon: 'draft' },
    { label: 'GASTOS (COMPROBAR)', route: '/comprobar-gastos', icon: 'payments' },
    { label: 'REEMBOLSOS', route: '/reembolso', icon: 'paid' },
    { label: 'GASTO POR CC', route: '/reportes/gastos-por-centro', icon: 'insights' },
    { label: 'HISTORIAL DE VIAJES', route: '/historial', icon: 'inventory' }
  ],
  'N2': [
    { label: 'DASHBOARD', route: '/dashboard', icon: 'home' },
    { label: 'AUTORIZACIONES', route: '/autorizaciones', icon: 'check_box' },
    { label: 'SOLICITUDES', route: '/solicitudes-autorizador', icon: 'check_box' },
    { label: 'CREAR SOLICITUD', route: '/crear-solicitud', icon: 'flight' },
    { label: 'DRAFT SOLICITUDES', route: '/solicitudes-draft', icon: 'draft' },
    { label: 'GASTOS (COMPROBAR)', route: '/comprobar-gastos', icon: 'payments' },
    { label: 'REEMBOLSOS', route: '/reembolso', icon: 'paid' },
    { label: 'GASTO POR CC', route: '/reportes/gastos-por-centro', icon: 'insights' },
    { label: 'HISTORIAL DE VIAJES', route: '/historial', icon: 'inventory' }
  ],
  'Cuentas por pagar': [
    { label: 'DASHBOARD', route: '/dashboard', icon: 'home' },
    { label: 'TODAS LAS SOLICITUDES', route: '/todas-las-solicitudes', icon: 'list_alt' },
    { label: 'COTIZACIONES', route: '/cotizaciones', icon: 'paid' },
    { label: 'COMPROBACIONES', route: '/comprobaciones', icon: 'receipt' },
    { label: 'EXPORTAR ERP', route: '/exportar-contable', icon: 'cloud_upload' },
    { label: 'GASTO POR CC', route: '/reportes/gastos-por-centro', icon: 'insights' }
  ],
  'Agencia de viajes': [
    { label: 'DASHBOARD', route: '/dashboard', icon: 'home' },
    { label: 'ATENCIONES', route: '/atenciones', icon: 'breaking_news_alt_1' }
  ],
  'Administrador': [
    { label: 'DASHBOARD', route: '/dashboard', icon: 'home' },
    { label: 'CREAR USUARIO', route: '/crear-usuario', icon: 'manage_accounts' },
    // M2-006 — Administración de políticas de viáticos
    { label: 'POLÍTICAS DE VIÁTICOS', route: '/admin/expense-policies', icon: 'rule' },
    { label: 'CATEGORÍAS DE EMPLEADO', route: '/admin/employee-categories', icon: 'badge' },
    { label: 'PLAZO DE REEMBOLSO', route: '/admin/refund-time-limits', icon: 'schedule' },
    // M3-007 — Importación masiva de usuarios
    { label: 'IMPORTAR USUARIOS', route: '/admin/onboarding-import', icon: 'upload_file' },
    // M3-007 — Catálogo contable y mapeo de tipos de gasto
    { label: 'CATÁLOGO CONTABLE', route: '/admin/catalogo-contable', icon: 'account_balance' },
    { label: 'INDICADORES DE IMPUESTO', route: '/admin/indicadores-impuesto', icon: 'percent' },
    { label: 'MAPEO DE GASTOS', route: '/admin/mapeo-gastos', icon: 'sync_alt' },
    // Workflow rules — solo admin de org, no super-admin Ditta
    { label: 'REGLAS DE WORKFLOW', route: '/admin/workflow-rules', icon: 'rule_settings' },
    { label: 'LLAVES API', route: '/admin/api-keys', icon: 'vpn_key' },
    // M3-009 — Dashboard de gasto por centro de costos
    { label: 'GASTO POR CC', route: '/reportes/gastos-por-centro', icon: 'insights' }
  ],
  'Admin Ditta': [
    { label: 'DASHBOARD', route: '/dashboard', icon: 'home' },
    { label: 'ORGANIZACIONES', route: '/admin/organizations', icon: 'domain' },
    { label: 'CREAR USUARIO', route: '/crear-usuario', icon: 'manage_accounts' },
    { label: 'POLÍTICAS DE VIÁTICOS', route: '/admin/expense-policies', icon: 'rule' },
    { label: 'CATEGORÍAS DE EMPLEADO', route: '/admin/employee-categories', icon: 'badge' },
    { label: 'PLAZO DE REEMBOLSO', route: '/admin/refund-time-limits', icon: 'schedule' },
    { label: 'IMPORTAR USUARIOS', route: '/admin/onboarding-import', icon: 'upload_file' },
    { label: 'CATÁLOGO CONTABLE', route: '/admin/catalogo-contable', icon: 'account_balance' },
    { label: 'INDICADORES DE IMPUESTO', route: '/admin/indicadores-impuesto', icon: 'percent' },
    { label: 'MAPEO DE GASTOS', route: '/admin/mapeo-gastos', icon: 'sync_alt' },
    { label: 'LLAVES API', route: '/admin/api-keys', icon: 'vpn_key' },
    { label: 'GASTO POR CC', route: '/reportes/gastos-por-centro', icon: 'insights' },
  ],
};
