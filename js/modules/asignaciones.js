import { profesoresApi } from "../api/profesoresApi.js?v=20260614-8";
import { cursosApi } from "../api/cursosApi.js?v=20260614-8";
import { materiasApi } from "../api/materiasApi.js?v=20260614-8";
import { dataClient, tables } from "../api/client.js?v=20260614-8";
import { createTableEnhancer } from "./tableEnhancer.js?v=20260614-8";

const docenteCursoTable = tables.docenteCurso;

export function createAsignacionesModule({ notify, onChange }) {
  const state = {
    profesores: [],
    cursos: [],
    materias: [],
    docenteCurso: [],
  };

  const root = document.getElementById("asignaciones-root");
  const tableEnhancer = createTableEnhancer();

  function labelProfesor(id) {
    const profesor = state.profesores.find((item) => Number(item.id) === Number(id));
    return profesor ? `${profesor.apellidos} ${profesor.nombres}` : `Profesor #${id}`;
  }

  function labelCurso(id) {
    const curso = state.cursos.find((item) => Number(item.id) === Number(id));
    return curso ? `${curso.nombre} ${curso.paralelo}` : `Curso #${id}`;
  }

  function labelMateria(id) {
    const materia = state.materias.find((item) => Number(item.id) === Number(id));
    return materia ? `${materia.nombre} - ${materia.curso}` : `Materia #${id}`;
  }

  function allAssignments() {
    return state.docenteCurso.map((row) => ({
      id: row.id,
      table: docenteCursoTable,
      tipo: row.materia_id ? "Materia" : "Curso",
      profesor: labelProfesor(row.docente_id),
      detalle: row.materia_id ? labelMateria(row.materia_id) : labelCurso(row.curso_id),
    }));
  }

  function optionList(rows, formatter) {
    return rows.map((row) => `<option value="${row.id}">${formatter(row)}</option>`).join("");
  }

  function render() {
    tableEnhancer.destroy();
    root.innerHTML = `
      <div class="module-header">
        <div>
          <p class="eyebrow">Gestion academica</p>
          <h2>Asignaciones</h2>
          <span data-status class="status-text">Listo</span>
        </div>
        <button class="secondary-button" data-action="refresh">Actualizar</button>
      </div>

      <form class="assignment-panel" data-form>
        <label class="field">
          <span>Profesor</span>
          <select name="docente_id" required>
            <option value="">Seleccione un profesor</option>
            ${optionList(state.profesores, (row) => `${row.apellidos} ${row.nombres}`)}
          </select>
        </label>

        <label class="field">
          <span>Cursos</span>
          <select name="curso_ids" multiple size="5">
            ${optionList(state.cursos, (row) => `${row.nombre} ${row.paralelo} - ${row.periodo_academico || ""}`)}
          </select>
        </label>

        <label class="field">
          <span>Materias</span>
          <select name="materia_ids" multiple size="5">
            ${optionList(state.materias, (row) => `${row.nombre} - ${row.curso}`)}
          </select>
        </label>

        <div class="assignment-actions">
          <button class="primary-button" type="submit">Guardar asignaciones</button>
          <p>Cursos y materias</p>
        </div>
      </form>

      <div class="table-tools">
        <span class="table-hint">Registros</span>
      </div>

      <div class="table-wrap">
        <table class="table table-hover align-middle mb-0" data-enhanced-table>
          <thead>
            <tr>
              <th>Profesor</th>
              <th>Tipo</th>
              <th>Asignado a</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody data-table-body></tbody>
        </table>
      </div>
      <p class="table-count" data-count>0 registro(s)</p>
    `;

    bindEvents();
    renderTable();
  }

  function renderTable() {
    tableEnhancer.destroy();
    const rows = allAssignments();
    root.querySelector("[data-table-body]").innerHTML =
      rows
        .map(
          (row) => `
            <tr>
              <td>${row.profesor}</td>
              <td><span class="tag">${row.tipo}</span></td>
              <td>${row.detalle}</td>
              <td class="row-actions">
                <button class="icon-button danger" data-action="delete" data-table="${row.table}" data-id="${row.id}">Eliminar</button>
              </td>
            </tr>`
        )
        .join("");

    root.querySelector("[data-count]").textContent = `${rows.length} registro(s)`;
    tableEnhancer.mount(root.querySelector("[data-enhanced-table]"));
  }

  function setStatus(message, type = "neutral") {
    const status = root.querySelector("[data-status]");
    status.textContent = message;
    status.dataset.type = type;
  }

  function selectedValues(select) {
    return Array.from(select.selectedOptions).map((option) => Number(option.value));
  }

  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const docenteId = Number(new FormData(form).get("docente_id"));
    const cursoIds = selectedValues(form.elements.curso_ids);
    const materiaIds = selectedValues(form.elements.materia_ids);

    if (!docenteId) {
      notify("Seleccione un profesor.", "error");
      return;
    }
    if (!cursoIds.length && !materiaIds.length) {
      notify("Seleccione al menos un curso o una materia.", "error");
      return;
    }

    const duplicateCursos = cursoIds.filter((cursoId) =>
      state.docenteCurso.some(
        (row) => Number(row.docente_id) === docenteId && Number(row.curso_id) === cursoId && !row.materia_id
      )
    );
    const duplicateMaterias = materiaIds.filter((materiaId) =>
      state.docenteCurso.some((row) => Number(row.docente_id) === docenteId && Number(row.materia_id) === materiaId)
    );

    const newCursoIds = cursoIds.filter((cursoId) => !duplicateCursos.includes(cursoId));
    const newMateriaIds = materiaIds.filter((materiaId) => !duplicateMaterias.includes(materiaId));

    if (!newCursoIds.length && !newMateriaIds.length) {
      notify("Las asignaciones seleccionadas ya existen.", "error");
      return;
    }

    try {
      setStatus("Guardando...", "loading");
      await Promise.all([
        ...newCursoIds.map((cursoId) =>
          dataClient.create(docenteCursoTable, { docente_id: docenteId, curso_id: cursoId, materia_id: null, estado: "activo" })
        ),
        ...newMateriaIds.map((materiaId) => {
          const materia = state.materias.find((item) => Number(item.id) === Number(materiaId));
          return dataClient.create(docenteCursoTable, {
            docente_id: docenteId,
            curso_id: Number(materia?.curso_id),
            materia_id: materiaId,
            estado: "activo",
          });
        }),
      ]);
      notify("Asignaciones guardadas.", "success");
      form.reset();
      await refresh();
      onChange?.();
    } catch (error) {
      setStatus(error.message, "error");
      notify(error.message, "error");
    }
  }

  async function remove(table, id) {
    if (!confirm("Eliminar esta asignacion?")) return;
    try {
      setStatus("Eliminando...", "loading");
      await dataClient.request(table, {
        method: "PATCH",
        params: { id: `eq.${id}` },
        body: {
          estado: "inactivo",
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
      notify("Asignacion eliminada.", "success");
      await refresh();
      onChange?.();
    } catch (error) {
      setStatus(error.message, "error");
      notify(error.message, "error");
    }
  }

  function bindEvents() {
    root.querySelector("[data-form]").addEventListener("submit", save);
    root.onclick = (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      if (button.dataset.action === "refresh") refresh();
      if (button.dataset.action === "delete") remove(button.dataset.table, button.dataset.id);
    };
  }

  async function refresh() {
    try {
      setStatus("Cargando...", "loading");
      const [profesores, cursos, materias, docenteCurso] = await Promise.all([
        profesoresApi.list(),
        cursosApi.list(),
        materiasApi.list(),
        dataClient.request(docenteCursoTable, {
          params: {
            select: "id,docente_id,curso_id,materia_id,estado,deleted_at",
            deleted_at: "is.null",
            estado: "eq.activo",
            order: "id.desc",
          },
        }),
      ]);
      state.profesores = profesores;
      state.cursos = cursos;
      state.materias = materias;
      state.docenteCurso = docenteCurso;
      render();
      setStatus("Datos actualizados", "success");
      return allAssignments();
    } catch (error) {
      setStatus(error.message, "error");
      notify(error.message, "error");
      return [];
    }
  }

  function init() {
    render();
    return refresh();
  }

  return {
    init,
    refresh,
    getRows: allAssignments,
  };
}
