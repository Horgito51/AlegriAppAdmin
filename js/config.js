window.ALEGRIAPP_CONFIG = {
  dataMode: "supabase",

  supabase: {
    url: "https://nqtobrslyrfwcuexffdu.supabase.co",
    anonKey: "sb_publishable_U9D3f7hGVUvU1PbG7auJMA_lMZUPoSh",
  },

  rest: {
    // Para desarrollo local apunta al servidor Node del webhook (ver server/.env.example)
    baseUrl: "http://localhost:3000",
  },

  tables: {
    profesores: "usuarios",
    roles: "roles",
    personalAutorizado: "personal_autorizado",
    cursos: "cursos",
    materias: "materias",
    docenteCurso: "docente_curso",
    nivelesAcademicos: "niveles_academicos",
    periodosAcademicos: "periodos_academicos",
    representantes: "representantes",
    estudiantes: "estudiantes",
    estudianteRepresentante: "estudiante_representante",
    configuracionTelegram: "configuracion_telegram",
  },
};
