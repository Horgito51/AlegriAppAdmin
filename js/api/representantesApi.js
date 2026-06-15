import { dataClient, tables } from "./client.js?v=20260615-1";

const representantesTable = tables.representantes || "representantes";

function normalizeTelegramConfig(configs = []) {
  const activeConfigs = Array.isArray(configs)
    ? configs.filter((item) => item?.deleted_at == null)
    : [];
  const preferred = activeConfigs.find(
    (item) => item.estado_integracion === "activo" && item.verificado === true
  );
  return preferred || activeConfigs[0] || null;
}

function resolveTelegramState(config) {
  if (!config) return "Pendiente";
  if (config.estado_integracion === "activo" && config.verificado === true) return "Vinculado";
  if (config.estado_integracion === "inactivo") return "Inactivo";
  if (config.estado_integracion === "error") return "Error";
  return "Pendiente";
}

function formatStudentNames(links = []) {
  if (!Array.isArray(links)) return [];
  return links
    .filter((link) => link?.deleted_at == null)
    .map((link) => {
      const estudiante = link.estudiantes || {};
      return [estudiante.nombre, estudiante.apellido].filter(Boolean).join(" ").trim();
    })
    .filter(Boolean);
}

function normalize(row) {
  const telegramConfig = normalizeTelegramConfig(row.configuracion_telegram);
  return {
    id: row.id,
    nombre: row.nombre || "",
    apellido: row.apellido || "",
    telefono: row.telefono || "",
    estudiantes: formatStudentNames(row.estudiante_representante),
    chatId: telegramConfig?.chat_id || null,
    estadoIntegracion: telegramConfig?.estado_integracion || null,
    verificado: telegramConfig?.verificado || false,
    nombreDestinatario: telegramConfig?.nombre_destinatario || null,
    fechaVerificacion: telegramConfig?.fecha_verificacion || null,
    estadoTelegram: resolveTelegramState(telegramConfig),
  };
}

export const representantesApi = {
  async list() {
    const rows = await dataClient.request(representantesTable, {
      params: {
        select:
          "id,nombre,apellido,telefono,estudiante_representante(estudiante_id,deleted_at,estudiantes(id,nombre,apellido)),configuracion_telegram(id,chat_id,tipo_destinatario,representante_id,nombre_destinatario,estado_integracion,verificado,fecha_verificacion,deleted_at)",
        deleted_at: "is.null",
        "configuracion_telegram.deleted_at": "is.null",
        "estudiante_representante.deleted_at": "is.null",
        order: "apellido.asc,nombre.asc",
      },
    });
    return Array.isArray(rows) ? rows.map(normalize) : [];
  },
};
