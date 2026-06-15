import { createTableEnhancer } from "./tableEnhancer.js?v=20260615-6";
import { representantesApi } from "../api/representantesApi.js?v=20260615-6";

const CACHE_KEY = "alegriapp-validation-cache:representantes-root";
const DRAFT_KEY = "alegriapp-form-draft:representantes-root";
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

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function sameText(a, b) {
  return normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();
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
    // Storage can fail in private mode; the module still works in memory.
  }
}

function removeStorage(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore cleanup failures.
  }
}

function buildFullName(row) {
  return [row.nombre, row.apellido].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function createRepresentantesModule({ notify, onChange }) {
  const root = document.getElementById("representantes-root");
  const tableEnhancer = createTableEnhancer();
  const state = {
    rows: [],
    validationCache: [],
    filters: {
      search: "",
      estado: "todos",
    },
    editing: null,
    draft: {},
  };

  function fieldMarkup(field) {
    const draftValue = state.editing ? undefined : state.draft?.[field.name];
    const value = state.editing?.[field.name] ?? draftValue ?? field.defaultValue ?? "";
    const required = field.required ? "required" : "";
    const inputMode = field.inputMode ? `inputmode="${field.inputMode}"` : "";
    const maxLength = field.maxLength ? `maxlength="${field.maxLength}"` : "";
    const autocomplete = field.autocomplete ? `autocomplete="${field.autocomplete}"` : "";
    const common = `name="${field.name}" id="representantes-${field.name}" ${required} ${inputMode} ${maxLength} ${autocomplete}`;

    if (field.type === "textarea") {
      return `
        <label class="field" data-field="${field.name}">
          <span>${escapeHtml(field.label)}</span>
          <textarea ${common} rows="4">${escapeHtml(value)}</textarea>
          <small class="field-error" data-field-error="${field.name}"></small>
        </label>`;
    }

    if (field.type === "select") {
      return `
        <label class="field" data-field="${field.name}">
          <span>${escapeHtml(field.label)}</span>
          <select ${common}>
            <option value="">Seleccione una opcion</option>
            ${field.options
              .map(
                (option) =>
                  `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`
              )
              .join("")}
          </select>
          <small class="field-error" data-field-error="${field.name}"></small>
        </label>`;
    }

    return `
      <label class="field" data-field="${field.name}">
        <span>${escapeHtml(field.label)}</span>
        <input ${common} type="${field.type || "text"}" value="${escapeHtml(value)}" />
        <small class="field-error" data-field-error="${field.name}"></small>
      </label>`;
  }

  const fields = [
    { name: "nombre", label: "Nombre", required: true, autocomplete: "given-name" },
    { name: "apellido", label: "Apellido", required: true, autocomplete: "family-name" },
    { name: "cedula", label: "Cedula", inputMode: "numeric", maxLength: 20 },
    { name: "telefono", label: "Telefono", inputMode: "tel", maxLength: 20, autocomplete: "tel" },
    { name: "telefono_alternativo", label: "Telefono alternativo", inputMode: "tel", maxLength: 20 },
    { name: "email", label: "Correo", type: "email", autocomplete: "email" },
    { name: "chat_id", label: "Chat ID Telegram" },
    { name: "direccion", label: "Direccion", type: "textarea", autocomplete: "street-address" },
    { name: "ocupacion", label: "Ocupacion" },
    {
      name: "estado",
      label: "Estado",
      type: "select",
      required: true,
      defaultValue: "activo",
      options: [
        { value: "activo", label: "Activo" },
        { value: "inactivo", label: "Inactivo" },
      ],
    },
  ];

  function renderShell() {
    tableEnhancer.destroy();
    root.innerHTML = `
      <div class="module-header">
        <div>
          <p class="eyebrow">Gestion equipo</p>
          <h2>Representantes</h2>
          <span data-status class="status-text">Listo</span>
        </div>
        <button class="primary-button" data-action="open-create">Crear representante</button>
      </div>

      <div class="table-tools table-tools-filters">
        <label class="field compact-field">
          <span>Buscar</span>
          <input
            type="search"
            placeholder="Nombre, apellido, cedula, email o telefono"
            value="${escapeHtml(state.filters.search)}"
            data-filter-search
          />
        </label>

        <label class="field compact-field">
          <span>Estado</span>
          <select data-filter-estado>
            <option value="todos" ${state.filters.estado === "todos" ? "selected" : ""}>Todos</option>
            <option value="activo" ${state.filters.estado === "activo" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${state.filters.estado === "inactivo" ? "selected" : ""}>Inactivo</option>
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
              <th>Nombre completo</th>
              <th>Cedula</th>
              <th>Telefono</th>
              <th>Email</th>
              <th>Ocupacion</th>
              <th>Chat ID</th>
              <th>Estudiante(s)</th>
              <th>Estado Telegram</th>
              <th>Estado</th>
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
              <p class="eyebrow">Representante</p>
              <h3 data-form-title>Nuevo representante</h3>
            </div>
            <button type="button" class="close-button" data-action="close">Cerrar</button>
          </div>
          <div class="form-grid">
            ${fields.map(fieldMarkup).join("")}
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
    if (!status) return;
    status.textContent = message;
    status.dataset.type = type;
  }

  function filteredRows() {
    const search = normalizeText(state.filters.search).toLowerCase();
    return state.rows.filter((row) => {
      if (state.filters.estado !== "todos" && row.estado !== state.filters.estado) return false;
      if (!search) return true;

      const haystack = [row.nombre, row.apellido, row.cedula, row.email, row.telefono, row.telefono_alternativo]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(search);
    });
  }

  function renderTable() {
    tableEnhancer.destroy();
    const rows = filteredRows();
    const body = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(buildFullName(row))}</td>
            <td>${escapeHtml(row.cedula || "-")}</td>
            <td>${escapeHtml(row.telefono || "-")}</td>
            <td>${escapeHtml(row.email || "-")}</td>
            <td>${escapeHtml(row.ocupacion || "-")}</td>
            <td>${escapeHtml(row.telegram_chat_id || "-")}</td>
            <td>${escapeHtml(Array.isArray(row.estudiantes) && row.estudiantes.length ? row.estudiantes.join(", ") : "-")}</td>
            <td><span class="tag">${escapeHtml(row.estadoTelegram || "Sin chat ID")}</span></td>
            <td><span class="tag">${escapeHtml(row.estado)}</span></td>
            <td class="row-actions">
              <button class="icon-button" data-action="edit" data-id="${row.id}">Editar</button>
              <button class="icon-button" data-action="toggle-status" data-id="${row.id}">
                ${row.estado === "activo" ? "Inactivar" : "Activar"}
              </button>
              <button class="icon-button danger" data-action="delete" data-id="${row.id}">Eliminar</button>
            </td>
          </tr>`
      )
      .join("");

    root.querySelector("[data-table-body]").innerHTML = body;
    root.querySelector("[data-count]").textContent = `${rows.length} registro(s)`;
    root.querySelector("[data-count]").dataset.emptyMessage =
      rows.length ? "" : "No se encontraron representantes con los filtros aplicados.";
  }

  function payloadFromForm(form) {
    const formData = new FormData(form);
    return {
      nombre: normalizeText(formData.get("nombre")),
      apellido: normalizeText(formData.get("apellido")),
      cedula: normalizeText(formData.get("cedula")),
      telefono: normalizeText(formData.get("telefono")),
      telefono_alternativo: normalizeText(formData.get("telefono_alternativo")),
      email: normalizeEmail(formData.get("email")),
      chat_id: normalizeText(formData.get("chat_id")),
      direccion: normalizeText(formData.get("direccion")),
      ocupacion: normalizeText(formData.get("ocupacion")),
      estado: normalizeText(formData.get("estado")).toLowerCase(),
    };
  }

  function cacheRows() {
    return state.rows.length ? state.rows : state.validationCache;
  }

  function validatePayload(payload) {
    const errors = {};
    const rows = cacheRows().filter((row) => Number(row.id) !== Number(state.editing?.id));

    if (!payload.nombre) errors.nombre = "Nombre es obligatorio.";
    if (!payload.apellido) errors.apellido = "Apellido es obligatorio.";

    if (!payload.estado) {
      errors.estado = "Estado es obligatorio.";
    } else if (!["activo", "inactivo"].includes(payload.estado)) {
      errors.estado = "Estado debe ser activo o inactivo.";
    }

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      errors.email = "Ingrese un correo valido.";
    }

    if (payload.telefono && !VALID_PHONE_PATTERN.test(payload.telefono)) {
      errors.telefono = "Ingrese un telefono valido.";
    }

    if (payload.telefono_alternativo && !VALID_PHONE_PATTERN.test(payload.telefono_alternativo)) {
      errors.telefono_alternativo = "Ingrese un telefono alternativo valido.";
    }

    if (payload.cedula && rows.some((row) => String(row.cedula || "") === payload.cedula)) {
      errors.cedula = "Ya existe un representante con esa cedula.";
    }

    if (payload.email && rows.some((row) => sameText(row.email, payload.email))) {
      errors.email = "Ya existe un representante con ese correo.";
    }

    if (payload.chat_id && rows.some((row) => String(row.telegram_chat_id || "") === payload.chat_id)) {
      errors.chat_id = "Ya existe un representante con ese chat ID.";
    }

    return errors;
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

    form.querySelector(".field.invalid input, .field.invalid select, .field.invalid textarea")?.focus();
  }

  function persistDraft(form) {
    if (state.editing) return;
    const formData = new FormData(form);
    state.draft = Object.fromEntries(
      fields.map((field) => [field.name, formData.get(field.name) ?? ""])
    );
    writeStorage(sessionStorage, DRAFT_KEY, state.draft);
  }

  function openModal(row = null) {
    state.editing = row
      ? {
          ...row,
          chat_id: row.chat_id || row.telegram_chat_id || "",
        }
      : null;
    state.draft = row ? {} : readStorage(sessionStorage, DRAFT_KEY, {});
    renderShell();
    bindEvents();
    renderTable();

    const modal = root.querySelector("[data-modal]");
    root.querySelector("[data-form-title]").textContent = row ? "Editar representante" : "Nuevo representante";
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
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
        await representantesApi.update(state.editing.id, payload);
        notify("Representante actualizado.", "success");
      } else {
        await representantesApi.create(payload);
        notify("Representante creado.", "success");
      }
      removeStorage(sessionStorage, DRAFT_KEY);
      state.editing = null;
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

  async function toggleStatus(id) {
    const row = state.rows.find((item) => Number(item.id) === Number(id));
    if (!row) return;
    try {
      setStatus("Actualizando estado...", "loading");
      await representantesApi.toggleStatus(id, row.estado);
      notify(`Representante ${row.estado === "activo" ? "inactivado" : "activado"}.`, "success");
      await refresh();
      onChange?.();
    } catch (error) {
      setStatus(error.message, "error");
      notify(error.message, "error");
    }
  }

  async function remove(id) {
    const row = state.rows.find((item) => Number(item.id) === Number(id));
    if (!row) return;
    if (!confirm(`Eliminar representante ${buildFullName(row)}?`)) return;

    try {
      setStatus("Eliminando...", "loading");
      await representantesApi.remove(id);
      notify("Representante eliminado.", "success");
      await refresh();
      onChange?.();
    } catch (error) {
      setStatus(error.message, "error");
      notify(error.message, "error");
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

    const searchInput = root.querySelector("[data-filter-search]");
    const estadoSelect = root.querySelector("[data-filter-estado]");
    searchInput?.addEventListener("input", (event) => {
      state.filters.search = event.target.value || "";
      renderTable();
    });
    estadoSelect?.addEventListener("change", (event) => {
      state.filters.estado = event.target.value || "todos";
      renderTable();
    });

    root.onclick = (event) => {
      const button = event.target.closest("[data-action]");
      if (!button || !root.contains(button)) return;
      const action = button.dataset.action;
      const id = Number(button.dataset.id);

      if (action === "open-create") openModal();
      if (action === "refresh") refresh();
      if (action === "edit") openModal(state.rows.find((row) => Number(row.id) === id) || null);
      if (action === "toggle-status") toggleStatus(id);
      if (action === "delete") remove(id);
      if (action === "close") closeModal();
    };
  }

  async function refresh() {
    try {
      setStatus("Cargando...", "loading");
      await representantesApi.repairTelegramConfigTokens();
      state.rows = await representantesApi.list();
      state.validationCache = state.rows;
      writeStorage(localStorage, CACHE_KEY, { savedAt: new Date().toISOString(), rows: state.rows });
      renderTable();
      setStatus("Datos actualizados", "success");
      return state.rows;
    } catch (error) {
      setStatus("No se pudieron cargar los representantes.", "error");
      notify(error.message, "error");
      return [];
    }
  }

  function init() {
    state.validationCache = readStorage(localStorage, CACHE_KEY, { rows: [] }).rows || [];
    state.draft = readStorage(sessionStorage, DRAFT_KEY, {});
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
