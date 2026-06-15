import { profesoresApi } from "../api/profesoresApi.js?v=20260614-7";
import { createCrudModule } from "./crud.js?v=20260614-7";

export function createProfesoresModule({ notify, onChange }) {
  return createCrudModule({
    rootId: "profesores-root",
    kicker: "Gestion academica",
    title: "Profesores",
    singular: "profesor",
    api: profesoresApi,
    notify,
    onChange,
    fields: [
      { name: "nombres", label: "Nombres", required: true },
      { name: "apellidos", label: "Apellidos", required: true },
      { name: "cedula", label: "Cedula", required: true },
      { name: "email", label: "Correo", type: "email", required: true },
      { name: "telefono", label: "Telefono" },
      {
        name: "estado",
        label: "Estado",
        type: "select",
        defaultValue: "activo",
        options: [
          { value: "activo", label: "Activo" },
          { value: "inactivo", label: "Inactivo" },
          { value: "suspendido", label: "Suspendido" },
        ],
      },
    ],
    columns: [
      { key: "id", label: "ID" },
      { key: "apellidos", label: "Apellidos" },
      { key: "nombres", label: "Nombres" },
      { key: "cedula", label: "Cedula" },
      { key: "email", label: "Correo" },
      { key: "telefono", label: "Telefono" },
      { key: "estado", label: "Estado" },
    ],
  });
}
