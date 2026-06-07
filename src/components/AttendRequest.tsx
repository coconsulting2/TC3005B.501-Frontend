import { useCallback, useMemo, useState } from "react";
import { apiRequest } from "@utils/apiClient";
import ModalWrapper from "@components/ModalWrapper";
import Toast from "@components/Toast";
import FlightQuoteSegment from "@components/FlightQuoteSegment";
import { showAppAlert } from "@utils/appAlert";
import type {
  FlightSearchDefaults,
  FlightSegmentQuote,
  NormalizedFlightOffer,
} from "@utils/travelRequestAgency";
import { parseStoredFlightOffers } from "@utils/travelRequestAgency";

export type { NormalizedFlightOffer } from "@utils/travelRequestAgency";

export type NormalizedHotelOffer = {
  id: string;
  hotelName: string;
  addressHint: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  totalCurrency: string;
  stars: number;
  provider?: string;
  searchResultId?: string;
  ratesFetched?: boolean;
  rates?: Array<{
    rateId: string;
    roomName?: string;
    rateName?: string;
    totalAmount: number;
    totalCurrency: string;
    boardType?: string;
  }>;
};

export type HotelSearchDefaults = {
  ciudad: string;
  fecha_entrada: string;
  fecha_salida: string;
  huespedes: number;
};

interface Props {
  request_id: string;
  token: string;
  needsPlane?: boolean;
  needsHotel?: boolean;
  hotelSearchDefaults?: HotelSearchDefaults | null;
  flightSearchDefaults?: FlightSearchDefaults | null;
  flightSegments?: FlightSegmentQuote[];
  initialFlightOffer?: unknown;
}

