import { cursosApi } from "../api/cursosApi.js?v=20260614-7";
import { createCrudModule } from "./crud.js?v=20260614-7";

export function createCursosModule({ notify, onChange }) {
  return createCrudModule({
    rootId: "cursos-root",
    kicker: "Gestion academica",
    title: "Cursos",
    singular: "curso",
    api: cursosApi,
    notify,
    onChange,
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
