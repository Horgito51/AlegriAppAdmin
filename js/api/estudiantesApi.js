import { config, dataClient, tables } from "./client.js?v=20260615-3";

const estudiantesTable = tables.estudiantes || "estudiantes";
const cursosTable = tables.cursos || "cursos";
const representantesTable = tables.representantes || "representantes";
const estudianteCursoTable = tables.estudianteCurso || "estudiante_curso";
const estudianteRepresentanteTable = tables.estudianteRepresentante || "estudiante_representante";
const tiposRelacionTable = tables.tiposRelacionRepresentante || "tipos_relacion_representante";

const DEFAULT_RELATION_TYPES = [
  { id: 1, nombre: "Madre" },
  { id: 2, nombre: "Padre" },
  { id: 3, nombre: "Tutor" },
  { id: 4, nombre: "Familiar" },
];

function normalizeRepresentativePayload(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const representanteId = Number(item.representante_id ?? item.id ?? 0);
      const tipoRelacionId = Number(item.tipo_relacion_id ?? 0);
      if (!representanteId) return null;

      return {
        representante_id: representanteId,
        tipo_relacion_id: tipoRelacionId,
        es_principal: item.es_principal === true,
        observaciones: item.observaciones || null,
        _index: index,
      };
    })
    .filter(Boolean);
}

function normalizeInstitutionalCode(value) {
  return String(value || "").trim().toUpperCase();
}

