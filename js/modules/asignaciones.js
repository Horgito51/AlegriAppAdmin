import { profesoresApi } from "../api/profesoresApi.js";
import { cursosApi } from "../api/cursosApi.js";
import { materiasApi } from "../api/materiasApi.js";
import { dataClient, tables } from "../api/client.js";

const docenteCursoTable = tables.docenteCurso;
const docenteMateriaTable = tables.docenteMateria;

export function createAsignacionesModule({ notify, onChange }) {
  const state = {
    profesores: [],
    cursos: [],
    materias: [],
    docenteCurso: [],
    docenteMateria: [],
    query: "",
  };

  const root = document.getElementById("asignaciones-root");

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
    return materia ? `${materia.nombre} (${materia.codigo})` : `Materia #${id}`;
  }

  function allAssignments() {
    const cursos = state.docenteCurso.map((row) => ({
      id: row.id,
      table: docenteCursoTable,
      tipo: "Curso",
      profesor: labelProfesor(row.docente_id),
      detalle: labelCurso(row.curso_id),
    }));

    const materias = state.docenteMateria.map((row) => ({
      id: row.id,
      table: docenteMateriaTable,
      tipo: "Materia",
      profesor: labelProfesor(row.docente_id),
      detalle: labelMateria(row.materia_id),
    }));

    return [...cursos, ...materias];
  }

  function filteredAssignments() {
    const query = state.query.trim().toLowerCase();
    const rows = allAssignments();
    if (!query) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query));
  }

  function optionList(rows, formatter) {
    return rows.map((row) => `<option value="${row.id}">${formatter(row)}</option>`).join("");
  }

  function render() {
    root.innerHTML = `
      <div class="module-header">
        <div>
          <p class="eyebrow">Modulo Jorge</p>
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
            ${optionList(state.materias, (row) => `${row.nombre} (${row.codigo})`)}
          </select>
        </label>

        <div class="assignment-actions">
          <button class="primary-button" type="submit">Guardar asignaciones</button>
          <p>Puede seleccionar varios cursos y varias materias a la vez.</p>
        </div>
      </form>

      <div class="table-tools">
        <label class="search-box">
          <span>Buscar</span>
          <input data-search type="search" placeholder="Buscar profesor, curso o materia" value="${state.query}" />
        </label>
      </div>

      <div class="table-wrap">
        <table>
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
    const rows = filteredAssignments();
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
        .join("") || '<tr><td colspan="4" class="empty-row">No hay asignaciones registradas.</td></tr>';

    root.querySelector("[data-count]").textContent = `${rows.length} registro(s)`;
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
      state.docenteCurso.some((row) => Number(row.docente_id) === docenteId && Number(row.curso_id) === cursoId)
    );
    const duplicateMaterias = materiaIds.filter((materiaId) =>
      state.docenteMateria.some((row) => Number(row.docente_id) === docenteId && Number(row.materia_id) === materiaId)
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
        ...newCursoIds.map((cursoId) => dataClient.create(docenteCursoTable, { docente_id: docenteId, curso_id: cursoId })),
        ...newMateriaIds.map((materiaId) => dataClient.create(docenteMateriaTable, { docente_id: docenteId, materia_id: materiaId })),
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
      await dataClient.remove(table, id);
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
    root.querySelector("[data-search]").addEventListener("input", (event) => {
      state.query = event.target.value;
      renderTable();
    });
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
      const [profesores, cursos, materias, docenteCurso, docenteMateria] = await Promise.all([
        profesoresApi.list(),
        cursosApi.list(),
        materiasApi.list(),
        dataClient.list(docenteCursoTable),
        dataClient.list(docenteMateriaTable),
      ]);
      state.profesores = profesores;
      state.cursos = cursos;
      state.materias = materias;
      state.docenteCurso = docenteCurso;
      state.docenteMateria = docenteMateria;
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
