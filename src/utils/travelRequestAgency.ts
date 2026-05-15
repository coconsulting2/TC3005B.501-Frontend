/**
 * Datos de rutas para la vista de agencia (cotizar / atender).
 */

export type AgencyRouteLike = {
  plane_needed?: boolean;
  hotel_needed?: boolean;
  destination_city?: string;
  destination_country?: string;
  beginning_date?: string;
  ending_date?: string;
};

export function computeAgencyServiceFlags(routes: AgencyRouteLike[] | undefined) {
  const list = Array.isArray(routes) ? routes : [];
  return {
    needsPlane: list.some((r) => Boolean(r.plane_needed)),
    needsHotel: list.some((r) => Boolean(r.hotel_needed)),
  };
}

function isoDatePart(d: unknown): string {
  if (d == null) return "";
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * Primer tramo con hotel: ciudad destino y fechas para precargar búsqueda de hospedaje.
 */
export function buildHotelSearchDefaults(
  routes: AgencyRouteLike[] | undefined,
): { ciudad: string; fecha_entrada: string; fecha_salida: string; huespedes: number } | null {
  const list = Array.isArray(routes) ? routes : [];
  const r = list.find((x) => Boolean(x.hotel_needed));
  if (!r) return null;

  let ini = isoDatePart(r.beginning_date);
  let fin = isoDatePart(r.ending_date);
  if (!ini) ini = new Date().toISOString().slice(0, 10);
  if (!fin || fin <= ini) {
    const t = new Date(`${ini}T12:00:00`);
    t.setDate(t.getDate() + 1);
    fin = t.toISOString().slice(0, 10);
  }

  const ciudad =
    [r.destination_city, r.destination_country].filter(Boolean).join(", ").trim() ||
    "Ciudad de México";

  return { ciudad, fecha_entrada: ini, fecha_salida: fin, huespedes: 1 };
}
