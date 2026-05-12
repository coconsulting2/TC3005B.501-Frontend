/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Default MSW request handlers for M1 component tests. Each handler
 * returns minimal valid data for the happy path. Individual tests
 * override a handler with `server.use(...)` when they need a different
 * response (error, empty, specific payload).
 */

import { http, HttpResponse } from "msw";

const API = "https://localhost:3000/api";

export const handlers = [
  http.get(`${API}/user/csrf-token`, () => {
    return HttpResponse.json({ csrfToken: "mock-csrf-token" });
  }),

  http.get(`${API}/comprobantes/:id/validacion-sat`, () => {
    return HttpResponse.json({
      status: "vigente",
      verified_at: "2026-04-15T10:30:00.000Z",
    });
  }),

  http.post(`${API}/comprobantes/parse-xml`, () => {
    return HttpResponse.json({
      rfc_emisor: "EKU9003173C9",
      fecha_emision: "2026-04-10T12:00",
      monto_total: 1250.5,
      uuid: "A1B2C3D4-E5F6-7890-1234-567890ABCDEF",
      registro_sugerido: {
        uuid: "A1B2C3D4-E5F6-7890-1234-567890ABCDEF",
        fecha_timbrado: "2026-04-10T12:00:00.000Z",
        rfc_pac: "XEXX010101000",
        fecha_emision: "2026-04-10T12:00:00.000Z",
        tipo_comprobante: "I",
        lugar_expedicion: "01000",
        metodo_pago: "PUE",
        forma_pago: "03",
        moneda: "MXN",
        subtotal: 1250.5,
        total: 1250.5,
        rfc_emisor: "EKU9003173C9",
        nombre_emisor: "Emisor Test",
        regimen_fiscal_emisor: "601",
        rfc_receptor: "XAXX010101000",
        nombre_receptor: "Receptor Test",
        domicilio_fiscal_receptor: "01000",
        regimen_fiscal_receptor: "601",
        uso_cfdi: "G03",
        version: "4.0",
      },
    });
  }),

  http.post(`${API}/comprobantes/:id`, () => {
    return HttpResponse.json({ ok: true, cfdiId: 1 });
  }),

  http.post(`${API}/comprobantes/:id/registrar`, () => {
    return HttpResponse.json({ ok: true });
  }),

  http.get(`${API}/viajes/:id/resumen-tramos`, () => {
    return HttpResponse.json({
      viaje_id: 1,
      total_general: 0,
      tramos: [],
    });
  }),

  http.post(`${API}/files/upload-receipt-files/:id`, () => {
    return HttpResponse.json({ ok: true });
  }),

  http.get(`${API}/fx/convert`, () => {
    return HttpResponse.json({
      success: true,
      data: { converted: 1000, rate: 20, from: "USD", to: "MXN", amount: 50 },
    });
  }),

  http.delete(`${API}/applicant/delete-receipt/:id`, () => {
    return HttpResponse.json({ ok: true });
  }),

  http.get(`${API}/admin/roles`, () => {
    return HttpResponse.json([
      {
        role_id: 1,
        name: "Administrador",
        permissions: ["admin.roles.gestionar"],
        max_authorization_amount: null,
        expiration_date: null,
        is_admin: true,
        active_users_count: 2,
      },
    ]);
  }),

  http.post(`${API}/admin/roles`, () => {
    return HttpResponse.json({
      role_id: 99,
      name: "Nuevo rol",
      permissions: [],
      max_authorization_amount: null,
      expiration_date: null,
      is_admin: false,
      active_users_count: 0,
    });
  }),

  http.put(`${API}/admin/roles/:id`, () => {
    return HttpResponse.json({ ok: true });
  }),

  http.post(`${API}/workflow/simulate`, () => {
    return HttpResponse.json({
      input: { monto: 0, tipo_gasto: "viaje_nacional", destino: "nacional" },
      steps: [
        {
          level: 1,
          role: "remote",
          role_label: "Aprobador remoto",
          limit: null,
          status: "pending",
        },
      ],
      total_levels: 1,
      auto_approved: false,
      escalation_triggered: false,
      summary: "Respuesta del backend simulada.",
    });
  }),
];