function parseCodeNumber(value) {
  const match = normalizeInstitutionalCode(value).match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function currentAuditUser() {
  const id = Number(config.currentUserId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function currentAuditFields() {
  const userId = currentAuditUser();
  return userId ? { updated_by: userId } : {};
}

function currentCreateAuditFields() {
  const userId = currentAuditUser();
  return userId ? { created_by: userId, updated_by: userId } : {};
}

function normalizeStudent(row) {
  const courseLinks = Array.isArray(row.estudiante_curso) ? row.estudiante_curso : [];
  const activeCourse =
    courseLinks.find((item) => item?.deleted_at == null && item?.estado === "activo") ||
    courseLinks.find((item) => item?.deleted_at == null) ||
    null;

  const representativeLinks = Array.isArray(row.estudiante_representante)
    ? row.estudiante_representante
        .filter((item) => item?.deleted_at == null)
        .map((item) => ({
          id: item.id,
          representante_id: item.representante_id,
          tipo_relacion_id: item.tipo_relacion_id,
          tipo_relacion: item.tipos_relacion_representante?.nombre || "",
          es_principal: item.es_principal === true,
          observaciones: item.observaciones || "",
          representante_nombre: [item.representantes?.nombre, item.representantes?.apellido].filter(Boolean).join(" ").trim(),
        }))
        .sort((a, b) => Number(b.es_principal) - Number(a.es_principal) || a.representante_nombre.localeCompare(b.representante_nombre))
    : [];

  const principal = representativeLinks.find((item) => item.es_principal) || representativeLinks[0] || null;

  return {
    id: row.id,
    codigo_institucional: row.codigo_institucional || "",
    nombre: row.nombre || "",
    apellido: row.apellido || "",
    cedula: row.cedula || "",
    fecha_nacimiento: row.fecha_nacimiento || "",
    genero: row.genero || "",
    direccion: row.direccion || "",
    fotografia: row.fotografia || "",
    estado: row.estado || "activo",
    observaciones: row.observaciones || "",
    curso_id: activeCourse?.curso_id || "",
    curso: activeCourse?.cursos ? [activeCourse.cursos.nombre, activeCourse.cursos.paralelo].filter(Boolean).join(" ") : "",
    representantes: representativeLinks,
    representante_principal: principal?.representante_nombre || "",
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

async function requestRows(table, params) {
  if (typeof dataClient.request === "function") {
    return dataClient.request(table, { params });
  }

  const rows = await dataClient.list(table, {});
  if (!Array.isArray(rows)) return [];

  const filtered = rows.filter((row) =>
    Object.entries(params || {}).every(([key, value]) => {
      if (key === "select" || key === "order" || value == null || value === "") return true;
      if (value === "is.null") return row[key] == null;
      if (typeof value === "string" && value.startsWith("eq.")) {
        return String(row[key] ?? "") === value.slice(3);
      }
      return true;
    })
  );

  const orderKeys = String(params?.order || "")
    .split(",")
    .map((item) => item.split(".")[0])
    .filter(Boolean);

  if (!orderKeys.length) return filtered;

  return [...filtered].sort((a, b) => {
    for (const key of orderKeys) {
      const av = String(a[key] ?? "").toLowerCase();
      const bv = String(b[key] ?? "").toLowerCase();
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

async function patchRow(table, id, payload) {
  if (typeof dataClient.request === "function") {
    const rows = await dataClient.request(table, {
      method: "PATCH",
      params: { id: `eq.${id}` },
      body: payload,
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  return dataClient.update(table, id, payload);
}

function sanitizeStudentPayload(payload = {}, { includeCreatedBy = false } = {}) {
  const now = new Date().toISOString();
  const record = {
    nombre: payload.nombre,
    apellido: payload.apellido,
    cedula: payload.cedula || null,
    fecha_nacimiento: payload.fecha_nacimiento || null,
    genero: payload.genero || null,
    direccion: payload.direccion || null,
    fotografia: payload.fotografia || null,
    estado: payload.estado || "activo",
    observaciones: payload.observaciones || null,
    updated_at: now,
    ...currentAuditFields(),
  };

  if (Object.prototype.hasOwnProperty.call(payload, "codigo_institucional")) {
    record.codigo_institucional = normalizeInstitutionalCode(payload.codigo_institucional);
  }

  if (includeCreatedBy) {
    record.created_at = now;
    Object.assign(record, currentCreateAuditFields());
  }

  return record;
}

async function generateInstitutionalCode() {
  const rows = await requestRows(estudiantesTable, {
    select: "id,codigo_institucional",
    order: "codigo_institucional.asc",
  });

  const maxNumber = rows.reduce((max, row) => Math.max(max, parseCodeNumber(row.codigo_institucional)), 0);
  return `EST-${String(maxNumber + 1).padStart(4, "0")}`;
}

async function fetchActiveCourses() {
  if (typeof dataClient.request !== "function") {
    const rows = await requestRows(cursosTable, { order: "nombre.asc,paralelo.asc" });
    return rows.filter((row) => String(row.estado || "activo").toLowerCase() === "activo");
  }

  try {
    return await requestRows(cursosTable, {
      select: "id,nombre,paralelo,anio_lectivo,estado,deleted_at",
      deleted_at: "is.null",
      estado: "eq.activo",
      order: "nombre.asc,paralelo.asc",
    });
  } catch {
    try {
      const rows = await requestRows(cursosTable, {
        select: "id,nombre,paralelo,anio_lectivo,estado",
        estado: "eq.activo",
        order: "nombre.asc,paralelo.asc",
      });
      return Array.isArray(rows) ? rows : [];
    } catch {
      const rows = await requestRows(cursosTable, {
        select: "id,nombre,paralelo,anio_lectivo,estado",
        order: "nombre.asc,paralelo.asc",
      });
      return Array.isArray(rows)
        ? rows.filter((row) => String(row.estado || "activo").toLowerCase() === "activo")
        : [];
    }
  }
}

async function fetchActiveRepresentatives() {
  if (typeof dataClient.request !== "function") {
    const rows = await requestRows(representantesTable, { order: "apellido.asc,nombre.asc" });
    return rows.filter((row) => String(row.estado || "activo").toLowerCase() === "activo");
  }

  try {
    return await requestRows(representantesTable, {
      select: "id,nombre,apellido,cedula,telefono,email,estado,deleted_at",
      deleted_at: "is.null",
      estado: "eq.activo",
      order: "apellido.asc,nombre.asc",
    });
  } catch {
    try {
      return await requestRows(representantesTable, {
        select: "id,nombre,apellido,cedula,telefono,email,estado",
        estado: "eq.activo",
        order: "apellido.asc,nombre.asc",
      });
    } catch {
      const rows = await requestRows(representantesTable, {
        select: "id,nombre,apellido,cedula,telefono,email,estado",
        order: "apellido.asc,nombre.asc",
      });
      return Array.isArray(rows)
        ? rows.filter((row) => String(row.estado || "activo").toLowerCase() === "activo")
        : [];
    }
  }
}

async function fetchRelationTypes() {
  if (typeof dataClient.request !== "function") return DEFAULT_RELATION_TYPES;

  try {
    const rows = await requestRows(tiposRelacionTable, {
      select: "id,nombre,estado,deleted_at",
      deleted_at: "is.null",
      order: "id.asc",
    });
    return Array.isArray(rows) && rows.length ? rows : DEFAULT_RELATION_TYPES;
  } catch {
    try {
      const rows = await requestRows(tiposRelacionTable, {
        select: "id,nombre,estado",
        order: "id.asc",
      });
      return Array.isArray(rows) && rows.length ? rows : DEFAULT_RELATION_TYPES;
    } catch {
      return DEFAULT_RELATION_TYPES;
    }
  }
}

async function fetchCourseRelations(estudianteId) {
  return requestRows(estudianteCursoTable, {
    select: "id,estudiante_id,curso_id,fecha_inscripcion,estado,observaciones,deleted_at",
    estudiante_id: `eq.${estudianteId}`,
    order: "id.asc",
  });
}

async function fetchRepresentativeRelations(estudianteId) {
  return requestRows(estudianteRepresentanteTable, {
    select: "id,estudiante_id,representante_id,tipo_relacion_id,es_principal,observaciones,deleted_at",
    estudiante_id: `eq.${estudianteId}`,
    order: "id.asc",
  });
}

async function syncCourseRelation(estudianteId, cursoId) {
  const now = new Date().toISOString();
  const allRelations = await fetchCourseRelations(estudianteId);
  const desiredCourseId = Number(cursoId);

  const activeRelations = allRelations.filter((item) => item.deleted_at == null && item.estado === "activo");
  const sameCourseRelation = allRelations.find((item) => Number(item.curso_id) === desiredCourseId);

  await Promise.all(
    activeRelations
      .filter((item) => Number(item.curso_id) !== desiredCourseId)
      .map((item) =>
        patchRow(estudianteCursoTable, item.id, {
          estado: "trasladado",
          observaciones: item.observaciones || null,
          updated_at: now,
          ...currentAuditFields(),
        })
      )
  );

  if (sameCourseRelation) {
    await patchRow(estudianteCursoTable, sameCourseRelation.id, {
      curso_id: desiredCourseId,
      estado: "activo",
      deleted_at: null,
      updated_at: now,
      ...currentAuditFields(),
    });
    return sameCourseRelation;
  }

  return dataClient.create(estudianteCursoTable, {
    estudiante_id: estudianteId,
    curso_id: desiredCourseId,
    fecha_inscripcion: now,
    estado: "activo",
    observaciones: null,
    created_at: now,
    updated_at: now,
    ...currentCreateAuditFields(),
  });
}

async function syncRepresentativeRelations(estudianteId, representatives = []) {
  const now = new Date().toISOString();
  const rows = await fetchRepresentativeRelations(estudianteId);
  const normalizedInput = normalizeRepresentativePayload(representatives);
  const desiredRows = normalizedInput.map((item, index) => ({
    representante_id: Number(item.representante_id),
    tipo_relacion_id: Number(item.tipo_relacion_id),
    es_principal: item.es_principal === true || index === 0 && normalizedInput.length === 1,
    observaciones: item.observaciones || null,
  }));

  await Promise.all(
    rows
      .filter((row) => !desiredRows.some((item) => Number(item.representante_id) === Number(row.representante_id)))
      .map((row) =>
        patchRow(estudianteRepresentanteTable, row.id, {
          deleted_at: now,
          updated_at: now,
          ...currentAuditFields(),
        })
      )
  );

  for (const item of desiredRows) {
    const existing = rows.find((row) => Number(row.representante_id) === Number(item.representante_id));
    const payload = {
      estudiante_id: estudianteId,
      representante_id: item.representante_id,
      tipo_relacion_id: item.tipo_relacion_id,
      es_principal: item.es_principal,
      observaciones: item.observaciones,
      deleted_at: null,
      updated_at: now,
      ...currentAuditFields(),
    };

    if (existing) {
      await patchRow(estudianteRepresentanteTable, existing.id, payload);
    } else {
      await dataClient.create(estudianteRepresentanteTable, {
        ...payload,
        created_at: now,
        ...currentCreateAuditFields(),
      });
    }
  }

  const persisted = await fetchRepresentativeRelations(estudianteId);
  const activePersisted = persisted.filter((item) => item.deleted_at == null);
  if (activePersisted.length !== desiredRows.length) {
    throw new Error("No se pudo guardar la relacion entre el estudiante y sus representantes.");
  }
}

export const estudiantesApi = {
  async catalogs() {
    const [cursos, representantes, tiposRelacion] = await Promise.all([
      fetchActiveCourses(),
      fetchActiveRepresentatives(),
      fetchRelationTypes(),
    ]);

    return {
      cursos: cursos.map((row) => ({
        id: row.id,
        nombre: [row.nombre, row.paralelo].filter(Boolean).join(" "),
        anio_lectivo: row.anio_lectivo || "",
      })),
      representantes: representantes.map((row) => ({
        id: row.id,
        nombre: [row.nombre, row.apellido].filter(Boolean).join(" ").trim(),
        nombre_completo: [row.apellido, row.nombre].filter(Boolean).join(" ").trim(),
        cedula: row.cedula || "",
        telefono: row.telefono || "",
        email: row.email || "",
      })),
      tiposRelacion: (Array.isArray(tiposRelacion) ? tiposRelacion : DEFAULT_RELATION_TYPES).map((row) => ({
        id: row.id,
        nombre: row.nombre,
      })),
    };
  },

  async list() {
    if (typeof dataClient.request === "function") {
      try {
        const rows = await dataClient.request(estudiantesTable, {
          params: {
            select:
              "id,codigo_institucional,nombre,apellido,cedula,fecha_nacimiento,genero,direccion,fotografia,estado,observaciones,created_at,updated_at,deleted_at,estudiante_curso(id,curso_id,fecha_inscripcion,estado,observaciones,deleted_at,cursos(id,nombre,paralelo)),estudiante_representante(id,representante_id,tipo_relacion_id,es_principal,observaciones,deleted_at,representantes(id,nombre,apellido),tipos_relacion_representante(id,nombre))",
            deleted_at: "is.null",
            order: "apellido.asc,nombre.asc",
          },
        });
        return Array.isArray(rows) ? rows.filter((row) => row?.deleted_at == null).map(normalizeStudent) : [];
      } catch {
        const [students, courseLinks, courses, representativeLinks, representatives, relationTypes] = await Promise.all([
          requestRows(estudiantesTable, {
            select: "id,codigo_institucional,nombre,apellido,cedula,fecha_nacimiento,genero,direccion,fotografia,estado,observaciones,created_at,updated_at,deleted_at",
            order: "apellido.asc,nombre.asc",
          }),
          requestRows(estudianteCursoTable, {
            select: "id,estudiante_id,curso_id,fecha_inscripcion,estado,observaciones,deleted_at",
            order: "id.asc",
          }).catch(() => []),
          requestRows(cursosTable, {
            select: "id,nombre,paralelo,anio_lectivo,estado",
            order: "nombre.asc,paralelo.asc",
          }).catch(() => []),
          requestRows(estudianteRepresentanteTable, {
            select: "id,estudiante_id,representante_id,tipo_relacion_id,es_principal,observaciones,deleted_at",
            order: "id.asc",
          }).catch(() => []),
          requestRows(representantesTable, {
            select: "id,nombre,apellido",
            order: "apellido.asc,nombre.asc",
          }).catch(() => []),
          requestRows(tiposRelacionTable, {
            select: "id,nombre",
            order: "id.asc",
          }).catch(() => DEFAULT_RELATION_TYPES),
        ]);

        return students
          .filter((student) => student?.deleted_at == null)
          .map((student) =>
            normalizeStudent({
              ...student,
              estudiante_curso: courseLinks
                .filter((item) => Number(item.estudiante_id) === Number(student.id))
                .map((item) => ({
                  ...item,
                  cursos: courses.find((course) => Number(course.id) === Number(item.curso_id)) || null,
                })),
              estudiante_representante: representativeLinks
                .filter((item) => Number(item.estudiante_id) === Number(student.id))
                .map((item) => ({
                  ...item,
                  representantes: representatives.find((rep) => Number(rep.id) === Number(item.representante_id)) || null,
                  tipos_relacion_representante:
                    relationTypes.find((type) => Number(type.id) === Number(item.tipo_relacion_id)) || null,
                })),
            })
          );
      }
    }

    const [students, courseLinks, courses, representativeLinks, representatives, relationTypes] = await Promise.all([
      requestRows(estudiantesTable, { deleted_at: "is.null", order: "apellido.asc,nombre.asc" }),
      requestRows(estudianteCursoTable, { order: "id.asc" }),
      requestRows(cursosTable, { order: "nombre.asc,paralelo.asc" }),
      requestRows(estudianteRepresentanteTable, { order: "id.asc" }),
      requestRows(representantesTable, { order: "apellido.asc,nombre.asc" }),
      requestRows(tiposRelacionTable, { order: "id.asc" }).catch(() => DEFAULT_RELATION_TYPES),
    ]);

    return students.map((student) =>
      normalizeStudent({
        ...student,
        estudiante_curso: courseLinks
          .filter((item) => Number(item.estudiante_id) === Number(student.id))
          .map((item) => ({
            ...item,
            cursos: courses.find((course) => Number(course.id) === Number(item.curso_id)) || null,
          })),
        estudiante_representante: representativeLinks
          .filter((item) => Number(item.estudiante_id) === Number(student.id))
          .map((item) => ({
            ...item,
            representantes: representatives.find((rep) => Number(rep.id) === Number(item.representante_id)) || null,
            tipos_relacion_representante:
              relationTypes.find((type) => Number(type.id) === Number(item.tipo_relacion_id)) || null,
          })),
      })
    );
  },

  async create(payload) {
    const representatives = normalizeRepresentativePayload(payload.representantes);
    const student = await dataClient.create(
      estudiantesTable,
      sanitizeStudentPayload(
        {
          ...payload,
          codigo_institucional: payload.codigo_institucional || (await generateInstitutionalCode()),
        },
        { includeCreatedBy: true }
      )
    );
    await syncCourseRelation(student.id, payload.curso_id);
    await syncRepresentativeRelations(student.id, representatives);
    const rows = await this.list();
    return rows.find((row) => Number(row.id) === Number(student.id)) || normalizeStudent(student);
  },

  async update(id, payload) {
    const representatives = normalizeRepresentativePayload(payload.representantes);
    await dataClient.update(estudiantesTable, id, sanitizeStudentPayload(payload));
    await syncCourseRelation(id, payload.curso_id);
    await syncRepresentativeRelations(id, representatives);
    const rows = await this.list();
    return rows.find((row) => Number(row.id) === Number(id)) || null;
  },

  async remove(id) {
    const now = new Date().toISOString();

    await dataClient.update(estudiantesTable, id, {
      estado: "inactivo",
      deleted_at: now,
      updated_at: now,
      ...currentAuditFields(),
    });

    const [courseRelations, representativeRelations] = await Promise.all([
      fetchCourseRelations(id),
      fetchRepresentativeRelations(id),
    ]);

    await Promise.all([
      ...courseRelations
        .filter((row) => row.deleted_at == null)
        .map((row) =>
          patchRow(estudianteCursoTable, row.id, {
            estado: "retirado",
            deleted_at: now,
            updated_at: now,
            ...currentAuditFields(),
          })
        ),
      ...representativeRelations
        .filter((row) => row.deleted_at == null)
        .map((row) =>
          patchRow(estudianteRepresentanteTable, row.id, {
            deleted_at: now,
            updated_at: now,
            ...currentAuditFields(),
          })
        ),
    ]);

    return true;
  },
};
