import { config, dataClient, tables } from "./client.js?v=20260615-5";

const representantesTable = tables.representantes || "representantes";
const estudiantesTable = tables.estudiantes || "estudiantes";
const estudianteRepresentanteTable = tables.estudianteRepresentante || "estudiante_representante";
const configuracionTelegramTable = tables.configuracionTelegram || "configuracion_telegram";
const VALID_STATES = new Set(["activo", "inactivo"]);
const DEFAULT_TELEGRAM_BOT_TOKEN = "8235233317:AAEn1wkXc491vq2sM-P5S8M4UkjfN_DUteU";

function normalize(row) {
  const telegramConfig = row.telegram_config || row.configuracion_telegram || null;
  const telegramActive =
    telegramConfig &&
    telegramConfig.deleted_at == null &&
    telegramConfig.chat_id &&
    telegramConfig.estado_integracion === "activo";

  return {
    id: row.id,
    usuario_id: row.usuario_id || null,
    nombre: row.nombre || "",
    apellido: row.apellido || "",
    nombre_completo: [row.nombre, row.apellido].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
    cedula: row.cedula || "",
    telefono: row.telefono || "",
    telefono_alternativo: row.telefono_alternativo || "",
    email: row.email || "",
    direccion: row.direccion || "",
    ocupacion: row.ocupacion || "",
    estado: VALID_STATES.has(row.estado) ? row.estado : "activo",
    chat_id: telegramConfig?.chat_id || "",
    telegram_chat_id: telegramConfig?.chat_id || "",
    telegram_verificado: telegramConfig?.verificado === true,
    estadoTelegram: telegramActive ? "Configurado" : "Sin chat ID",
    estudiantes: Array.isArray(row.estudiantes)
      ? row.estudiantes
      : Array.isArray(row.estudiante_representante)
        ? row.estudiante_representante
            .filter((item) => item?.deleted_at == null)
            .map((item) => [item.estudiantes?.nombre, item.estudiantes?.apellido].filter(Boolean).join(" ").trim())
            .filter(Boolean)
        : [],
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    deleted_at: row.deleted_at || null,
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
  };
}

function sanitizePayload(payload = {}, { includeCreatedBy = false } = {}) {
  const now = new Date().toISOString();
  const currentUserId = Number(config.currentUserId);
  const hasAuditUser = Number.isInteger(currentUserId) && currentUserId > 0;

  const record = { updated_at: now };
  const entries = [
    ["nombre", payload.nombre],
    ["apellido", payload.apellido],
    ["cedula", payload.cedula],
    ["telefono", payload.telefono],
    ["telefono_alternativo", payload.telefono_alternativo],
    ["email", payload.email],
    ["direccion", payload.direccion],
    ["ocupacion", payload.ocupacion],
  ];

  entries.forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      record[key] = value || null;
    }
  });

  if (Object.prototype.hasOwnProperty.call(payload, "estado")) {
    record.estado = VALID_STATES.has(payload.estado) ? payload.estado : "activo";
  }

  if (includeCreatedBy) {
    record.created_at = now;
    if (hasAuditUser) record.created_by = currentUserId;
  }

  if (hasAuditUser) record.updated_by = currentUserId;
  return record;
}

function sanitizeTelegramPayload(payload = {}, representative) {
  const now = new Date().toISOString();
  const currentUserId = Number(config.currentUserId);
  const hasAuditUser = Number.isInteger(currentUserId) && currentUserId > 0;
  const chatId = String(payload.chat_id || "").trim();

  if (!chatId) return null;

  return {
    chat_id: chatId,
    token_bot_encriptado: DEFAULT_TELEGRAM_BOT_TOKEN,
    tipo_destinatario: "representante",
    usuario_id: null,
    representante_id: representative.id,
    nombre_destinatario: [representative.nombre, representative.apellido].filter(Boolean).join(" ").replace(/\s+/g, " ").trim() || null,
    estado_integracion: "activo",
    verificado: false,
    fecha_verificacion: null,
    observaciones: payload.telegram_observaciones || null,
    deleted_at: null,
    updated_at: now,
    ...(hasAuditUser ? { updated_by: currentUserId } : {}),
  };
}

