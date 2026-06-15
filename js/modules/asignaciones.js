import { profesoresApi } from "../api/profesoresApi.js?v=20260615-1";
import { cursosApi } from "../api/cursosApi.js?v=20260615-1";
import { materiasApi } from "../api/materiasApi.js?v=20260615-1";
import { dataClient, tables } from "../api/client.js?v=20260615-1";
import { createTableEnhancer } from "./tableEnhancer.js?v=20260615-1";

const docenteCursoTable = tables.docenteCurso;
const CACHE_KEY = "alegriapp-validation-cache:asignaciones-root";
const DRAFT_KEY = "alegriapp-form-draft:asignaciones-root";

function readStorage(storage, key, fallback) {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage support is optional; current state still validates the form.
  }
}

function removeStorage(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore cleanup failures.
  }
}

export function createAsignacionesModule({ notify, onChange }) {
  const state = {
    profesores: [],
    cursos: [],
    materias: [],
    docenteCurso: [],
    loaded: false,
    validationCache: [],
    draft: readStorage(sessionStorage, DRAFT_KEY, {}),
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

  function optionList(rows, formatter, selectedValues = []) {
    const selected = selectedValues.map(String);
    return rows
      .map((row) => `<option value="${row.id}" ${selected.includes(String(row.id)) ? "selected" : ""}>${formatter(row)}</option>`)
      .join("");
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
        <label class="field" data-field="docente_id">
          <span>Profesor</span>
          <select name="docente_id" required>
            <option value="">Seleccione un profesor</option>
            ${optionList(state.profesores, (row) => `${row.apellidos} ${row.nombres}`, [state.draft.docente_id])}
          </select>
          <small class="field-error" data-field-error="docente_id"></small>
        </label>

        <label class="field" data-field="curso_ids">
          <span>Cursos</span>
          <select name="curso_ids" multiple size="5">
            ${optionList(state.cursos, (row) => `${row.nombre} ${row.paralelo} - ${row.periodo_academico || ""}`, state.draft.curso_ids || [])}
          </select>
          <small class="field-error" data-field-error="curso_ids"></small>
        </label>

        <label class="field" data-field="materia_ids">
          <span>Materias</span>
          <select name="materia_ids" multiple size="5">
            ${optionList(state.materias, (row) => `${row.nombre} - ${row.curso}`, state.draft.materia_ids || [])}
          </select>
          <small class="field-error" data-field-error="materia_ids"></small>
        </label>

        <div class="assignment-actions">
          <button class="primary-button" type="submit">Guardar asignaciones</button>
          <p>Cursos y materias</p>
        </div>
        <div class="form-error" data-form-error hidden></div>
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

  function assignmentRows() {
    if (state.loaded) return state.docenteCurso;
    const rowsById = new Map();
    [...state.validationCache, ...state.docenteCurso].forEach((row) => {
      if (row?.id !== undefined && row?.id !== null) rowsById.set(String(row.id), row);
    });
    return Array.from(rowsById.values());
  }

  function clearValidationErrors(form) {
    form.querySelectorAll("[data-field]").forEach((field) => field.classList.remove("invalid"));
    form.querySelectorAll("[data-field-error]").forEach((error) => {
      error.textContent = "";
    });
    const formError = form.querySelector("[data-form-error]");
    if (formError) {
      formError.textContent = "";
      formError.hidden = true;
    }
  }

  function setValidationErrors(form, errors) {
    clearValidationErrors(form);
    Object.entries(errors).forEach(([fieldName, message]) => {
      if (fieldName === "_form") return;
      form.querySelector(`[data-field="${fieldName}"]`)?.classList.add("invalid");
      const fieldError = form.querySelector(`[data-field-error="${fieldName}"]`);
      if (fieldError) fieldError.textContent = message;
    });

    const formError = form.querySelector("[data-form-error]");
    if (formError && errors._form) {
      formError.textContent = errors._form;
      formError.hidden = false;
    }

    form.querySelector(".field.invalid select")?.focus();
  }

  function persistDraft(form) {
    state.draft = {
      docente_id: new FormData(form).get("docente_id") || "",
      curso_ids: selectedValues(form.elements.curso_ids),
      materia_ids: selectedValues(form.elements.materia_ids),
    };
    writeStorage(sessionStorage, DRAFT_KEY, state.draft);
  }

  function validateAssignment(docenteId, cursoIds, materiaIds) {
    const errors = {};
    const rows = assignmentRows();

    if (!docenteId) errors.docente_id = "Seleccione un profesor.";
    if (!cursoIds.length && !materiaIds.length) {
      errors._form = "Seleccione al menos un curso o una materia.";
    }

    const duplicateCursos = cursoIds.filter((cursoId) =>
      rows.some((row) => Number(row.docente_id) === docenteId && Number(row.curso_id) === cursoId && !row.materia_id)
    );
    const duplicateMaterias = materiaIds.filter((materiaId) =>
      rows.some((row) => Number(row.docente_id) === docenteId && Number(row.materia_id) === materiaId)
    );

    if (duplicateCursos.length) {
      errors.curso_ids = "Uno o mas cursos seleccionados ya estan asignados a ese profesor.";
    }
    if (duplicateMaterias.length) {
      errors.materia_ids = "Una o mas materias seleccionadas ya estan asignadas a ese profesor.";
    }

    return errors;
  }

  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const docenteId = Number(new FormData(form).get("docente_id"));
    const cursoIds = selectedValues(form.elements.curso_ids);
    const materiaIds = selectedValues(form.elements.materia_ids);
    const validationErrors = validateAssignment(docenteId, cursoIds, materiaIds);

    if (Object.keys(validationErrors).length) {
      setValidationErrors(form, validationErrors);
      setStatus("Corrige los campos marcados.", "error");
      notify("Revisa las validaciones del formulario.", "error");
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
      setValidationErrors(form, { _form: "Las asignaciones seleccionadas ya existen." });
      setStatus("Corrige los campos marcados.", "error");
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
      state.draft = {};
      removeStorage(sessionStorage, DRAFT_KEY);
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
    const form = root.querySelector("[data-form]");
    form.addEventListener("submit", save);
    form.addEventListener("input", () => {
      clearValidationErrors(form);
      persistDraft(form);
    });
    form.addEventListener("change", () => {
      clearValidationErrors(form);
      persistDraft(form);
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
      state.loaded = true;
      state.validationCache = docenteCurso;
      writeStorage(localStorage, CACHE_KEY, {
        savedAt: new Date().toISOString(),
        rows: docenteCurso,
      });
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
    state.validationCache = readStorage(localStorage, CACHE_KEY, { rows: [] }).rows || [];
    render();
    return refresh();
  }

  return {
    init,
    refresh,
    getRows: allAssignments,
  };
}
