window.ALEGRIAPP_CONFIG = {
  dataMode: "demo",

  supabase: {
    url: "",
    anonKey: "",
  },

  rest: {
    baseUrl: "",
  },

  // Si luego integran autenticacion real, este valor puede usarse
  // para poblar created_by y updated_by en los CRUD.
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
