const DEFAULT_CONFIG = {
  dataMode: "demo",
  supabase: { url: "", anonKey: "" },
  rest: { baseUrl: "" },
  tables: {
    profesores: "usuarios",
    roles: "roles",
    personalAutorizado: "personal_autorizado",
    cursos: "cursos",
    materias: "materias",
    docenteCurso: "docente_curso",
    nivelesAcademicos: "niveles_academicos",
    periodosAcademicos: "periodos_academicos",
  },
};

const STORAGE_KEY = "alegriapp-admin-demo-v1";

const seed = {
  docentes: [
    {
      id: 1,
      nombres: "Luis Alberto",
      apellidos: "Molina",
      cedula: "0102030405",
      email: "jorge.molina@colegio.edu.ec",
      telefono: "0991112222",
      estado: "activo",
    },
    {
      id: 2,
      nombres: "Carla Sofia",
      apellidos: "Andrade",
      cedula: "1712345678",
      email: "carla.andrade@colegio.edu.ec",
      telefono: "0983334444",
      estado: "activo",
    },
  ],
  cursos: [
    {
      id: 1,
      nombre: "Octavo",
      paralelo: "A",
      nivel: "Educacion Basica Superior",
      periodo_academico: "2026-2027",
      estado: "activo",
    },
    {
      id: 2,
      nombre: "Primero Bachillerato",
      paralelo: "B",
      nivel: "Bachillerato",
      periodo_academico: "2026-2027",
      estado: "activo",
    },
  ],
  materias: [
    {
      id: 1,
      nombre: "Matematica",
      descripcion: "Numeros, algebra y resolucion de problemas.",
      estado: "activo",
    },
    {
      id: 2,
      nombre: "Emprendimiento",
      descripcion: "Ideas de negocio, validacion y prototipos.",
      estado: "activo",
    },
    {
      id: 3,
      nombre: "Lengua y Literatura",
      descripcion: "Lectura critica y expresion escrita.",
      estado: "activo",
    },
  ],
  docente_curso: [{ id: 1, docente_id: 1, curso_id: 1 }],
};

export const config = {
  ...DEFAULT_CONFIG,
  ...(window.ALEGRIAPP_CONFIG || {}),
  supabase: {
    ...DEFAULT_CONFIG.supabase,
    ...((window.ALEGRIAPP_CONFIG || {}).supabase || {}),
  },
  rest: {
    ...DEFAULT_CONFIG.rest,
    ...((window.ALEGRIAPP_CONFIG || {}).rest || {}),
  },
  tables: {
    ...DEFAULT_CONFIG.tables,
    ...((window.ALEGRIAPP_CONFIG || {}).tables || {}),
  },
};

