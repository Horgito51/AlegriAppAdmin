import { createCrudModule } from "./crud.js?v=20260614-8";
import { estudiantesApi } from "../api/estudiantesApi.js?v=20260614-8";

export function createEstudiantesModule({ notify, onChange }) {
  return createCrudModule({
    rootId: "estudiantes-root",
    kicker: "Gestion academica",
    title: "Estudiantes",
    singular: "estudiante",
    api: estudiantesApi,
    notify,
    onChange,
    fields: [
      { name: "nombre", label: "Nombres", required: true },
      { name: "apellido", label: "Apellidos", required: true },
      { name: "codigo_institucional", label: "Codigo institucional" },
      { name: "telefono", label: "Telefono" },
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
      { key: "apellido", label: "Apellidos" },
      { key: "nombre", label: "Nombres" },
      { key: "codigo_institucional", label: "Codigo" },
      { key: "telefono", label: "Telefono" },
      { key: "estado", label: "Estado" },
    ],
  });
}
