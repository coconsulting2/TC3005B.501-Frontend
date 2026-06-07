import { describe, it, expect } from "vitest";
import {
  buildFlightSearchDefaults,
  buildFlightSegmentsForQuote,
  buildHotelSearchDefaults,
  cityNameToIata,
  computeAgencyServiceFlags,
  parseStoredFlightOffers,
} from "@/utils/travelRequestAgency";

describe("travelRequestAgency", () => {
  it("cityNameToIata resuelve ciudades comunes de México", () => {
    expect(cityNameToIata("Monterrey")).toBe("MTY");
    expect(cityNameToIata("Cancún")).toBe("CUN");
    expect(cityNameToIata("CDMX")).toBe("MEX");
  });

  it("computeAgencyServiceFlags detecta avión y hotel", () => {
    const flags = computeAgencyServiceFlags([
      { plane_needed: true, hotel_needed: false },
      { plane_needed: false, hotel_needed: true },
    ]);
    expect(flags.needsPlane).toBe(true);
    expect(flags.needsHotel).toBe(true);
  });

  it("buildFlightSearchDefaults usa tramo con avión y fechas de regreso", () => {
    const d = buildFlightSearchDefaults([
      {
        plane_needed: true,
        origin_city: "Monterrey",
        destination_city: "Cancún",
        beginning_date: "2026-06-10",
        ending_date: "2026-06-15",
      },
    ]);
    expect(d).not.toBeNull();
    expect(d?.origen).toBe("MTY");
    expect(d?.destino).toBe("CUN");
    expect(d?.fecha).toBe("2026-06-10");
    expect(d?.fecha_regreso).toBe("2026-06-15");
    expect(d?.pasajeros).toBe(1);
  });

  it("buildFlightSearchDefaults omite regreso si ending_date <= beginning_date", () => {
    const d = buildFlightSearchDefaults([
      {
        plane_needed: true,
        origin_city: "MEX",
        destination_city: "GDL",
        beginning_date: "2026-06-10",
        ending_date: "2026-06-09",
      },
    ]);
    expect(d?.fecha_regreso).toBeUndefined();
  });

  it("buildFlightSegmentsForQuote devuelve un tramo por cada plane_needed", () => {
    const segments = buildFlightSegmentsForQuote([
      {
        router_index: 0,
        plane_needed: true,
        origin_city: "CDMX",
        destination_city: "Monterrey",
        beginning_date: "2026-08-01",
      },
      {
        router_index: 1,
        plane_needed: true,
        origin_city: "Monterrey",
        destination_city: "Guadalajara",
        beginning_date: "2026-08-03",
      },
      { router_index: 2, plane_needed: false, origin_city: "GDL", destination_city: "CDMX" },
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0].routerIndex).toBe(0);
    expect(segments[1].routerIndex).toBe(1);
    expect(segments[0].defaults.origen).toBe("MEX");
    expect(segments[1].defaults.destino).toBe("GDL");
  });

  it("parseStoredFlightOffers lee formato v2 y legacy", () => {
    const v2 = parseStoredFlightOffers({
      version: 2,
      segments: [{ router_index: 1, offer: { airlineName: "Test", totalAmount: 100 } }],
    });
    expect(v2[1]?.airlineName).toBe("Test");

    const legacy = parseStoredFlightOffers({ airlineName: "Legacy", totalAmount: 50 });
    expect(legacy[0]?.airlineName).toBe("Legacy");
  });

  it("buildHotelSearchDefaults usa primer tramo con hotel", () => {
    const h = buildHotelSearchDefaults([
      { hotel_needed: false },
      {
        hotel_needed: true,
        destination_city: "Guadalajara",
        beginning_date: "2026-07-01",
        ending_date: "2026-07-04",
      },
    ]);
    expect(h?.ciudad).toContain("Guadalajara");
    expect(h?.fecha_entrada).toBe("2026-07-01");
    expect(h?.fecha_salida).toBe("2026-07-04");
  });
});
