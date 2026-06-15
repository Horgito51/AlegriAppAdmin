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

  // El proyecto actual no expone sesion/autenticacion en este panel.
  // Si luego se agrega, usar este valor para created_by y updated_by.
  currentUserId: null,

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
    estudianteCurso: "estudiante_curso",
    estudianteRepresentante: "estudiante_representante",
    tiposRelacionRepresentante: "tipos_relacion_representante",
    configuracionTelegram: "configuracion_telegram",
  },
};
