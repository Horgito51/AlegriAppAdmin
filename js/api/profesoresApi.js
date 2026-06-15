import { dataClient, tables } from "./client.js?v=20260615-1";

const usuariosTable = tables.profesores;
const rolesTable = tables.roles;
const personalTable = tables.personalAutorizado;

let docenteRoleId = null;

function normalize(row) {
  const personal = Array.isArray(row.personal_autorizado) ? row.personal_autorizado[0] : null;
  return {
    id: row.id,
    nombres: row.nombre || "",
    apellidos: row.apellido || "",
    cedula: personal?.cedula || "",
    email: row.email || "",
    telefono: row.telefono || "",
    estado: row.estado || "activo",
    rol_id: row.rol_id,
  };
}

async function getDocenteRoleId() {
  if (docenteRoleId) return docenteRoleId;
  const rows = await dataClient.request(rolesTable, {
    params: {
      select: "id,nombre",
      nombre: "in.(docente,Docente)",
      order: "id.asc",
      limit: "1",
    },
  });
  docenteRoleId = Number(rows[0]?.id || 2);
  return docenteRoleId;
}

async function findPersonal(usuarioId) {
  const rows = await dataClient.request(personalTable, {
    params: {
      select: "id,usuario_id,cedula,cargo,activo",
      usuario_id: `eq.${usuarioId}`,
      limit: "1",
    },
  });
  return rows[0] || null;
}

async function savePersonal(usuarioId, cedula) {
  const existing = await findPersonal(usuarioId);
  if (existing) {
    return dataClient.update(personalTable, existing.id, {
      cedula: cedula || null,
      cargo: "Docente",
      activo: true,
    });
  }
  if (!cedula) return null;
  return dataClient.create(personalTable, {
    usuario_id: usuarioId,
    cedula,
    cargo: "Docente",
    activo: true,
  });
}

export const profesoresApi = {
  async list() {
    const roleId = await getDocenteRoleId();
    const rows = await dataClient.request(usuariosTable, {
      params: {
        select: "id,nombre,apellido,email,telefono,rol_id,estado,deleted_at,roles(nombre),personal_autorizado(id,cedula,cargo,activo)",
        rol_id: `eq.${roleId}`,
        deleted_at: "is.null",
        order: "apellido.asc,nombre.asc",
      },
    });
    return rows.map(normalize);
  },

  async create(payload) {
    const roleId = await getDocenteRoleId();
    try {
      const [usuario] = await dataClient.request(usuariosTable, {
        method: "POST",
        body: {
          nombre: payload.nombres,
          apellido: payload.apellidos,
          email: payload.email,
          telefono: payload.telefono || null,
          rol_id: roleId,
          estado: payload.estado || "activo",
          password_hash: `panel_admin_${Date.now()}`,
        },
      });
      await savePersonal(usuario.id, payload.cedula);
      return normalize({ ...usuario, personal_autorizado: payload.cedula ? [{ cedula: payload.cedula }] : [] });
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.startsWith("Ya existe")) throw new Error(msg);
      throw new Error(
        `No fue posible crear el profesor: ${msg}. Si usas Supabase, revisa las politicas RLS o configura un endpoint REST seguro.`
      );
    }
  },

  async update(id, payload) {
    const [usuario] = await dataClient.request(usuariosTable, {
      method: "PATCH",
      params: { id: `eq.${id}` },
      body: {
        nombre: payload.nombres,
        apellido: payload.apellidos,
        email: payload.email,
        telefono: payload.telefono || null,
        estado: payload.estado || "activo",
        updated_at: new Date().toISOString(),
      },
    });
    await savePersonal(id, payload.cedula);
    return normalize({ ...usuario, personal_autorizado: payload.cedula ? [{ cedula: payload.cedula }] : [] });
  },

  async remove(id) {
    await dataClient.request(usuariosTable, {
      method: "PATCH",
      params: { id: `eq.${id}` },
      body: {
        estado: "inactivo",
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
    const personal = await findPersonal(id);
    if (personal) {
      await dataClient.update(personalTable, personal.id, { activo: false, deleted_at: new Date().toISOString() });
    }
    return true;
  },
};
