import { dataClient, tables } from "./client.js?v=20260614-8";

const estudiantesTable = tables.estudiantes || "estudiantes";
const estudianteRepresentanteTable = tables.estudianteRepresentante || "estudiante_representante";

function normalize(row) {
  const reps = Array.isArray(row.estudiante_representante) ? row.estudiante_representante : [];
  const repNames = reps
    .filter((r) => r?.representantes)
    .map((r) => [r.representantes.nombre, r.representantes.apellido].filter(Boolean).join(" ").trim());

  return {
    id: row.id,
    nombre: row.nombre || "",
    apellido: row.apellido || "",
    codigo_institucional: row.codigo_institucional || null,
    telefono: row.telefono || null,
    estado: row.estado || "activo",
    representantes: repNames,
  };
}

export const estudiantesApi = {
  async list() {
    const rows = await dataClient.list(estudiantesTable, { order: ["apellido", "nombre"] });
    return Array.isArray(rows) ? rows.map(normalize) : [];
  },

  async create(payload) {
    try {
      return await dataClient.create(estudiantesTable, {
        nombre: payload.nombre,
        apellido: payload.apellido,
        codigo_institucional: payload.codigo_institucional || null,
        telefono: payload.telefono || null,
        estado: payload.estado || "activo",
      });
    } catch (err) {
      throw new Error(err.message || "No se pudo crear el estudiante.");
    }
  },

  async update(id, payload) {
    try {
      return await dataClient.update(estudiantesTable, id, {
        nombre: payload.nombre,
        apellido: payload.apellido,
        codigo_institucional: payload.codigo_institucional || null,
        telefono: payload.telefono || null,
        estado: payload.estado || "activo",
      });
    } catch (err) {
      throw new Error(err.message || "No se pudo actualizar el estudiante.");
    }
  },

  async remove(id) {
    try {
      return await dataClient.remove(estudiantesTable, id);
    } catch (err) {
      throw new Error(err.message || "No se pudo eliminar el estudiante.");
    }
  },
};
