import { config } from "./client.js?v=20260614-8";

function resolveApiBaseUrl() {
  // Prefer the module `config` (exported by ./client.js). If está vacío (posible cache o carga global),
  // usar el global `window.ALEGRIAPP_CONFIG` como fallback.
  let baseUrl = config?.rest?.baseUrl ?? "";
  baseUrl = typeof baseUrl === "string" ? baseUrl.replace(/\/$/, "") : "";
  if (!baseUrl && typeof window !== "undefined") {
    const globalBase = window.ALEGRIAPP_CONFIG?.rest?.baseUrl;
    if (globalBase) {
      console.warn("telegramAdminApi: usando window.ALEGRIAPP_CONFIG.rest.baseUrl como fallback.");
      baseUrl = String(globalBase).replace(/\/$/, "");
    }
  }
  if (!baseUrl) {
    throw new Error("REST API no configurado. Ajusta js/config.js con rest.baseUrl para utilizar la integración de Telegram.");
  }
  return baseUrl;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const json = JSON.parse(text);
      errorMessage = json.error || json.message || JSON.stringify(json);
    } catch {
      errorMessage = text || errorMessage;
    }
    throw new Error(errorMessage);
  }
  if (!text) return {};
  return JSON.parse(text);
}

export const telegramAdminApi = {
  async generateLink(representanteId) {
    const url = `${resolveApiBaseUrl()}/telegram/link?representanteId=${encodeURIComponent(representanteId)}`;
    const response = await fetch(url);
    const payload = await parseResponse(response);
    if (!payload.link) {
      throw new Error(payload.error || "No se pudo generar el enlace de Telegram.");
    }
    return payload.link;
  },

  async sendTestMessage(representanteId) {
    const url = `${resolveApiBaseUrl()}/telegram/test`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ representanteId }),
    });
    const payload = await parseResponse(response);
    return payload;
  },
};
