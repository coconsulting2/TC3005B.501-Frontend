/**
 * Datos de rutas para la vista de agencia (cotizar / atender).
 */

export type AgencyRouteLike = {
  router_index?: number;
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

/** Tramo con avión que la agencia debe cotizar (multidestino). */
export type FlightSegmentQuote = {
  routerIndex: number;
  label: string;
  defaults: FlightSearchDefaults;
};

/** Almacenamiento v2 de ofertas por tramo en Request.selectedFlightOffer. */
export type StoredFlightOffersV2 = {
  version: 2;
  segments: Array<{
    router_index: number;
    label?: string;
    offer: Record<string, unknown>;
  }>;
};

export type NormalizedFlightOffer = {
  id: string;
  airlineName: string;
  airlineIata: string;
  departureAt: string;
  arrivalAt: string;
  durationLabel: string;
  stops: number;
  totalAmount: number;
  totalCurrency: string;
  rawOfferId?: string;
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
 * @deprecated Preferir {@link buildFlightSegmentsForQuote} en viajes multidestino.
 */
export function buildFlightSearchDefaults(
  routes: AgencyRouteLike[] | undefined,
): FlightSearchDefaults | null {
  const segments = buildFlightSegmentsForQuote(routes);
  return segments[0]?.defaults ?? null;
}

function buildDefaultsForRoute(r: AgencyRouteLike): FlightSearchDefaults | null {
  if (!r.plane_needed) return null;

  let fecha = isoDatePart(r.beginning_date);
  if (!fecha) fecha = new Date().toISOString().slice(0, 10);

  let fechaRegreso: string | undefined = isoDatePart(r.ending_date);
  if (fechaRegreso && fechaRegreso <= fecha) {
    fechaRegreso = undefined;
  }

  return {
    origen: cityNameToIata(r.origin_city),
    destino: cityNameToIata(r.destination_city),
    fecha,
    ...(fechaRegreso ? { fecha_regreso: fechaRegreso } : {}),
    pasajeros: 1,
  };
}

function formatSegmentLabel(r: AgencyRouteLike, routerIndex: number): string {
  const from = [r.origin_city, r.origin_country].filter(Boolean).join(", ");
  const to = [r.destination_city, r.destination_country].filter(Boolean).join(", ");
  if (from && to) return `${from} → ${to}`;
  return `Tramo ${routerIndex + 1}`;
}

/**
 * Un bloque de cotización de vuelo por cada tramo con plane_needed (multidestino).
 */
export function buildFlightSegmentsForQuote(
  routes: AgencyRouteLike[] | undefined,
): FlightSegmentQuote[] {
  const list = Array.isArray(routes) ? routes : [];
  const segments: FlightSegmentQuote[] = [];

  list.forEach((r, idx) => {
    if (!r.plane_needed) return;
    const defaults = buildDefaultsForRoute(r);
    if (!defaults) return;
    const routerIndex = r.router_index ?? idx;
    segments.push({
      routerIndex,
      label: formatSegmentLabel(r, routerIndex),
      defaults,
    });
  });

  return segments.sort((a, b) => a.routerIndex - b.routerIndex);
}

/**
 * Lee ofertas guardadas (formato legacy u objeto v2 con segments).
 */
export function parseStoredFlightOffers(
  raw: unknown,
): Record<number, Record<string, unknown>> {
  if (!raw || typeof raw !== "object") return {};

  const obj = raw as Record<string, unknown>;
  if (obj.version === 2 && Array.isArray(obj.segments)) {
    const map: Record<number, Record<string, unknown>> = {};
    for (const item of obj.segments as StoredFlightOffersV2["segments"]) {
      if (item?.router_index != null && item.offer && typeof item.offer === "object") {
        map[Number(item.router_index)] = item.offer as Record<string, unknown>;
      }
    }
    return map;
  }

  if ("airlineName" in obj || "totalAmount" in obj) {
    return { 0: obj };
  }

  return {};
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
