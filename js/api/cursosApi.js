import { dataClient, tables } from "./client.js?v=20260614-8";

const table = tables.cursos;

function normalize(row) {
  const periodo = row.periodos_academicos;
  return {
    id: row.id,
    nombre: row.nombre || "",
    paralelo: row.paralelo || "",
    nivel_academico_id: row.nivel_academico_id,
    periodo_academico_id: row.periodo_academico_id,
    anio_lectivo: row.anio_lectivo || periodo?.anio_lectivo || "",
    nivel: row.niveles_academicos?.nombre || `Nivel #${row.nivel_academico_id}`,
    periodo_academico: periodo ? `${periodo.nombre} ${periodo.anio_lectivo}` : "",
    estado: row.estado || "activo",
  };
}

export const cursosApi = {
  async catalogs() {
    const [niveles, periodos] = await Promise.all([
      dataClient.request(tables.nivelesAcademicos, {
        params: { select: "id,nombre,orden,activo", activo: "eq.true", order: "orden.asc" },
      }),
      dataClient.request(tables.periodosAcademicos, {
        params: { select: "id,nombre,anio_lectivo,activo", order: "id.desc" },
      }),
    ]);
    return { niveles, periodos };
  },

  async list() {
    const rows = await dataClient.request(table, {
      params: {
        select: "id,nombre,paralelo,anio_lectivo,nivel_academico_id,periodo_academico_id,estado,deleted_at,niveles_academicos(nombre),periodos_academicos(nombre,anio_lectivo)",
        deleted_at: "is.null",
        order: "nombre.asc,paralelo.asc",
      },
    });
    return rows.map(normalize);
  },

  create(payload) {
    return dataClient.create(table, {
      nombre: payload.nombre,
      paralelo: payload.paralelo,
      nivel_academico_id: Number(payload.nivel_academico_id),
      periodo_academico_id: payload.periodo_academico_id ? Number(payload.periodo_academico_id) : null,
      anio_lectivo: payload.anio_lectivo,
      estado: payload.estado || "activo",
    });
  },

  update(id, payload) {
    return dataClient.update(table, id, {
      nombre: payload.nombre,
      paralelo: payload.paralelo,
      nivel_academico_id: Number(payload.nivel_academico_id),
      periodo_academico_id: payload.periodo_academico_id ? Number(payload.periodo_academico_id) : null,
      anio_lectivo: payload.anio_lectivo,
      estado: payload.estado || "activo",
    });
  },

  async remove(id) {
    await dataClient.update(table, id, {
      estado: "inactivo",
      deleted_at: new Date().toISOString(),
    });
    return true;
  },
};
