import { createTableEnhancer } from "./tableEnhancer.js?v=20260614-8";
import { representantesApi } from "../api/representantesApi.js?v=20260614-8";
import { telegramAdminApi } from "../api/telegramAdminApi.js?v=20260614-8";

export function createRepresentantesModule({ notify, onChange }) {
  const root = document.getElementById("representantes-root");
  const tableEnhancer = createTableEnhancer();
  const state = {
    rows: [],
    loading: false,
  };

  function getBadgeColor(estado) {
    return {
      Pendiente: "secondary",
      Vinculado: "success",
      Inactivo: "warning",
      Error: "danger",
    }[estado] || "secondary";
  }

  function renderShell() {
    root.innerHTML = `
      <div class="module-header">
        <div>
          <p class="eyebrow">Gestion Telegram</p>
          <h2>Representantes</h2>
          <p class="module-description">Genera un enlace seguro para vincular representantes con el bot de Telegram y prueba la comunicación cuando ya estén vinculados.</p>
        </div>
        <button class="secondary-button" data-action="refresh">Actualizar</button>
      </div>

      <div class="table-wrap">
        <table class="table table-hover align-middle mb-0" data-enhanced-table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Apellidos</th>
              <th>Nombres</th>
              <th>Telefono</th>
              <th>Estudiante(s)</th>
              <th>Estado Telegram</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody data-table-body></tbody>
        </table>
      </div>
      <p class="table-count" data-count>0 registro(s)</p>
    `;
  }

  function renderTable() {
    tableEnhancer.destroy();
    const rows = state.rows || [];
    const body = rows
      .map((row) => `
        <tr>
          <td>${row.id}</td>
          <td>${row.apellido}</td>
          <td>${row.nombre}</td>
          <td>${row.telefono || "-"}</td>
          <td>${row.estudiantes.length ? row.estudiantes.join("<br />") : "<span class='muted'>Sin estudiantes</span>"}</td>
          <td><span class="badge text-bg-${getBadgeColor(row.estadoTelegram)}">${row.estadoTelegram}</span></td>
          <td class="row-actions">
            <button class="icon-button" data-action="copy-link" data-id="${row.id}" title="Copiar enlace de Telegram">Copiar enlace</button>
            <button class="icon-button secondary" data-action="send-test" data-id="${row.id}" ${row.estadoTelegram !== "Vinculado" ? "disabled" : ""} title="Enviar mensaje de prueba">Prueba</button>
          </td>
        </tr>`)
      .join("");

    root.querySelector("[data-table-body]").innerHTML = body;
    root.querySelector("[data-count]").textContent = `${rows.length} registro(s)`;
    tableEnhancer.mount(root.querySelector("[data-enhanced-table]"));
  }

  async function refresh() {
    try {
      state.loading = true;
      root.querySelector(".table-wrap")?.classList.add("loading");
      state.rows = await representantesApi.list();
      renderTable();
      onChange?.();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      state.loading = false;
      root.querySelector(".table-wrap")?.classList.remove("loading");
    }
  }

  async function copyLink(representanteId) {
    try {
      const link = await telegramAdminApi.generateLink(representanteId);
      await navigator.clipboard.writeText(link);
      notify("Enlace de Telegram copiado al portapapeles.", "success");
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function sendTestMessage(representanteId) {
    try {
      await telegramAdminApi.sendTestMessage(representanteId);
      notify("Mensaje de prueba enviado correctamente.", "success");
    } catch (error) {
      notify(error.message, "error");
    }
  }

  function bindEvents() {
    root.onclick = (event) => {
      const button = event.target.closest("[data-action]");
      if (!button || !root.contains(button)) return;
      const action = button.dataset.action;
      const id = Number(button.dataset.id);
      if (action === "refresh") refresh();
      if (action === "copy-link") copyLink(id);
      if (action === "send-test") sendTestMessage(id);
    };
  }

  function init() {
    renderShell();
    bindEvents();
    return refresh();
  }

  return { init, refresh };
}
