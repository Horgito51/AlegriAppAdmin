import { dataClient, tables } from "./client.js?v=20260614-7";

const table = tables.materias;

function normalize(row) {
  const curso = row.cursos;
  return {
    id: row.id,
    nombre: row.nombre || "",
    descripcion: row.descripcion || "",
    curso_id: row.curso_id,
    curso: curso ? `${curso.nombre} ${curso.paralelo}` : `Curso #${row.curso_id}`,
    docente_id: row.docente_id,
    estado: row.estado || "activo",
  };
}

export const materiasApi = {
  async catalogs() {
    const cursos = await dataClient.request(tables.cursos, {
      params: {
        select: "id,nombre,paralelo,anio_lectivo,estado",
        deleted_at: "is.null",
        order: "nombre.asc,paralelo.asc",
      },
    });
    return { cursos };
  },

  async list() {
    const rows = await dataClient.request(table, {
      params: {
        select: "id,nombre,descripcion,curso_id,docente_id,estado,deleted_at,cursos(nombre,paralelo,anio_lectivo)",
        deleted_at: "is.null",
        order: "nombre.asc",
      },
    });
    return rows.map(normalize);
  },

  create(payload) {
    return dataClient.create(table, {
      nombre: payload.nombre,
      descripcion: payload.descripcion || null,
      curso_id: Number(payload.curso_id),
      estado: payload.estado || "activo",
    });
  },

  update(id, payload) {
    return dataClient.update(table, id, {
      nombre: payload.nombre,
      descripcion: payload.descripcion || null,
      curso_id: Number(payload.curso_id),
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
