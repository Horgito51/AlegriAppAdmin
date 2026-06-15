import { cursosApi } from "../api/cursosApi.js?v=20260615-1";
import { createCrudModule } from "./crud.js?v=20260615-1";

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

export function createCursosModule({ notify, onChange }) {
  return createCrudModule({
    rootId: "cursos-root",
    kicker: "Gestion academica",
    title: "Cursos",
    singular: "curso",
    api: cursosApi,
    notify,
    onChange,
    validate({ payload, cachedRows, editing }) {
      const errors = {};
      const anio = String(payload.anio_lectivo || "");
      const duplicate = cachedRows.some(
        (row) =>
          Number(row.id) !== Number(editing?.id) &&
          normalized(row.nombre) === normalized(payload.nombre) &&
          normalized(row.paralelo) === normalized(payload.paralelo) &&
          normalized(row.anio_lectivo) === normalized(payload.anio_lectivo)
      );

      if (anio && !/^\d{4}(-\d{4})?$/.test(anio)) {
        errors.anio_lectivo = "Use un anio como 2026 o un periodo como 2026-2027.";
      }

      if (duplicate) {
        errors._form = "Ya existe un curso con el mismo nombre, paralelo y anio lectivo.";
      }

      return errors;
    },
    async loadFieldOptions() {
      const { niveles, periodos } = await cursosApi.catalogs();
      return {
        nivel_academico_id: niveles.map((nivel) => ({ value: nivel.id, label: nivel.nombre })),
        periodo_academico_id: [
          { value: "", label: "Sin periodo" },
          ...periodos.map((periodo) => ({
            value: periodo.id,
            label: `${periodo.nombre} ${periodo.anio_lectivo}${periodo.activo ? " (activo)" : ""}`,
          })),
        ],
      };
    },
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "paralelo", label: "Paralelo", required: true },
      { name: "nivel_academico_id", label: "Nivel", type: "select", valueType: "number", required: true },
      { name: "periodo_academico_id", label: "Periodo academico", type: "select", valueType: "number" },
      { name: "anio_lectivo", label: "Anio lectivo", required: true },
      {
        name: "estado",
        label: "Estado",
        type: "select",
        defaultValue: "activo",
        options: [
          { value: "activo", label: "Activo" },
          { value: "inactivo", label: "Inactivo" },
          { value: "cerrado", label: "Cerrado" },
        ],
      },
    ],
    columns: [
      { key: "id", label: "ID" },
      { key: "nombre", label: "Nombre" },
      { key: "paralelo", label: "Paralelo" },
      { key: "nivel", label: "Nivel" },
      { key: "periodo_academico", label: "Periodo" },
      { key: "anio_lectivo", label: "Anio" },
      { key: "estado", label: "Estado" },
    ],
  });
}