export default function AttendRequest({
  request_id,
  token,
  needsPlane = true,
  needsHotel = false,
  hotelSearchDefaults = null,
  flightSearchDefaults = null,
  flightSegments = [],
  initialFlightOffer = null,
}: Props) {
  const segments = useMemo(() => {
    if (flightSegments.length > 0) return flightSegments;
    if (flightSearchDefaults) {
      return [
        {
          routerIndex: 0,
          label: "Vuelo",
          defaults: flightSearchDefaults,
        },
      ] satisfies FlightSegmentQuote[];
    }
    return [];
  }, [flightSegments, flightSearchDefaults]);

  const [selectedBySegment, setSelectedBySegment] = useState<
    Record<number, NormalizedFlightOffer>
  >(() => {
    const stored = parseStoredFlightOffers(initialFlightOffer);
    const out: Record<number, NormalizedFlightOffer> = {};
    for (const [key, offer] of Object.entries(stored)) {
      out[Number(key)] = offer as unknown as NormalizedFlightOffer;
    }
    return out;
  });

  const handleFlightSelected = useCallback((routerIndex: number, offer: NormalizedFlightOffer) => {
    setSelectedBySegment((prev) => ({ ...prev, [routerIndex]: offer }));
    setToast({ message: "Oferta de vuelo guardada en la solicitud.", type: "success" });
  }, []);

  const [hotelCiudad, setHotelCiudad] = useState(() => hotelSearchDefaults?.ciudad ?? "");
  const [hotelCheckIn, setHotelCheckIn] = useState(
    () => hotelSearchDefaults?.fecha_entrada ?? new Date().toISOString().slice(0, 10),
  );
  const [hotelCheckOut, setHotelCheckOut] = useState(
    () => hotelSearchDefaults?.fecha_salida ?? new Date().toISOString().slice(0, 10),
  );
  const [hotelHuespedes, setHotelHuespedes] = useState(() => hotelSearchDefaults?.huespedes ?? 1);
  const [searchingHotels, setSearchingHotels] = useState(false);
  const [hotelOffers, setHotelOffers] = useState<NormalizedHotelOffer[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<NormalizedHotelOffer | null>(null);
  const [savingHotel, setSavingHotel] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const introText = useMemo(() => {
    if (needsPlane && needsHotel) {
      if (segments.length > 1) {
        return `Cotiza ${segments.length} vuelos (uno por tramo con avión) y el hospedaje antes de finalizar.`;
      }
      return "Busca y guarda la cotización de vuelo y de hospedaje que correspondan a la solicitud antes de finalizar la atención.";
    }
    if (needsHotel) {
      return "Busca y guarda la cotización de hospedaje antes de finalizar la atención.";
    }
    if (segments.length > 1) {
      return `Cotiza un vuelo por cada tramo marcado con avión (${segments.length} tramos).`;
    }
    return "Busca y guarda la cotización de vuelo antes de finalizar la atención.";
  }, [needsPlane, needsHotel, segments.length]);

  const buscarHoteles = useCallback(async () => {
    const ciudad = hotelCiudad.trim();
    if (ciudad.length < 2) {
      showAppAlert("Indica la ciudad o zona de hospedaje (al menos 2 caracteres).", {
        variant: "warning",
      });
      return;
    }
    setSearchingHotels(true);
    setHotelOffers([]);
    try {
      const res = await apiRequest<{ offers: NormalizedHotelOffer[] }>("/hotels/search", {
        method: "POST",
        data: {
          ciudad,
          fecha_entrada: hotelCheckIn,
          fecha_salida: hotelCheckOut,
          huespedes: hotelHuespedes,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      setHotelOffers(res.offers ?? []);
      if (!res.offers?.length) {
        showAppAlert("No se encontraron opciones de hospedaje para esos criterios.", {
          variant: "info",
        });
      }
    } catch (e) {
      console.error(e);
      showAppAlert("No se pudo buscar hospedaje. Verifica permisos de agencia o el backend.", {
        variant: "error",
      });
    } finally {
      setSearchingHotels(false);
    }
  }, [hotelCiudad, hotelCheckIn, hotelCheckOut, hotelHuespedes, token]);

  const seleccionarHotel = useCallback(
    async (offer: NormalizedHotelOffer) => {
      setSavingHotel(true);
      try {
        let offerToSave = offer;
        const searchResultId = offer.searchResultId ?? offer.id;
        if (offer.provider === "duffel_stays" && searchResultId.startsWith("srr_")) {
          try {
            const detail = await apiRequest<{ offer: NormalizedHotelOffer }>(
              `/hotels/search-results/${encodeURIComponent(searchResultId)}/rates`,
              {
                method: "POST",
                data: { base_offer: offer },
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            if (detail.offer) {
              offerToSave = detail.offer;
            }
          } catch (rateErr) {
            console.warn("[hotels] fetch_all_rates no disponible, guardando oferta resumida.", rateErr);
          }
        }

        await apiRequest(`/travel-agent/travel-request/${request_id}/selected-hotel`, {
          method: "PUT",
          data: { offer: offerToSave },
          headers: { Authorization: `Bearer ${token}` },
        });
        setSelectedHotel(offerToSave);
        setToast({ message: "Opción de hospedaje guardada en la solicitud.", type: "success" });
      } catch (e) {
        console.error(e);
        showAppAlert("No se pudo guardar la opción de hospedaje.", { variant: "error" });
      } finally {
        setSavingHotel(false);
      }
    },
    [request_id, token],
  );

  const finalizarAtencion = useCallback(async () => {
    if (needsPlane) {
      const missing = segments.filter((s) => !selectedBySegment[s.routerIndex]);
      if (missing.length > 0) {
        showAppAlert(
          missing.length === 1
            ? "Selecciona y guarda la oferta de vuelo del tramo pendiente."
            : `Faltan ${missing.length} vuelos por cotizar (uno por tramo con avión).`,
          { variant: "warning" },
        );
        return;
      }
    }
    if (needsHotel && !selectedHotel) {
      showAppAlert("Selecciona y guarda una opción de hospedaje antes de finalizar la atención.", {
        variant: "warning",
      });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest(`/travel-agent/attend-travel-request/${request_id}`, {
        method: "PUT",
        data: {},
        headers: { Authorization: `Bearer ${token}` },
      });
      setToast({ message: "Solicitud atendida correctamente.", type: "success" });
      await new Promise((r) => setTimeout(r, 1500));
      window.location.href = "/dashboard";
    } catch (error) {
      console.error(error);
      showAppAlert("No se pudo completar la atención de la solicitud.", { variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [request_id, token, selectedBySegment, selectedHotel, needsPlane, needsHotel, segments]);

  const allFlightsSelected =
    !needsPlane || segments.every((s) => Boolean(selectedBySegment[s.routerIndex]));
  const canFinalize =
    allFlightsSelected && (!needsHotel || Boolean(selectedHotel)) && !submitting;

  return (
    <div className="w-full max-w-5xl space-y-8 p-6 bg-white rounded border border-gray-200">
      <h1 className="text-xl font-semibold text-gray-900">Agencia de viajes</h1>
      <p className="text-sm text-gray-600">{introText}</p>

      {needsPlane && segments.length > 0 ? (
        <section className="space-y-4">
          {segments.length > 1 ? (
            <h2 className="text-sm font-semibold text-gray-800">Vuelos por tramo</h2>
          ) : null}
          {segments.map((segment) => (
            <FlightQuoteSegment
              key={segment.routerIndex}
              segment={segment}
              requestId={request_id}
              token={token}
              selected={selectedBySegment[segment.routerIndex] ?? null}
              onSelected={handleFlightSelected}
              showTramoHeading={segments.length > 1}
            />
          ))}
        </section>
      ) : null}

      {needsHotel ? (
        <section className="rounded-lg border border-gray-200 p-4 bg-amber-50/40">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Buscar hospedaje</h2>
          <p className="text-xs text-gray-600 mb-3">
            Ciudad o zona del destino (según la solicitud). Las fechas suelen coincidir con el
            tramo que requiere hotel; ajústalas si la estancia es distinta.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad o zona</label>
              <input
                type="text"
                value={hotelCiudad}
                onChange={(e) => setHotelCiudad(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                placeholder="Ej. Cancún, Quintana Roo"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Entrada</label>
              <input
                type="date"
                value={hotelCheckIn}
                onChange={(e) => setHotelCheckIn(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Salida</label>
              <input
                type="date"
                value={hotelCheckOut}
                onChange={(e) => setHotelCheckOut(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Huéspedes</label>
              <input
                type="number"
                min={1}
                max={9}
                value={hotelHuespedes}
                onChange={(e) => setHotelHuespedes(Number(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void buscarHoteles()}
              disabled={searchingHotels}
              className="px-4 py-2 rounded-md bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 disabled:bg-gray-400"
            >
              {searchingHotels ? "Buscando…" : "Buscar hospedaje"}
            </button>
          </div>
        </section>
      ) : null}

      {needsHotel && hotelOffers.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Resultados de hospedaje</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hotelOffers.map((h) => (
              <article
                key={h.id}
                className="border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col gap-2 bg-white"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{h.hotelName}</p>
                    <p className="text-xs text-gray-500">{h.addressHint}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {h.totalAmount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}{" "}
                    {h.totalCurrency}
                  </p>
                </div>
                <p className="text-xs text-gray-600">
                  {h.nights} noche(s) · Entrada {h.checkIn} → Salida {h.checkOut}
                </p>
                {h.stars > 0 ? (
                  <p className="text-xs text-gray-500">Valoración: {h.stars}★</p>
                ) : null}
                <button
                  type="button"
                  disabled={savingHotel}
                  onClick={() => void seleccionarHotel(h)}
                  className="mt-1 w-full py-2 rounded-md border border-amber-800 text-amber-900 text-sm font-medium hover:bg-amber-50 disabled:opacity-50"
                >
                  Seleccionar hospedaje
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {needsHotel && selectedHotel ? (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-900">
          Hospedaje seleccionado: <strong>{selectedHotel.hotelName}</strong> por{" "}
          {selectedHotel.totalAmount} {selectedHotel.totalCurrency}
        </div>
      ) : null}

      <div className="flex justify-end border-t border-gray-200 pt-4">
        <ModalWrapper
          title="¿Finalizar atención de la solicitud?"
          message="Se marcará la solicitud como atendida por agencia de viajes."
          button_type="primary"
          modal_type="success"
          onConfirm={finalizarAtencion}
          variant="filled"
          disabled={!canFinalize}
        >
          {submitting ? "Procesando…" : "Finalizar atención"}
        </ModalWrapper>
      </div>

      {toast ? <Toast message={toast.message} type={toast.type} /> : null}
    </div>
  );
}
