import { createTableEnhancer } from "./tableEnhancer.js?v=20260615-3";
import { estudiantesApi } from "../api/estudiantesApi.js?v=20260615-3";

const CACHE_KEY = "alegriapp-validation-cache:estudiantes-root";
const DRAFT_KEY = "alegriapp-form-draft:estudiantes-root";
const VALID_PHONE_PATTERN = /^[0-9+\-\s()]{7,20}$/;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

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
    // Storage support is optional.
  }
}

function removeStorage(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore cleanup failures.
  }
}

function fullName(row) {
  return [row.nombre, row.apellido].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function normalizeRepresentativeDraftList(source) {
  if (!Array.isArray(source)) return [];

  return source
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const representanteId = Number(item.representante_id ?? item.id ?? 0);
      const tipoRelacionId = Number(item.tipo_relacion_id ?? 0);
      if (!representanteId) return null;

      return {
        representante_id: representanteId,
        tipo_relacion_id: tipoRelacionId,
        es_principal: item.es_principal === true,
        observaciones: String(item.observaciones || ""),
      };
    })
    .filter(Boolean);
}

function openDialog(dialog) {
  if (!dialog) return;
  try {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  } catch {
    dialog.setAttribute("open", "");
  }
}

export function createEstudiantesModule({ notify, onChange }) {
  const root = document.getElementById("estudiantes-root");
  const tableEnhancer = createTableEnhancer();
  const state = {
    rows: [],
    catalogs: {
      cursos: [],
      representantes: [],
      tiposRelacion: [],
    },
    filters: {
      search: "",
      estado: "todos",
    },
    editing: null,
    draft: {},
    validationCache: [],
    representativeSearch: "",
  };

  function relationTypeOptions(selectedValue) {
    return (Array.isArray(state.catalogs.tiposRelacion) ? state.catalogs.tiposRelacion : [])
      .map(
        (item) =>
          `<option value="${item.id}" ${String(item.id) === String(selectedValue) ? "selected" : ""}>${escapeHtml(item.nombre)}</option>`
      )
      .join("");
  }

  function currentRepresentativeDraft() {
    const source = state.draft?.representantes ?? state.editing?.representantes ?? [];
    return normalizeRepresentativeDraftList(source);
  }

  function representativePickerOptions() {
    const selectedIds = new Set(currentRepresentativeDraft().map((item) => String(item.representante_id)));
    const search = normalizeLower(state.representativeSearch);

    return (Array.isArray(state.catalogs.representantes) ? state.catalogs.representantes : [])
      .filter((rep) => !selectedIds.has(String(rep.id)))
      .filter((rep) => {
        if (!search) return true;
        return [rep.nombre, rep.nombre_completo, rep.cedula, rep.telefono, rep.email].some((value) =>
          String(value || "").toLowerCase().includes(search)
        );
      });
  }

  function selectedRepresentativesMarkup() {
    const selected = currentRepresentativeDraft();
    if (!selected.length) {
      return `<p class="muted-block">Aun no has agregado representantes para este estudiante.</p>`;
    }

    return selected
      .map((item) => {
        const rep = state.catalogs.representantes.find((row) => Number(row.id) === Number(item.representante_id));
        const relationId = item.tipo_relacion_id || state.catalogs.tiposRelacion[0]?.id || "";
        return `
          <article class="selected-relation-row" data-selected-rep="${item.representante_id}">
            <div class="selected-relation-summary">
              <strong>${escapeHtml(rep?.nombre || `Representante #${item.representante_id}`)}</strong>
              <span>${escapeHtml(rep?.cedula || rep?.telefono || rep?.email || "Sin dato adicional")}</span>
            </div>

            <label class="field compact-field">
              <span>Relacion</span>
              <select data-relation-type="${item.representante_id}">
                ${relationTypeOptions(relationId)}
              </select>
            </label>

            <label class="field compact-field">
              <span>Principal</span>
              <button type="button" class="secondary-button relation-main-button ${item.es_principal ? "is-primary" : ""}" data-action="make-primary" data-representante-id="${item.representante_id}">
                ${item.es_principal ? "Principal" : "Marcar principal"}
              </button>
            </label>

            <label class="field compact-field relation-note">
              <span>Observaciones</span>
              <input type="text" value="${escapeHtml(item.observaciones || "")}" data-relation-note="${item.representante_id}" />
            </label>

            <div class="selected-relation-actions">
              <button type="button" class="icon-button danger" data-action="remove-representative" data-representante-id="${item.representante_id}">Quitar</button>
            </div>
          </article>`;
      })
      .join("");
  }

  function renderShell() {
    tableEnhancer.destroy();
    const courseOptions = (Array.isArray(state.catalogs.cursos) ? state.catalogs.cursos : [])
      .map((curso) => {
        const value =
          state.editing?.curso_id ??
          state.draft?.curso_id ??
          "";
        return `<option value="${curso.id}" ${String(curso.id) === String(value) ? "selected" : ""}>${escapeHtml(`${curso.nombre}${curso.anio_lectivo ? ` - ${curso.anio_lectivo}` : ""}`)}</option>`;
      })
      .join("");

    const values = state.editing || state.draft || {};
    const availableRepresentatives = representativePickerOptions();

    root.innerHTML = `
      <div class="module-header">
        <div>
          <p class="eyebrow">Gestion academica</p>
          <h2>Estudiantes</h2>
          <span data-status class="status-text">Listo</span>
        </div>
        <button class="primary-button" data-action="open-create">Crear estudiante</button>
      </div>

      <div class="table-tools table-tools-filters">
        <label class="field compact-field">
          <span>Buscar</span>
          <input type="search" data-filter-search placeholder="Nombre, apellido, codigo, cedula o curso" value="${escapeHtml(state.filters.search)}" />
        </label>

        <label class="field compact-field">
          <span>Estado</span>
          <select data-filter-estado>
            <option value="todos" ${state.filters.estado === "todos" ? "selected" : ""}>Todos</option>
            <option value="activo" ${state.filters.estado === "activo" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${state.filters.estado === "inactivo" ? "selected" : ""}>Inactivo</option>
            <option value="retirado" ${state.filters.estado === "retirado" ? "selected" : ""}>Retirado</option>
            <option value="graduado" ${state.filters.estado === "graduado" ? "selected" : ""}>Graduado</option>
          </select>
        </label>

        <div class="table-tools-actions">
          <span class="table-hint">Registros</span>
          <button class="secondary-button" data-action="refresh">Actualizar</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table table-hover align-middle mb-0" data-enhanced-table>
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Nombre completo</th>
              <th>Cedula</th>
              <th>Curso</th>
              <th>Representante principal</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody data-table-body></tbody>
        </table>
      </div>
      <p class="table-count" data-count>0 registro(s)</p>

      <dialog class="admin-dialog admin-dialog-wide" data-modal>
        <form method="dialog" data-form novalidate>
          <div class="dialog-header">
            <div>
              <p class="eyebrow">Estudiante</p>
              <h3 data-form-title>${state.editing ? "Editar estudiante" : "Nuevo estudiante"}</h3>
            </div>
            <button type="button" class="close-button" data-action="close">Cerrar</button>
          </div>

          <div class="form-grid">
            <label class="field" data-field="curso_id">
              <span>Curso</span>
              <select name="curso_id" required>
                <option value="">Seleccione un curso</option>
                ${courseOptions}
              </select>
              <small class="field-error" data-field-error="curso_id"></small>
            </label>

            <label class="field" data-field="nombre">
              <span>Nombres</span>
              <input name="nombre" value="${escapeHtml(values.nombre || "")}" required />
              <small class="field-error" data-field-error="nombre"></small>
            </label>

            <label class="field" data-field="apellido">
              <span>Apellidos</span>
              <input name="apellido" value="${escapeHtml(values.apellido || "")}" required />
              <small class="field-error" data-field-error="apellido"></small>
            </label>

            <label class="field" data-field="cedula">
              <span>Cedula</span>
              <input name="cedula" inputmode="numeric" maxlength="20" value="${escapeHtml(values.cedula || "")}" />
              <small class="field-error" data-field-error="cedula"></small>
            </label>

            <label class="field" data-field="fecha_nacimiento">
              <span>Fecha de nacimiento</span>
              <input name="fecha_nacimiento" type="date" value="${escapeHtml(values.fecha_nacimiento || "")}" />
              <small class="field-error" data-field-error="fecha_nacimiento"></small>
            </label>

            <label class="field" data-field="genero">
              <span>Genero</span>
              <select name="genero">
                <option value="">Seleccione</option>
                <option value="M" ${values.genero === "M" ? "selected" : ""}>M</option>
                <option value="F" ${values.genero === "F" ? "selected" : ""}>F</option>
                <option value="otro" ${values.genero === "otro" ? "selected" : ""}>Otro</option>
              </select>
              <small class="field-error" data-field-error="genero"></small>
            </label>

            <label class="field" data-field="fotografia">
              <span>Fotografia</span>
              <input name="fotografia" value="${escapeHtml(values.fotografia || "")}" />
              <small class="field-error" data-field-error="fotografia"></small>
            </label>

            <label class="field" data-field="estado">
              <span>Estado</span>
              <select name="estado" required>
                <option value="activo" ${!values.estado || values.estado === "activo" ? "selected" : ""}>Activo</option>
                <option value="inactivo" ${values.estado === "inactivo" ? "selected" : ""}>Inactivo</option>
                <option value="retirado" ${values.estado === "retirado" ? "selected" : ""}>Retirado</option>
                <option value="graduado" ${values.estado === "graduado" ? "selected" : ""}>Graduado</option>
              </select>
              <small class="field-error" data-field-error="estado"></small>
            </label>

            <label class="field" data-field="direccion">
              <span>Direccion</span>
              <textarea name="direccion" rows="3">${escapeHtml(values.direccion || "")}</textarea>
              <small class="field-error" data-field-error="direccion"></small>
            </label>

            <label class="field" data-field="observaciones">
              <span>Observaciones</span>
              <textarea name="observaciones" rows="3">${escapeHtml(values.observaciones || "")}</textarea>
              <small class="field-error" data-field-error="observaciones"></small>
            </label>
          </div>

          <section class="relation-section" data-field="representantes">
            <div class="relation-section-header">
              <div>
                <p class="eyebrow">Relacion</p>
                <h3>Representantes</h3>
              </div>
              <span class="table-hint">Agrega solo los necesarios y marca uno como principal</span>
            </div>

            <div class="relation-toolbar">
              <label class="field compact-field">
                <span>Buscar representante</span>
                <input type="search" data-representative-search placeholder="Nombre, cedula, telefono o correo" value="${escapeHtml(state.representativeSearch)}" />
              </label>

              <label class="field compact-field">
                <span>Resultado</span>
                <select data-representative-picker>
                  <option value="">Seleccione un representante</option>
                  ${availableRepresentatives
                    .map(
                      (rep) =>
                        `<option value="${rep.id}">${escapeHtml(`${rep.nombre_completo || rep.nombre}${rep.cedula ? ` - ${rep.cedula}` : ""}`)}</option>`
                    )
                    .join("")}
                </select>
              </label>

              <div class="relation-toolbar-action">
                <button type="button" class="primary-button" data-action="add-representative">Agregar representante</button>
              </div>
            </div>

            <div class="selected-relations-list">
              ${selectedRepresentativesMarkup()}
            </div>
            <small class="field-error" data-field-error="representantes"></small>
          </section>

          <div class="form-error" data-form-error hidden></div>
          <div class="dialog-actions">
            <button type="button" class="secondary-button" data-action="close">Cancelar</button>
            <button type="submit" class="primary-button">Guardar</button>
          </div>
        </form>
      </dialog>
    `;
  }

  function setStatus(message, type = "neutral") {
    const status = root.querySelector("[data-status]");
    if (!status) return;
    status.textContent = message;
    status.dataset.type = type;
  }

  function filteredRows() {
    const search = normalizeLower(state.filters.search);
    return state.rows.filter((row) => {
      if (state.filters.estado !== "todos" && row.estado !== state.filters.estado) return false;
      if (!search) return true;

      const haystack = [
        row.codigo_institucional,
        row.nombre,
        row.apellido,
        row.cedula,
        row.curso,
        row.representante_principal,
      ]
        .map((item) => String(item || "").toLowerCase())
        .join(" ");

      return haystack.includes(search);
    });
  }

  function renderTable() {
    tableEnhancer.destroy();
    const rows = filteredRows();
    root.querySelector("[data-table-body]").innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.codigo_institucional || "-")}</td>
            <td>${escapeHtml(fullName(row))}</td>
            <td>${escapeHtml(row.cedula || "-")}</td>
            <td>${escapeHtml(row.curso || "-")}</td>
            <td>${escapeHtml(row.representante_principal || "-")}</td>
            <td><span class="tag">${escapeHtml(row.estado)}</span></td>
            <td class="row-actions">
              <button class="icon-button" data-action="edit" data-id="${row.id}">Editar</button>
              <button class="icon-button danger" data-action="delete" data-id="${row.id}">Eliminar</button>
            </td>
          </tr>`
      )
      .join("");
    root.querySelector("[data-count]").textContent = `${rows.length} registro(s)`;
    root.querySelector("[data-count]").dataset.emptyMessage =
      rows.length ? "" : "No se encontraron estudiantes con los filtros aplicados.";
  }

  function selectedRepresentativesFromForm(form) {
    return Array.from(form.querySelectorAll("[data-selected-rep]")).map((row) => {
      const repId = row.dataset.selectedRep;
      return {
        representante_id: Number(repId),
        tipo_relacion_id: Number(form.querySelector(`[data-relation-type="${repId}"]`)?.value || 0),
        es_principal: form.querySelector(`[data-action="make-primary"][data-representante-id="${repId}"]`)?.classList.contains("is-primary") === true,
        observaciones: normalizeText(form.querySelector(`[data-relation-note="${repId}"]`)?.value || ""),
      };
    });
  }

  function syncRepresentativeDraftFromForm(form) {
    const representatives = selectedRepresentativesFromForm(form);
    state.draft = {
      ...(state.draft || {}),
      representantes,
    };
    return representatives;
  }

  function payloadFromForm(form) {
    const formData = new FormData(form);
    const representatives = syncRepresentativeDraftFromForm(form);
    return {
      curso_id: Number(formData.get("curso_id") || 0),
      nombre: normalizeText(formData.get("nombre")),
      apellido: normalizeText(formData.get("apellido")),
      cedula: normalizeText(formData.get("cedula")),
      fecha_nacimiento: String(formData.get("fecha_nacimiento") || "").trim(),
      genero: String(formData.get("genero") || "").trim(),
      direccion: normalizeText(formData.get("direccion")),
      fotografia: normalizeText(formData.get("fotografia")),
      estado: normalizeText(formData.get("estado")).toLowerCase(),
      observaciones: normalizeText(formData.get("observaciones")),
      representantes: representatives,
    };
  }

  function validatePayload(payload) {
    const errors = {};

    if (!payload.nombre) errors.nombre = "Nombre es obligatorio.";
    if (!payload.apellido) errors.apellido = "Apellido es obligatorio.";
    if (!payload.curso_id) errors.curso_id = "Debe seleccionar un curso.";
    const rows = state.validationCache.filter((row) => Number(row.id) !== Number(state.editing?.id));

    if (payload.cedula && rows.some((row) => String(row.cedula || "") === payload.cedula)) {
      errors.cedula = "Ya existe un estudiante con esa cedula.";
    }

    if (payload.cedula && !/^\d{10}$/.test(payload.cedula)) {
      errors.cedula = "La cedula debe tener 10 digitos numericos.";
    }

    if (payload.fecha_nacimiento && payload.fecha_nacimiento > new Date().toISOString().slice(0, 10)) {
      errors.fecha_nacimiento = "La fecha de nacimiento no puede ser futura.";
    }

    if (payload.genero && !["M", "F", "otro"].includes(payload.genero)) {
      errors.genero = "Genero invalido.";
    }

    if (!["activo", "inactivo", "retirado", "graduado"].includes(payload.estado)) {
      errors.estado = "Estado invalido.";
    }

    if (payload.representantes.some((item) => !item.tipo_relacion_id)) {
      errors.representantes = "Cada representante seleccionado debe tener tipo de relacion.";
    }

    const principalCount = payload.representantes.filter((item) => item.es_principal).length;
    if (payload.representantes.length > 0 && principalCount !== 1) {
      errors.representantes = "Debes marcar exactamente un representante principal.";
    }

    const uniqueReps = new Set(payload.representantes.map((item) => item.representante_id));
    if (uniqueReps.size !== payload.representantes.length) {
      errors.representantes = "Hay representantes duplicados en la seleccion.";
    }

    return errors;
  }

  function clearValidationErrors(form) {
    form.querySelectorAll("[data-field]").forEach((field) => field.classList.remove("invalid"));
    form.querySelectorAll("[data-field-error]").forEach((field) => {
      field.textContent = "";
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
      const errorNode = form.querySelector(`[data-field-error="${fieldName}"]`);
      if (errorNode) errorNode.textContent = message;
    });

    const formError = form.querySelector("[data-form-error]");
    if (formError && errors._form) {
      formError.textContent = errors._form;
      formError.hidden = false;
    }

    form.querySelector(".field.invalid input, .field.invalid select, .field.invalid textarea")?.focus();
  }

  function persistDraft(form) {
    if (state.editing) return;
    state.draft = payloadFromForm(form);
    writeStorage(sessionStorage, DRAFT_KEY, state.draft);
  }

  function snapshotDraftFromForm() {
    const form = root.querySelector("[data-form]");
    if (!form) return;
    state.draft = payloadFromForm(form);
  }

  function rerenderModal({ keepDraft = false } = {}) {
    const modalWasOpen = root.querySelector("[data-modal]")?.open === true;
    if (!keepDraft) snapshotDraftFromForm();
    renderShell();
    bindEvents();
    renderTable();
    if (modalWasOpen) {
      openDialog(root.querySelector("[data-modal]"));
    }
  }

  function openModal(row = null) {
    state.editing = row;
    state.draft = row
      ? {
          ...row,
          representantes: normalizeRepresentativeDraftList(row.representantes).map((item) => ({
            representante_id: item.representante_id,
            tipo_relacion_id: item.tipo_relacion_id,
            es_principal: item.es_principal,
            observaciones: item.observaciones || "",
          })),
        }
      : (() => {
          const draft = readStorage(sessionStorage, DRAFT_KEY, {});
          return {
            ...draft,
            representantes: normalizeRepresentativeDraftList(draft?.representantes),
          };
        })();

    renderShell();
    bindEvents();
    renderTable();
    openDialog(root.querySelector("[data-modal]"));
  }

  function closeModal({ clearDraft = true } = {}) {
    const modal = root.querySelector("[data-modal]");
    if (modal?.open && typeof modal.close === "function") modal.close();
    else modal?.removeAttribute("open");

    state.editing = null;
    state.draft = {};
    if (clearDraft) removeStorage(sessionStorage, DRAFT_KEY);
    renderShell();
    bindEvents();
    renderTable();
  }

  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = payloadFromForm(form);
    const errors = validatePayload(payload);

    if (Object.keys(errors).length) {
      setValidationErrors(form, errors);
      setStatus("Corrige los campos marcados.", "error");
      notify("Revisa las validaciones del formulario.", "error");
      return;
    }

    try {
      setStatus("Guardando...", "loading");
      if (state.editing) {
        await estudiantesApi.update(state.editing.id, payload);
        notify("Estudiante actualizado.", "success");
      } else {
        await estudiantesApi.create(payload);
        notify("Estudiante creado.", "success");
      }

      removeStorage(sessionStorage, DRAFT_KEY);
      await refresh();
      closeModal();
      onChange?.();
    } catch (error) {
      const formError = form.querySelector("[data-form-error]");
      if (formError) {
        formError.textContent = error.message;
        formError.hidden = false;
      }
      setStatus(error.message, "error");
      notify(error.message, "error");
    }
  }

  async function remove(id) {
    const row = state.rows.find((item) => Number(item.id) === Number(id));
    if (!row) return;
    if (!confirm(`Eliminar estudiante ${fullName(row)}?`)) return;

    try {
      setStatus("Eliminando...", "loading");
      await estudiantesApi.remove(id);
      notify("Estudiante eliminado.", "success");
      await refresh();
      onChange?.();
    } catch (error) {
      setStatus(error.message, "error");
      notify(error.message, "error");
    }
  }

  function bindEvents() {
    const form = root.querySelector("[data-form]");
    root.querySelector('[data-action="open-create"]')?.addEventListener("click", (event) => {
      event.preventDefault();
      openModal();
    });
    form?.addEventListener("submit", save);
    form?.addEventListener("input", () => {
      clearValidationErrors(form);
      persistDraft(form);
    });
    form?.addEventListener("change", () => {
      clearValidationErrors(form);
      persistDraft(form);
    });

    root.querySelector("[data-filter-search]")?.addEventListener("input", (event) => {
      state.filters.search = event.target.value || "";
      renderTable();
    });

    root.querySelector("[data-filter-estado]")?.addEventListener("change", (event) => {
      state.filters.estado = event.target.value || "todos";
      renderTable();
    });

    root.onclick = (event) => {
      const button = event.target.closest("[data-action]");
      if (!button || !root.contains(button)) return;
      const action = button.dataset.action;
      const id = Number(button.dataset.id);

      if (action === "refresh") refresh();
      if (action === "edit") openModal(state.rows.find((row) => Number(row.id) === id) || null);
      if (action === "delete") remove(id);
      if (action === "close") closeModal();
      if (action === "add-representative") {
        snapshotDraftFromForm();
        const picker = root.querySelector("[data-representative-picker]");
        const repId = Number(picker?.value || 0);
        if (!repId) {
          notify("Selecciona un representante para agregar.", "error");
          return;
        }
        const alreadyExists = currentRepresentativeDraft().some((item) => Number(item.representante_id) === repId);
        if (alreadyExists) {
          notify("Ese representante ya fue agregado.", "error");
          return;
        }
        const next = currentRepresentativeDraft();
        next.push({
          representante_id: repId,
          tipo_relacion_id: Number(state.catalogs.tiposRelacion[0]?.id || 0),
          es_principal: next.length === 0,
          observaciones: "",
        });
        state.draft.representantes = next;
        state.representativeSearch = "";
        rerenderModal({ keepDraft: true });
      }
      if (action === "remove-representative") {
        snapshotDraftFromForm();
        const repId = Number(button.dataset.representanteId);
        let next = currentRepresentativeDraft().filter((item) => Number(item.representante_id) !== repId);
        if (next.length && !next.some((item) => item.es_principal)) {
          next = next.map((item, index) => ({ ...item, es_principal: index === 0 }));
        }
        state.draft.representantes = next;
        rerenderModal({ keepDraft: true });
      }
      if (action === "make-primary") {
        snapshotDraftFromForm();
        const repId = Number(button.dataset.representanteId);
        state.draft.representantes = currentRepresentativeDraft().map((item) => ({
          ...item,
          es_principal: Number(item.representante_id) === repId,
        }));
        rerenderModal({ keepDraft: true });
      }
    };

    root.querySelector("[data-representative-search]")?.addEventListener("input", (event) => {
      state.representativeSearch = event.target.value || "";
      rerenderModal();
    });
  }

  async function refresh() {
    try {
      setStatus("Cargando...", "loading");
      const [catalogs, rows] = await Promise.all([estudiantesApi.catalogs(), estudiantesApi.list()]);
      state.catalogs = catalogs;
      state.rows = rows;
      state.validationCache = rows;
      writeStorage(localStorage, CACHE_KEY, { savedAt: new Date().toISOString(), rows });
      renderShell();
      bindEvents();
      renderTable();
      setStatus("Datos actualizados", "success");
      return rows;
    } catch (error) {
      setStatus("No se pudieron cargar los estudiantes.", "error");
      notify(error.message, "error");
      return [];
    }
  }

  function init() {
    state.validationCache = readStorage(localStorage, CACHE_KEY, { rows: [] }).rows || [];
    const draft = readStorage(sessionStorage, DRAFT_KEY, {});
    state.draft = {
      ...draft,
      representantes: normalizeRepresentativeDraftList(draft?.representantes),
    };
    renderShell();
    bindEvents();
    return refresh();
  }

  return {
    init,
    refresh,
    getRows: () => state.rows,
  };
}
