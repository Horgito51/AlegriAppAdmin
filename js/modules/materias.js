import { materiasApi } from "../api/materiasApi.js?v=20260614-5";
import { createCrudModule } from "./crud.js?v=20260614-5";

export function createMateriasModule({ notify, onChange }) {
  return createCrudModule({
    rootId: "materias-root",
    kicker: "Gestion academica",
    title: "Materias",
    singular: "materia",
    api: materiasApi,
    notify,
    onChange,
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "codigo", label: "Codigo", required: true },
      { name: "descripcion", label: "Descripcion", type: "textarea" },
      {
        name: "estado",
        label: "Estado",
        type: "select",
        defaultValue: "activo",
        options: [
          { value: "activo", label: "Activo" },
          { value: "inactivo", label: "Inactivo" },
        ],
      },
    ],
    columns: [
      { key: "id", label: "ID" },
      { key: "nombre", label: "Nombre" },
      { key: "codigo", label: "Codigo" },
      { key: "descripcion", label: "Descripcion" },
      { key: "estado", label: "Estado" },
    ],
  });
}
