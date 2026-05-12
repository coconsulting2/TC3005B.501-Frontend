import { useCallback, useMemo, useState } from "react";
import { apiRequest } from "@utils/apiClient";
import ModalWrapper from "@components/ModalWrapper";
import Toast from "@components/Toast";
import { showAppAlert } from "@utils/appAlert";

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

interface Props {
  request_id: string;
  token: string;
}

export default function AttendRequest({ request_id, token }: Props) {
  const [origen, setOrigen] = useState("MEX");
  const [destino, setDestino] = useState("CUN");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [pasajeros, setPasajeros] = useState(1);
  const [searching, setSearching] = useState(false);
  const [offers, setOffers] = useState<NormalizedFlightOffer[]>([]);
  const [selected, setSelected] = useState<NormalizedFlightOffer | null>(null);
  const [savingOffer, setSavingOffer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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
  }, [origen, destino, fecha, pasajeros, token]);

  const seleccionarOferta = useCallback(
    async (offer: NormalizedFlightOffer) => {
      setSavingOffer(true);
      try {
        await apiRequest(`/travel-agent/travel-request/${request_id}/selected-flight`, {
          method: "PUT",
          data: { offer },
          headers: { Authorization: `Bearer ${token}` },
        });
        setSelected(offer);
        setToast({ message: "Oferta guardada en la solicitud.", type: "success" });
      } catch (e) {
        console.error(e);
        showAppAlert("No se pudo guardar la oferta.", { variant: "error" });
      } finally {
        setSavingOffer(false);
      }
    },
    [request_id, token],
  );

  const finalizarAtencion = useCallback(async () => {
    if (!selected) {
      showAppAlert("Selecciona y guarda una oferta de vuelo antes de finalizar la atención.", {
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
  }, [request_id, token, selected]);

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
    <div className="w-full max-w-5xl space-y-8 p-6 bg-white rounded border border-gray-200">
      <h1 className="text-xl font-semibold text-gray-900">Agencia de viajes</h1>
      <p className="text-sm text-gray-600">
        Busca vuelos (Duffel en sandbox o modo mock) y guarda la oferta elegida antes de finalizar la
        cotización.
      </p>

      <section className="rounded-lg border border-gray-200 p-4 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Buscar vuelos</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Origen (IATA)</label>
            <input
              list="iata-origen"
              value={origen}
              onChange={(e) => setOrigen(e.target.value.toUpperCase())}
              maxLength={3}
              className="w-full border border-gray-300 rounded px-2 py-2 text-sm uppercase"
            />
            <datalist id="iata-origen">
              {origenList.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Destino (IATA)</label>
            <input
              list="iata-destino"
              value={destino}
              onChange={(e) => setDestino(e.target.value.toUpperCase())}
              maxLength={3}
              className="w-full border border-gray-300 rounded px-2 py-2 text-sm uppercase"
            />
            <datalist id="iata-destino">
              {destinoList.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
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
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void buscarVuelos()}
            disabled={searching}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
          >
            {searching ? "Buscando…" : "Buscar"}
          </button>
        </div>
      </section>

      {offers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Resultados</h2>
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
                  Seleccionar
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {selected && (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-900">
          Oferta seleccionada: <strong>{selected.airlineName}</strong> por{" "}
          {selected.totalAmount} {selected.totalCurrency}
        </div>
      )}

      <div className="flex justify-end border-t border-gray-200 pt-4">
        <ModalWrapper
          title="¿Finalizar atención de la solicitud?"
          message="Se marcará la solicitud como atendida por agencia de viajes."
          button_type="primary"
          modal_type="success"
          onConfirm={finalizarAtencion}
          variant="filled"
          disabled={submitting || !selected}
        >
          {submitting ? "Procesando…" : "Finalizar atención"}
        </ModalWrapper>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
