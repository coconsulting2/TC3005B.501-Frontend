import { useCallback, useMemo, useState } from "react";
import { apiRequest } from "@utils/apiClient";
import { showAppAlert } from "@utils/appAlert";
import type { FlightSegmentQuote, NormalizedFlightOffer } from "@utils/travelRequestAgency";

const IATA_SUGGESTIONS = [
  "MEX",
  "GDL",
  "MTY",
  "CUN",
  "TIJ",
  "LAX",
  "JFK",
  "MIA",
  "ORD",
  "LHR",
  "CDG",
  "MAD",
  "BOG",
  "LIM",
  "SCL",
];

interface Props {
  segment: FlightSegmentQuote;
  requestId: string;
  token: string;
  selected: NormalizedFlightOffer | null;
  onSelected: (routerIndex: number, offer: NormalizedFlightOffer) => void;
  showTramoHeading?: boolean;
}

export default function FlightQuoteSegment({
  segment,
  requestId,
  token,
  selected,
  onSelected,
  showTramoHeading = false,
}: Props) {
  const [origen, setOrigen] = useState(segment.defaults.origen);
  const [destino, setDestino] = useState(segment.defaults.destino);
  const [fecha, setFecha] = useState(segment.defaults.fecha);
  const [fechaRegreso, setFechaRegreso] = useState(segment.defaults.fecha_regreso ?? "");
  const [pasajeros, setPasajeros] = useState(segment.defaults.pasajeros);
  const [searching, setSearching] = useState(false);
  const [offers, setOffers] = useState<NormalizedFlightOffer[]>([]);
  const [savingOffer, setSavingOffer] = useState(false);

  const origenList = useMemo(
    () => IATA_SUGGESTIONS.filter((c) => c.includes(origen.toUpperCase()) || origen.length < 2),
    [origen],
  );
  const destinoList = useMemo(
    () => IATA_SUGGESTIONS.filter((c) => c.includes(destino.toUpperCase()) || destino.length < 2),
    [destino],
  );

  const buscarVuelos = useCallback(async () => {
    setSearching(true);
    setOffers([]);
    try {
      const res = await apiRequest<{ offers: NormalizedFlightOffer[] }>("/flights/search", {
        method: "POST",
        data: {
          origen: origen.toUpperCase().slice(0, 3),
          destino: destino.toUpperCase().slice(0, 3),
          fecha,
          ...(fechaRegreso.trim() ? { fecha_regreso: fechaRegreso.trim() } : {}),
          pasajeros,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      setOffers(res.offers ?? []);
      if (!res.offers?.length) {
        showAppAlert("No se encontraron vuelos para esos criterios.", { variant: "info" });
      }
    } catch (e) {
      console.error(e);
      showAppAlert("No se pudo buscar vuelos. Verifica permisos de agencia o el backend.", {
        variant: "error",
      });
    } finally {
      setSearching(false);
    }
  }, [origen, destino, fecha, fechaRegreso, pasajeros, token]);

  const seleccionarOferta = useCallback(
    async (offer: NormalizedFlightOffer) => {
      setSavingOffer(true);
      try {
        await apiRequest(`/travel-agent/travel-request/${requestId}/selected-flight`, {
          method: "PUT",
          data: {
            offer,
            router_index: segment.routerIndex,
            segment_label: segment.label,
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        onSelected(segment.routerIndex, offer);
      } catch (e) {
        console.error(e);
        showAppAlert("No se pudo guardar la oferta de vuelo.", { variant: "error" });
      } finally {
        setSavingOffer(false);
      }
    },
    [requestId, token, segment.routerIndex, segment.label, onSelected],
  );

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 bg-gray-50 space-y-3">
      {showTramoHeading ? (
        <h3 className="text-sm font-semibold text-gray-900">
          Tramo {segment.routerIndex + 1}: {segment.label}
        </h3>
      ) : (
        <h2 className="text-sm font-semibold text-gray-800">Buscar vuelos</h2>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Origen (IATA)</label>
          <input
            list={`iata-origen-${segment.routerIndex}`}
            value={origen}
            onChange={(e) => setOrigen(e.target.value.toUpperCase())}
            maxLength={3}
            className="w-full border border-gray-300 rounded px-2 py-2 text-sm uppercase"
          />
          <datalist id={`iata-origen-${segment.routerIndex}`}>
            {origenList.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Destino (IATA)</label>
          <input
            list={`iata-destino-${segment.routerIndex}`}
            value={destino}
            onChange={(e) => setDestino(e.target.value.toUpperCase())}
            maxLength={3}
            className="w-full border border-gray-300 rounded px-2 py-2 text-sm uppercase"
          />
          <datalist id={`iata-destino-${segment.routerIndex}`}>
            {destinoList.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha ida</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha regreso</label>
          <input
            type="date"
            value={fechaRegreso}
            onChange={(e) => setFechaRegreso(e.target.value)}
            min={fecha}
            className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
            title="Opcional — ida y vuelta según el tramo"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Pasajeros</label>
          <input
            type="number"
            min={1}
            max={9}
            value={pasajeros}
            onChange={(e) => setPasajeros(Number(e.target.value) || 1)}
            className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void buscarVuelos()}
          disabled={searching}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
        >
          {searching ? "Buscando…" : "Buscar vuelos"}
        </button>
      </div>

      {offers.length > 0 ? (
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Resultados
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offers.map((o) => (
              <article
                key={o.id}
                className="border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col gap-2 bg-white"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{o.airlineName}</p>
                    <p className="text-xs text-gray-500">
                      {o.airlineIata} · {o.stops === 0 ? "Directo" : `${o.stops} escala(s)`}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {o.totalAmount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}{" "}
                    {o.totalCurrency}
                  </p>
                </div>
                <p className="text-xs text-gray-600">
                  Salida: {formatTime(o.departureAt)} → Llegada: {formatTime(o.arrivalAt)}
                </p>
                <p className="text-xs text-gray-500">Duración: {o.durationLabel}</p>
                <button
                  type="button"
                  disabled={savingOffer}
                  onClick={() => void seleccionarOferta(o)}
                  className="mt-1 w-full py-2 rounded-md border border-blue-600 text-blue-700 text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
                >
                  Seleccionar vuelo
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-900">
          Vuelo seleccionado: <strong>{selected.airlineName}</strong> por {selected.totalAmount}{" "}
          {selected.totalCurrency}
        </div>
      ) : null}
    </div>
  );
}