async function fetchTelegramConfigs() {
  if (typeof dataClient.request === "function") {
    return dataClient.request(configuracionTelegramTable, {
      params: {
        select: "id,representante_id,chat_id,token_bot_encriptado,tipo_destinatario,usuario_id,nombre_destinatario,estado_integracion,verificado,fecha_verificacion,observaciones,deleted_at,created_at,updated_at,created_by,updated_by",
        order: "id.asc",
      },
    }).catch(() => []);
  }

  return dataClient.list(configuracionTelegramTable, {}).catch(() => []);
}

async function syncTelegramConfig(representative, payload = {}) {
  const chatId = String(payload.chat_id || "").trim();
  const now = new Date().toISOString();
  const currentUserId = Number(config.currentUserId);
  const hasAuditUser = Number.isInteger(currentUserId) && currentUserId > 0;
  const telegramPayload = sanitizeTelegramPayload(payload, representative);
  const configs = await fetchTelegramConfigs();
  const existing = (Array.isArray(configs) ? configs : []).find(
    (item) => Number(item.representante_id) === Number(representative.id) && item?.deleted_at == null
  );

  if (!chatId) {
    if (!existing) return null;
    if (typeof dataClient.request === "function") {
      const rows = await dataClient.request(configuracionTelegramTable, {
        method: "PATCH",
        params: { id: `eq.${existing.id}` },
        body: {
          chat_id: existing.chat_id,
          estado_integracion: "inactivo",
          deleted_at: now,
          updated_at: now,
          ...(hasAuditUser ? { updated_by: currentUserId } : {}),
        },
      });
      return Array.isArray(rows) ? rows[0] : rows;
    }

    return dataClient.update(configuracionTelegramTable, existing.id, {
      estado_integracion: "inactivo",
      deleted_at: now,
      updated_at: now,
      ...(hasAuditUser ? { updated_by: currentUserId } : {}),
    });
  }

  if (existing) {
    if (typeof dataClient.request === "function") {
      const rows = await dataClient.request(configuracionTelegramTable, {
        method: "PATCH",
        params: { id: `eq.${existing.id}` },
        body: telegramPayload,
      });
      return Array.isArray(rows) ? rows[0] : rows;
    }

    return dataClient.update(configuracionTelegramTable, existing.id, telegramPayload);
  }

  const createPayload = {
    ...telegramPayload,
    created_at: now,
    ...(hasAuditUser ? { created_by: currentUserId } : {}),
  };

  return dataClient.create(configuracionTelegramTable, createPayload);
}

async function requestRows(params) {
  if (typeof dataClient.request === "function") {
    try {
      return await dataClient.request(representantesTable, { params });
    } catch {
      return dataClient.request(representantesTable, {
        params: {
          select: "id,usuario_id,nombre,apellido,cedula,telefono,telefono_alternativo,email,direccion,ocupacion,estado,created_at,updated_at,created_by,updated_by",
          order: "apellido.asc,nombre.asc",
        },
      });
    }
  }

  const rows = await dataClient.list(representantesTable, { order: ["apellido", "nombre"] });
  return rows.filter((row) => row?.deleted_at == null);
}

