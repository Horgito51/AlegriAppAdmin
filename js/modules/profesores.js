import { profesoresApi } from "../api/profesoresApi.js?v=20260615-1";
import { createCrudModule } from "./crud.js?v=20260615-1";

function sameText(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function otherRows(rows, editing) {
  return rows.filter((row) => Number(row.id) !== Number(editing?.id));
}

export function createProfesoresModule({ notify, onChange }) {
  return createCrudModule({
    rootId: "profesores-root",
    kicker: "Gestion academica",
    title: "Profesores",
    singular: "profesor",
    api: profesoresApi,
    notify,
    onChange,
    validate({ payload, cachedRows, editing }) {
      const errors = {};
      const rows = otherRows(cachedRows, editing);
      const cedula = String(payload.cedula || "");
      const telefono = String(payload.telefono || "");

      if (cedula && !/^\d{10}$/.test(cedula)) {
        errors.cedula = "La cedula debe tener 10 digitos numericos.";
      }

      if (telefono && !/^[0-9+\-\s()]{7,15}$/.test(telefono)) {
        errors.telefono = "Ingrese un telefono valido.";
      }

      if (payload.email && rows.some((row) => sameText(row.email, payload.email))) {
        errors.email = "Ya existe un profesor con ese correo.";
      }

      if (cedula && rows.some((row) => String(row.cedula || "") === cedula)) {
        errors.cedula = "Ya existe un profesor con esa cedula.";
      }

      return errors;
    },
    fields: [
      { name: "nombres", label: "Nombres", required: true },
      { name: "apellidos", label: "Apellidos", required: true },
      { name: "cedula", label: "Cedula", required: true, inputMode: "numeric", maxLength: 10 },
      { name: "email", label: "Correo", type: "email", required: true, transform: (value) => String(value || "").toLowerCase() },
      { name: "telefono", label: "Telefono", inputMode: "tel", maxLength: 15 },
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