export const tables = config.tables;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureStore() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return clone(seed);
  }

  const parsed = JSON.parse(stored);
  const merged = { ...clone(seed), ...parsed };
  Object.keys(seed).forEach((table) => {
    if (!Array.isArray(merged[table])) merged[table] = clone(seed[table]);
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function nextId(rows) {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
}

function sortRows(rows, order = []) {
  return [...rows].sort((a, b) => {
    for (const key of order) {
      const av = String(a[key] ?? "").toLowerCase();
      const bv = String(b[key] ?? "").toLowerCase();
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

function buildDemoClient() {
  return {
    modeLabel: "Demo localStorage",
    async list(table, options = {}) {
      const store = ensureStore();
      return sortRows(store[table] || [], options.order);
    },
    async create(table, payload) {
      const store = ensureStore();
      const rows = store[table] || [];
      const now = new Date().toISOString();
      const record = { id: nextId(rows), ...payload, created_at: now, updated_at: now };
      rows.push(record);
      store[table] = rows;
      saveStore(store);
      return record;
    },
    async update(table, id, payload) {
      const store = ensureStore();
      const rows = store[table] || [];
      const index = rows.findIndex((row) => Number(row.id) === Number(id));
      if (index < 0) throw new Error("Registro no encontrado.");
      rows[index] = { ...rows[index], ...payload, updated_at: new Date().toISOString() };
      store[table] = rows;
      saveStore(store);
      return rows[index];
    },
    async remove(table, id) {
      const store = ensureStore();
      store[table] = (store[table] || []).filter((row) => Number(row.id) !== Number(id));
      saveStore(store);
      return true;
    },
    async resetDemo() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return true;
    },
  };
}

function normalizeSupabaseUrl(url) {
  const clean = url.replace(/\/$/, "");
  return clean.endsWith("/rest/v1") ? clean : `${clean}/rest/v1`;
}

async function parseResponse(response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatApiError(text, response.statusText));
  }
  if (response.status === 204) return [];
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

function formatApiError(text, fallback) {
  if (!text) return fallback || "No se pudo completar la operacion.";

  try {
    const error = JSON.parse(text);
    const details = `${error.message || ""} ${error.details || ""}`.toLowerCase();

    if (error.code === "23505") {
      if (details.includes("email")) return "Ya existe un registro con ese correo.";
      if (details.includes("cedula")) return "Ya existe un registro con esa cedula.";
      return "Ya existe un registro con esos datos.";
    }

    if (error.code === "23503") return "El registro esta relacionado con otros datos y no se puede guardar asi.";
    if (error.code === "42501") return "No tienes permisos para realizar esta accion.";

    return error.message || fallback || "No se pudo completar la operacion.";
  } catch {
    return text || fallback || "No se pudo completar la operacion.";
  }
}

function buildSupabaseClient() {
  const baseUrl = normalizeSupabaseUrl(config.supabase.url);
  const headers = {
    apikey: config.supabase.anonKey,
    Authorization: `Bearer ${config.supabase.anonKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  async function request(table, options = {}) {
    const params = new URLSearchParams(options.params || {});
    const query = params.toString();
    const response = await fetch(`${baseUrl}/${table}${query ? `?${query}` : ""}`, {
      method: options.method || "GET",
      headers: { ...headers, ...(options.headers || {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return parseResponse(response);
  }

  return {
    modeLabel: "Supabase REST",
    request,
    async list(table, options = {}) {
      const params = new URLSearchParams({ select: "*" });
      if (options.order?.length) params.set("order", options.order.join(".asc,") + ".asc");
      return request(table, { params });
    },
    async create(table, payload) {
      const rows = await request(table, {
        method: "POST",
        body: payload,
      });
      return Array.isArray(rows) ? rows[0] : rows;
    },
    async update(table, id, payload) {
      const rows = await request(table, {
        method: "PATCH",
        params: { id: `eq.${id}` },
        body: { ...payload, updated_at: new Date().toISOString() },
      });
      return Array.isArray(rows) ? rows[0] : rows;
    },
    async remove(table, id) {
      const response = await fetch(`${baseUrl}/${table}?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers,
      });
      await parseResponse(response);
      return true;
    },
  };
}

function buildRestClient() {
  const baseUrl = config.rest.baseUrl.replace(/\/$/, "");

  return {
    modeLabel: "API REST",
    async list(table) {
      return parseResponse(await fetch(`${baseUrl}/${table}`));
    },
    async create(table, payload) {
      return parseResponse(
        await fetch(`${baseUrl}/${table}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
    },
    async update(table, id, payload) {
      return parseResponse(
        await fetch(`${baseUrl}/${table}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
    },
    async remove(table, id) {
      await parseResponse(await fetch(`${baseUrl}/${table}/${id}`, { method: "DELETE" }));
      return true;
    },
  };
}

function hasSupabaseConfig() {
  return Boolean(config.supabase.url && config.supabase.anonKey);
}

function hasRestConfig() {
  return Boolean(config.rest.baseUrl);
}

export const dataClient =
  config.dataMode === "supabase" && hasSupabaseConfig()
    ? buildSupabaseClient()
    : config.dataMode === "rest" && hasRestConfig()
      ? buildRestClient()
      : buildDemoClient();
