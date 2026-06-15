import { materiasApi } from "../api/materiasApi.js?v=20260614-7";
import { createCrudModule } from "./crud.js?v=20260614-7";

export function createMateriasModule({ notify, onChange }) {
  return createCrudModule({
    rootId: "materias-root",
    kicker: "Gestion academica",
    title: "Materias",
    singular: "materia",
    api: materiasApi,
    notify,
    onChange,
    async loadFieldOptions() {
      const { cursos } = await materiasApi.catalogs();
      return {
        curso_id: cursos.map((curso) => ({
          value: curso.id,
          label: `${curso.nombre} ${curso.paralelo} - ${curso.anio_lectivo}`,
        })),
      };
    },
    fields: [
      { name: "nombre", label: "Nombre", required: true },
      { name: "curso_id", label: "Curso", type: "select", valueType: "number", required: true },
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
      { key: "curso", label: "Curso" },
      { key: "descripcion", label: "Descripcion" },
      { key: "estado", label: "Estado" },
    ],
  });
}
