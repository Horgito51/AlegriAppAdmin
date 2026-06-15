export function createCrudModule(options) {
  const state = {
    rows: [],
    editing: null,
    query: "",
    loading: false,
  };

  const root = document.getElementById(options.rootId);

  function valueOf(row, column) {
    if (typeof column.value === "function") return column.value(row);
    return row[column.key] ?? "";
  }

  function filteredRows() {
    const query = state.query.trim().toLowerCase();
    if (!query) return state.rows;
    return state.rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query));
  }

  function emptyValue(field) {
    if (field.type === "select") return field.options?.[0]?.value ?? "";
    return "";
  }

  function fieldMarkup(field) {
    const value = state.editing?.[field.name] ?? field.defaultValue ?? emptyValue(field);
    const required = field.required ? "required" : "";
    const common = `name="${field.name}" id="${options.rootId}-${field.name}" ${required}`;

    if (field.type === "textarea") {
      return `
        <label class="field">
          <span>${field.label}</span>
          <textarea ${common} rows="4">${value ?? ""}</textarea>
        </label>`;
    }

    if (field.type === "select") {
      const choices = field.options || [];
      return `
        <label class="field">
          <span>${field.label}</span>
          <select ${common}>
            ${choices
              .map(
                (option) =>
                  `<option value="${option.value}" ${String(option.value) === String(value) ? "selected" : ""}>${option.label}</option>`
              )
              .join("")}
          </select>
        </label>`;
    }

    return `
      <label class="field">
        <span>${field.label}</span>
        <input ${common} type="${field.type || "text"}" value="${value ?? ""}" />
      </label>`;
  }

  function renderTable() {
    const rows = filteredRows();
    const tableRows = rows
      .map(
        (row) => `
          <tr>
            ${options.columns.map((column) => `<td>${valueOf(row, column)}</td>`).join("")}
            <td class="row-actions">
              <button class="icon-button" data-action="edit" data-id="${row.id}" title="Editar">Editar</button>
              <button class="icon-button danger" data-action="delete" data-id="${row.id}" title="Eliminar">Eliminar</button>
            </td>
          </tr>`
      )
      .join("");

    root.querySelector("[data-table-body]").innerHTML =
      tableRows ||
      `<tr><td colspan="${options.columns.length + 1}" class="empty-row">No hay registros para mostrar.</td></tr>`;
    root.querySelector("[data-count]").textContent = `${rows.length} registro(s)`;
  }

  function renderShell() {
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
        <label class="search-box">
          <span>Buscar</span>
          <input data-search type="search" placeholder="Buscar por cualquier campo" />
        </label>
        <button class="secondary-button" data-action="refresh">Actualizar</button>
      </div>

      <div class="table-wrap">
        <table>
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

      <dialog class="modal" data-modal>
        <form method="dialog" data-form>
          <div class="modal-header">
            <div>
              <p class="eyebrow">${options.singular}</p>
              <h3 data-form-title>Nuevo registro</h3>
            </div>
            <button type="button" class="close-button" data-action="close">Cerrar</button>
          </div>
          <div class="form-grid">
            ${options.fields.map(fieldMarkup).join("")}
          </div>
          <div class="modal-actions">
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
    renderShell();
    bindEvents();
    root.querySelector("[data-form-title]").textContent = row ? `Editar ${options.singular}` : `Nuevo ${options.singular}`;
    root.querySelector("[data-modal]").showModal();
    renderTable();
  }

  function closeModal() {
    root.querySelector("[data-modal]").close();
    state.editing = null;
    renderShell();
    bindEvents();
    renderTable();
  }

  function payloadFromForm(form) {
    const payload = {};
    options.fields.forEach((field) => {
      const value = new FormData(form).get(field.name);
      if (value === "" && !field.keepEmpty) return;
      payload[field.name] = field.type === "number" ? Number(value) : value;
    });
    return payload;
  }

  async function save(event) {
    event.preventDefault();
    const payload = payloadFromForm(event.currentTarget);
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
    root.querySelector("[data-search]")?.addEventListener("input", (event) => {
      state.query = event.target.value;
      renderTable();
    });

    root.querySelector("[data-form]")?.addEventListener("submit", save);

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
