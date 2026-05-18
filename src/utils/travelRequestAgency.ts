/**
 * Datos de rutas para la vista de agencia (cotizar / atender).
 */

export type AgencyRouteLike = {
  plane_needed?: boolean;
  hotel_needed?: boolean;
  origin_city?: string;
  origin_country?: string;
  destination_city?: string;
  destination_country?: string;
  beginning_date?: string;
  ending_date?: string;
};

export type FlightSearchDefaults = {
  origen: string;
  destino: string;
  fecha: string;
  fecha_regreso?: string;
  pasajeros: number;
};

/** Mapa estático ciudad común (México) → IATA. Claves en minúsculas sin acentos. */
const CITY_TO_IATA: Record<string, string> = {
  cdmx: "MEX",
  "ciudad de mexico": "MEX",
  "ciudad de méxico": "MEX",
  mexico: "MEX",
  méxico: "MEX",
  cancun: "CUN",
  cancún: "CUN",
  monterrey: "MTY",
  guadalajara: "GDL",
  tijuana: "TIJ",
  merida: "MID",
  mérida: "MID",
  queretaro: "QRO",
  querétaro: "QRO",
  puebla: "PBC",
  leon: "BJX",
  león: "BJX",
  villahermosa: "VSA",
  oaxaca: "OAX",
  chihuahua: "CUU",
  culiacan: "CUL",
  culiacán: "CUL",
  hermosillo: "HMO",
  tampico: "TAM",
  veracruz: "VER",
  acapulco: "ACA",
  "los cabos": "SJD",
  "san jose del cabo": "SJD",
};

function normalizeCityKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Resuelve código IATA desde nombre de ciudad; fallback: 3 primeras letras en mayúsculas.
 */
export function cityNameToIata(cityName: string | undefined | null): string {
  if (!cityName || !String(cityName).trim()) return "MEX";
  const key = normalizeCityKey(String(cityName));
  if (CITY_TO_IATA[key]) return CITY_TO_IATA[key];
  const compact = key.replace(/\s+/g, " ");
  if (CITY_TO_IATA[compact]) return CITY_TO_IATA[compact];
  const letters = compact.replace(/[^a-z]/g, "").toUpperCase();
  return letters.length >= 3 ? letters.slice(0, 3) : "MEX";
}

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
 * Primer tramo con avión: origen/destino IATA y fechas ida (y regreso si aplica).
 */
export function buildFlightSearchDefaults(
  routes: AgencyRouteLike[] | undefined,
): FlightSearchDefaults | null {
  const list = Array.isArray(routes) ? routes : [];
  const r = list.find((x) => Boolean(x.plane_needed));
  if (!r) return null;

  let fecha = isoDatePart(r.beginning_date);
  if (!fecha) fecha = new Date().toISOString().slice(0, 10);

  let fechaRegreso: string | undefined = isoDatePart(r.ending_date);
  if (fechaRegreso && fechaRegreso <= fecha) {
    fechaRegreso = undefined;
  }

  const origen = cityNameToIata(r.origin_city);
  const destino = cityNameToIata(r.destination_city);

  return {
    origen,
    destino,
    fecha,
    ...(fechaRegreso ? { fecha_regreso: fechaRegreso } : {}),
    pasajeros: 1,
  };
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
