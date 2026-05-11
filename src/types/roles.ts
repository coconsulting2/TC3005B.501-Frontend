export type UserRole =
  | 'Solicitante'
  | 'Agencia de viajes'
  | 'Cuentas por pagar'
  | 'N1'
  | 'N2'
  | 'Administrador'
  /** Super-admin solo en org ROOT (Ditta); coincide con el roleName en BD. */
  | 'Admin Ditta';