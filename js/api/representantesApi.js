import { config, dataClient, tables } from "./client.js?v=20260615-3";

const representantesTable = tables.representantes || "representantes";
const estudiantesTable = tables.estudiantes || "estudiantes";
const estudianteRepresentanteTable = tables.estudianteRepresentante || "estudiante_representante";
const VALID_STATES = new Set(["activo", "inactivo"]);

function normalize(row) {
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
  async list() {
    if (typeof dataClient.request === "function") {
      try {
        const rows = await requestRows({
          select:
            "id,usuario_id,nombre,apellido,cedula,telefono,telefono_alternativo,email,direccion,ocupacion,estado,created_at,updated_at,deleted_at,created_by,updated_by,estudiante_representante(id,deleted_at,estudiantes(id,nombre,apellido))",
          deleted_at: "is.null",
          order: "apellido.asc,nombre.asc",
        });
        return Array.isArray(rows) ? rows.map(normalize) : [];
      } catch {
        // Fallback below
      }
    }

    const [representantes, links, estudiantes] = await Promise.all([
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
            })
          )
      : [];
  },

  async create(payload) {
    try {
      const row = await dataClient.create(representantesTable, sanitizePayload(payload, { includeCreatedBy: true }));
      return normalize(row);
    } catch (err) {
      throw new Error(err.message || "No se pudo crear el representante.");
    }
  },

  async update(id, payload) {
    try {
      const row = await dataClient.update(representantesTable, id, sanitizePayload(payload));
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