export const representantesApi = {
  async repairTelegramConfigTokens() {
    const now = new Date().toISOString();
    const currentUserId = Number(config.currentUserId);
    const hasAuditUser = Number.isInteger(currentUserId) && currentUserId > 0;
    const configs = await fetchTelegramConfigs();
    const rows = (Array.isArray(configs) ? configs : []).filter(
      (item) =>
        item?.deleted_at == null &&
        item?.tipo_destinatario === "representante" &&
        String(item.chat_id || "").trim() &&
        !String(item.token_bot_encriptado || "").trim()
    );

    for (const row of rows) {
      const payload = {
        token_bot_encriptado: DEFAULT_TELEGRAM_BOT_TOKEN,
        updated_at: now,
        ...(hasAuditUser ? { updated_by: currentUserId } : {}),
      };

      if (typeof dataClient.request === "function") {
        await dataClient.request(configuracionTelegramTable, {
          method: "PATCH",
          params: { id: `eq.${row.id}` },
          body: payload,
        });
      } else {
        await dataClient.update(configuracionTelegramTable, row.id, payload);
      }
    }

    return rows.length;
  },

  async list() {
    const [representantes, links, estudiantes, telegramConfigs] = await Promise.all([
      requestRows({
        select:
          "id,usuario_id,nombre,apellido,cedula,telefono,telefono_alternativo,email,direccion,ocupacion,estado,created_at,updated_at,deleted_at,created_by,updated_by",
        order: "apellido.asc,nombre.asc",
      }),
      typeof dataClient.request === "function"
        ? dataClient.request(estudianteRepresentanteTable, {
            params: {
              select: "id,estudiante_id,representante_id,deleted_at",
              order: "id.asc",
            },
          }).catch(() => [])
        : dataClient.list(estudianteRepresentanteTable, {}).catch(() => []),
      typeof dataClient.request === "function"
        ? dataClient.request(estudiantesTable, {
            params: {
              select: "id,nombre,apellido,deleted_at",
              order: "apellido.asc,nombre.asc",
            },
          }).catch(() => [])
        : dataClient.list(estudiantesTable, {}).catch(() => []),
      typeof dataClient.request === "function"
        ? dataClient.request(configuracionTelegramTable, {
            params: {
              select: "id,representante_id,chat_id,estado_integracion,verificado,deleted_at,updated_at",
              order: "id.asc",
            },
          }).catch(() => [])
        : dataClient.list(configuracionTelegramTable, {}).catch(() => []),
    ]);

    return Array.isArray(representantes)
      ? representantes
          .filter((row) => row?.deleted_at == null)
          .map((row) =>
            normalize({
              ...row,
              estudiantes: (Array.isArray(links) ? links : [])
                .filter((link) => link?.deleted_at == null && Number(link.representante_id) === Number(row.id))
                .map((link) => {
                  const estudiante = (Array.isArray(estudiantes) ? estudiantes : []).find(
                    (item) => item?.deleted_at == null && Number(item.id) === Number(link.estudiante_id)
                  );
                  return [estudiante?.nombre, estudiante?.apellido].filter(Boolean).join(" ").trim();
                })
                .filter(Boolean),
              telegram_config:
                (Array.isArray(telegramConfigs) ? telegramConfigs : []).find(
                  (item) => item?.deleted_at == null && Number(item.representante_id) === Number(row.id)
                ) || null,
            })
          )
      : [];
  },

  async create(payload) {
    try {
      const row = await dataClient.create(representantesTable, sanitizePayload(payload, { includeCreatedBy: true }));
      await syncTelegramConfig(row, payload);
      return normalize(row);
    } catch (err) {
      throw new Error(err.message || "No se pudo crear el representante.");
    }
  },

  async update(id, payload) {
    try {
      const row = await dataClient.update(representantesTable, id, sanitizePayload(payload));
      await syncTelegramConfig(row, payload);
      return normalize(row);
    } catch (err) {
      throw new Error(err.message || "No se pudo actualizar el representante.");
    }
  },

  async toggleStatus(id, estado) {
    const nextState = estado === "activo" ? "inactivo" : "activo";
    try {
      const row = await dataClient.update(representantesTable, id, sanitizePayload({ estado: nextState }));
      return normalize(row);
    } catch (err) {
      throw new Error(err.message || "No se pudo actualizar el estado del representante.");
    }
  },

  async remove(id) {
    const payload = {
      estado: "inactivo",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const currentUserId = Number(config.currentUserId);
    if (Number.isInteger(currentUserId) && currentUserId > 0) {
      payload.updated_by = currentUserId;
    }

    try {
      if (typeof dataClient.request === "function") {
        await dataClient.request(representantesTable, {
          method: "PATCH",
          params: { id: `eq.${id}` },
          body: payload,
        });
        return true;
      }

      await dataClient.update(representantesTable, id, payload);
      return true;
    } catch (err) {
      throw new Error(err.message || "No se pudo eliminar el representante.");
    }
  },
};
