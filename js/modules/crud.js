import { createTableEnhancer } from "./tableEnhancer.js?v=20260615-1";

const CACHE_PREFIX = "alegriapp-validation-cache:";
const DRAFT_PREFIX = "alegriapp-form-draft:";

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
    // Storage can fail in private mode; validation still works with in-memory rows.
  }
}

function removeStorage(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function mergeRows(primaryRows, cachedRows) {
  const rowsById = new Map();
  [...(cachedRows || []), ...(primaryRows || [])].forEach((row) => {
    if (row?.id !== undefined && row?.id !== null) rowsById.set(String(row.id), row);
  });
  return Array.from(rowsById.values());
}

export function createCrudModule(options) {
  const state = {
    rows: [],
    editing: null,
    loading: false,
    loaded: false,
    fieldOptions: {},
    validationCache: [],
    draft: {},
  };

  const root = document.getElementById(options.rootId);
  const tableEnhancer = createTableEnhancer();
  const cacheKey = `${CACHE_PREFIX}${options.rootId}`;
  const draftKey = `${DRAFT_PREFIX}${options.rootId}`;

  function valueOf(row, column) {
    if (typeof column.value === "function") return column.value(row);
    return row[column.key] ?? "";
  }

  function emptyValue(field) {
    if (field.type === "select") return field.options?.[0]?.value ?? "";
    return "";
  }

  function choicesFor(field) {
    if (Array.isArray(field.options)) return field.options;
    return state.fieldOptions[field.name] || [];
  }

  function fieldMarkup(field) {
    const draftValue = state.editing ? undefined : state.draft?.[field.name];
    const value = state.editing?.[field.name] ?? draftValue ?? field.defaultValue ?? emptyValue(field);
    const required = field.required ? "required" : "";
    const inputMode = field.inputMode ? `inputmode="${field.inputMode}"` : "";
    const maxLength = field.maxLength ? `maxlength="${field.maxLength}"` : "";
    const common = `name="${field.name}" id="${options.rootId}-${field.name}" ${required} ${inputMode} ${maxLength}`;
    const errorMarkup = `<small class="field-error" data-field-error="${field.name}"></small>`;
    const labelText = escapeHtml(field.label);

    if (field.type === "textarea") {
      return `
        <label class="field" data-field="${field.name}">
          <span>${labelText}</span>
          <textarea ${common} rows="4">${escapeHtml(value)}</textarea>
          ${errorMarkup}
        </label>`;
    }

    if (field.type === "select") {
      const choices = choicesFor(field);
      const includePlaceholder = field.placeholder !== false && (field.required || !choices.length);
      return `
        <label class="field" data-field="${field.name}">
          <span>${labelText}</span>
          <select ${common}>
            ${includePlaceholder ? `<option value="">${escapeHtml(field.placeholder || "Seleccione una opcion")}</option>` : ""}
            ${choices
              .map(
                (option) =>
                  `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`
              )
              .join("")}
          </select>
          ${errorMarkup}
        </label>`;
    }

    return `
      <label class="field" data-field="${field.name}">
        <span>${labelText}</span>
        <input ${common} type="${field.type || "text"}" value="${escapeHtml(value)}" />
        ${errorMarkup}
      </label>`;
  }

  function renderTable() {
    tableEnhancer.destroy();
    const rows = state.rows;
    const tableRows = rows
      .map(
        (row) => `
          <tr>
            ${options.columns.map((column) => `<td>${escapeHtml(valueOf(row, column))}</td>`).join("")}
            <td class="row-actions">
              <button class="icon-button" data-action="edit" data-id="${row.id}" title="Editar">Editar</button>
              <button class="icon-button danger" data-action="delete" data-id="${row.id}" title="Eliminar">Eliminar</button>
            </td>
          </tr>`
      )
      .join("");

    root.querySelector("[data-table-body]").innerHTML =
      tableRows;
    root.querySelector("[data-count]").textContent = `${rows.length} registro(s)`;
    tableEnhancer.mount(root.querySelector("[data-enhanced-table]"));
  }

  function renderShell() {
    tableEnhancer.destroy();
    root.innerHTML = `
      <div class="module-header">
        <div>
          <p class="eyebrow">${options.kicker}</p>
          <h2>${options.title}</h2>
          <span data-status class="status-text">Listo</span>
        </div>
        <button class="primary-button" data-action="open-create">Nuevo</button>
      </div>

      <div class="table-tools">
        <span class="table-hint">Registros</span>
        <button class="secondary-button" data-action="refresh">Actualizar</button>
      </div>

      <div class="table-wrap">
        <table class="table table-hover align-middle mb-0" data-enhanced-table>
          <thead>
            <tr>
              ${options.columns.map((column) => `<th>${column.label}</th>`).join("")}
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody data-table-body></tbody>
        </table>
      </div>
      <p class="table-count" data-count>0 registro(s)</p>

      <dialog class="admin-dialog" data-modal>
        <form method="dialog" data-form novalidate>
          <div class="dialog-header">
            <div>
              <p class="eyebrow">${options.singular}</p>
              <h3 data-form-title>Nuevo registro</h3>
            </div>
            <button type="button" class="close-button" data-action="close">Cerrar</button>
          </div>
          <div class="form-grid">
            ${options.fields.map(fieldMarkup).join("")}
          </div>
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
    status.textContent = message;
    status.dataset.type = type;
  }

  function openModal(row = null) {
    state.editing = row;
    state.draft = row ? {} : readStorage(sessionStorage, draftKey, {});
    renderShell();
    bindEvents();
    root.querySelector("[data-form-title]").textContent = row ? `Editar ${options.singular}` : `Nuevo ${options.singular}`;
    const modal = root.querySelector("[data-modal]");
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
    renderTable();
  }

  function closeModal({ clearDraft = true } = {}) {
    const modal = root.querySelector("[data-modal]");
    if (modal.open && typeof modal.close === "function") modal.close();
    else modal?.removeAttribute("open");
    state.editing = null;
    state.draft = {};
    if (clearDraft) removeStorage(sessionStorage, draftKey);
    renderShell();
    bindEvents();
    renderTable();
  }

  function payloadFromForm(form) {
    const payload = {};
    const formData = new FormData(form);
    options.fields.forEach((field) => {
      let value = formData.get(field.name);
      if (typeof value === "string" && !field.preserveWhitespace) value = normalizeText(value);
      if (typeof field.transform === "function") value = field.transform(value, payload);
      if (value === "" && !field.keepEmpty) return;
      payload[field.name] = field.type === "number" || field.valueType === "number" ? Number(value) : value;
    });
    return payload;
  }

  function validationRows() {
    return state.loaded ? state.rows : mergeRows(state.rows, state.validationCache);
  }

  function requiredMissing(payload, field) {
    const value = payload[field.name];
    return value === undefined || value === null || value === "" || (typeof value === "number" && !Number.isFinite(value));
  }

  function validatePayload(payload) {
    const errors = {};
    options.fields.forEach((field) => {
      const value = payload[field.name];
      if (field.required && requiredMissing(payload, field)) {
        errors[field.name] = `${field.label} es obligatorio.`;
        return;
      }

      if (value === undefined || value === null || value === "") return;

      if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
        errors[field.name] = "Ingrese un correo valido.";
      }

      if ((field.type === "number" || field.valueType === "number") && !Number.isFinite(Number(value))) {
        errors[field.name] = `${field.label} debe ser un numero valido.`;
      }

      if (field.pattern && !field.pattern.test(String(value))) {
        errors[field.name] = field.patternMessage || `${field.label} no tiene un formato valido.`;
      }

      if (typeof field.validate === "function") {
        const message = field.validate(value, payload);
        if (message) errors[field.name] = message;
      }
    });

    const customErrors =
      options.validate?.({
        payload,
        rows: state.rows,
        cachedRows: validationRows(),
        editing: state.editing,
        fieldOptions: state.fieldOptions,
      }) || {};

    return { ...errors, ...customErrors };
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
      const field = form.querySelector(`[data-field="${fieldName}"]`);
      const error = form.querySelector(`[data-field-error="${fieldName}"]`);
      field?.classList.add("invalid");
      if (error) error.textContent = message;
    });

    const formError = form.querySelector("[data-form-error]");
    if (formError && errors._form) {
      formError.textContent = errors._form;
      formError.hidden = false;
    }

    const firstInvalid = form.querySelector(".field.invalid input, .field.invalid select, .field.invalid textarea");
    firstInvalid?.focus();
  }

  function persistDraft(form) {
    if (state.editing) return;
    const draft = {};
    const formData = new FormData(form);
    options.fields.forEach((field) => {
      draft[field.name] = formData.get(field.name) ?? "";
    });
    state.draft = draft;
    writeStorage(sessionStorage, draftKey, draft);
  }

  function persistValidationCache(rows) {
    state.validationCache = rows;
    writeStorage(localStorage, cacheKey, {
      savedAt: new Date().toISOString(),
      rows,
    });
  }

  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = payloadFromForm(form);
    const validationErrors = validatePayload(payload);
    if (Object.keys(validationErrors).length) {
      setValidationErrors(form, validationErrors);
      setStatus("Corrige los campos marcados.", "error");
      options.notify("Revisa las validaciones del formulario.", "error");
      return;
    }

    try {
      setStatus("Guardando...", "loading");
      if (state.editing) {
        await options.api.update(state.editing.id, payload);
        options.notify(`${options.singular} actualizado.`, "success");
      } else {
        await options.api.create(payload);
        options.notify(`${options.singular} creado.`, "success");
      }
      state.editing = null;
      removeStorage(sessionStorage, draftKey);
      await refresh();
      closeModal();
      options.onChange?.();
    } catch (error) {
      setStatus(error.message, "error");
      options.notify(error.message, "error");
    }
  }

  async function remove(id) {
    const row = state.rows.find((item) => Number(item.id) === Number(id));
    if (!row) return;
    if (!confirm(`Eliminar ${options.singular}?`)) return;
    try {
      setStatus("Eliminando...", "loading");
      await options.api.remove(id);
      options.notify(`${options.singular} eliminado.`, "success");
      await refresh();
      options.onChange?.();
    } catch (error) {
      setStatus(error.message, "error");
      options.notify(error.message, "error");
    }
  }

  function bindEvents() {
    const form = root.querySelector("[data-form]");
    form?.addEventListener("submit", save);
    form?.addEventListener("input", () => {
      clearValidationErrors(form);
      persistDraft(form);
    });
    form?.addEventListener("change", () => {
      clearValidationErrors(form);
      persistDraft(form);
    });

    root.onclick = (event) => {
      const button = event.target.closest("[data-action]");
      if (!button || !root.contains(button)) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action === "open-create") openModal();
      if (action === "refresh") refresh();
      if (action === "edit") openModal(state.rows.find((row) => Number(row.id) === Number(id)));
      if (action === "delete") remove(id);
      if (action === "close") closeModal();
    };
  }

  async function refresh() {
    try {
      state.loading = true;
      setStatus("Cargando...", "loading");
      state.rows = await options.api.list();
      state.loaded = true;
      persistValidationCache(state.rows);
      setStatus("Datos actualizados", "success");
      renderTable();
      return state.rows;
    } catch (error) {
      setStatus(error.message, "error");
      options.notify(error.message, "error");
      return [];
    } finally {
      state.loading = false;
    }
  }

  function init() {
    state.validationCache = readStorage(localStorage, cacheKey, { rows: [] }).rows || [];
    return Promise.resolve(options.loadFieldOptions?.())
      .then((fieldOptions) => {
        state.fieldOptions = fieldOptions || {};
        renderShell();
        bindEvents();
        return refresh();
      });
  }

  return {
    init,
    refresh,
    getRows: () => state.rows,
  };
}
