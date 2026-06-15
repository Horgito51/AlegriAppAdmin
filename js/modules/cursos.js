import { cursosApi } from "../api/cursosApi.js?v=20260614-5";
import { createCrudModule } from "./crud.js?v=20260614-5";

export function createCursosModule({ notify, onChange }) {
  return createCrudModule({
    rootId: "cursos-root",
    kicker: "Gestion academica",
    title: "Cursos",
    singular: "curso",
    api: cursosApi,
    notify,
    onChange,
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "paralelo", label: "Paralelo", required: true },
      { name: "nivel", label: "Nivel", required: true },
      { name: "periodo_academico", label: "Periodo academico", required: true },
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
      { key: "estado", label: "Estado" },
    ],
  });
}
