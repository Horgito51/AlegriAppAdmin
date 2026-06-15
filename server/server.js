import express from "express";
import cors from "cors";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;
const TELEGRAM_SECRET_KEY = process.env.TELEGRAM_SECRET_KEY;

function ensureConfig() {
  if (!SUPABASE_URL) throw new Error("SUPABASE_URL no configurado.");
  if (!SUPABASE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurado.");
  if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN no configurado.");
  if (!TELEGRAM_BOT_USERNAME) throw new Error("TELEGRAM_BOT_USERNAME no configurado.");
  if (!TELEGRAM_SECRET_KEY) throw new Error("TELEGRAM_SECRET_KEY no configurado.");
}

function buildSupabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

function signRepresentante(representanteId) {
  const payload = `rep_${representanteId}`;
  return crypto.createHmac("sha256", TELEGRAM_SECRET_KEY).update(payload).digest("base64url");
}

function verifySignature(representanteId, signature) {
  return signature === signRepresentante(representanteId);
}

function createError(code, message) {
  return { status: code, body: { ok: false, error: message } };
}

async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}/${path}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: buildSupabaseHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = json?.message || json?.error || response.statusText;
    throw new Error(message || `Supabase request failed: ${response.status}`);
  }
  return json;
}

async function fetchRepresentante(representanteId) {
  const rows = await supabaseRequest(
    `representantes?select=id,nombre,apellido,deleted_at&deleted_at=is.null&id=eq.${encodeURIComponent(representanteId)}`
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function fetchTelegramConfigByChatId(chatId) {
  const rows = await supabaseRequest(
    `configuracion_telegram?select=id,representante_id,estado_integracion,verificado&chat_id=eq.${encodeURIComponent(chatId)}&deleted_at=is.null`
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function fetchTelegramConfigForRepresentante(representanteId) {
  const rows = await supabaseRequest(
    `configuracion_telegram?select=id,chat_id,estado_integracion,verificado&representante_id=eq.${encodeURIComponent(representanteId)}&deleted_at=is.null`
  );
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function upsertTelegramConfig(representante, chatId) {
  const now = new Date().toISOString();
  const payload = {
    chat_id: String(chatId),
    tipo_destinatario: "representante",
    representante_id: representante.id,
    nombre_destinatario: [representante.nombre, representante.apellido].filter(Boolean).join(" ").trim(),
    estado_integracion: "activo",
    verificado: true,
    fecha_verificacion: now,
    updated_at: now,
    deleted_at: null,
  };

  const existing = await fetchTelegramConfigForRepresentante(representante.id);
  if (existing) {
    await supabaseRequest(`configuracion_telegram?id=eq.${existing.id}`, {
      method: "PATCH",
      body: payload,
    });
  } else {
    await supabaseRequest(`configuracion_telegram`, {
      method: "POST",
      body: payload,
    });
  }
}

async function sendTelegramMessage(chatId, text) {
  const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(telegramUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.description || "Error al enviar mensaje de Telegram.");
  }
  return json;
}

app.get("/telegram/link", async (req, res) => {
  try {
    ensureConfig();
    const representanteId = Number(req.query.representanteId);
    if (!representanteId || Number.isNaN(representanteId)) {
      return res.status(400).json({ ok: false, error: "representanteId inválido." });
    }

    const representante = await fetchRepresentante(representanteId);
    if (!representante) {
      return res.status(404).json({ ok: false, error: "Representante no encontrado." });
    }

    const signature = signRepresentante(representanteId);
    const link = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=rep_${representanteId}_${signature}`;
    return res.json({ ok: true, link });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/telegram/test", async (req, res) => {
  try {
    ensureConfig();
    const representanteId = Number(req.body.representanteId);
    if (!representanteId || Number.isNaN(representanteId)) {
      return res.status(400).json({ ok: false, error: "representanteId inválido." });
    }

    const config = await fetchTelegramConfigForRepresentante(representanteId);
    if (!config || !config.chat_id) {
      return res.status(400).json({ ok: false, error: "El representante no está vinculado a Telegram." });
    }
    if (config.estado_integracion !== "activo" || config.verificado !== true) {
      return res.status(400).json({ ok: false, error: "La vinculación de Telegram no está activa." });
    }

    await sendTelegramMessage(config.chat_id, "Mensaje de prueba desde AlegriApp. Tu vínculo de Telegram está activo.");
    return res.json({ ok: true, message: "Mensaje de prueba enviado." });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/webhook/telegram", async (req, res) => {
  try {
    ensureConfig();
    const update = req.body;
    const message = update.message || update.edited_message;
    const text = message?.text?.trim();
    const chatId = message?.chat?.id;

    if (!text || !chatId) {
      return res.status(200).json({ ok: true });
    }

    const match = text.match(/^\/start\s+rep_(\d+)_([A-Za-z0-9_-]+)$/);
    if (!match) {
      return res.status(200).json({ ok: true });
    }

    const representanteId = Number(match[1]);
    const signature = match[2];
    if (!verifySignature(representanteId, signature)) {
      return res.status(400).json({ ok: false, error: "Firma inválida." });
    }

    const representante = await fetchRepresentante(representanteId);
    if (!representante) {
      return res.status(404).json({ ok: false, error: "Representante no encontrado." });
    }

    const existingChat = await fetchTelegramConfigByChatId(String(chatId));
    if (existingChat && existingChat.representante_id !== representanteId) {
      return res.status(409).json({ ok: false, error: "chat_id ya vinculado a otro representante." });
    }

    await upsertTelegramConfig(representante, String(chatId));
    return res.json({ ok: true, message: "Vinculación de Telegram registrada." });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true, version: "1.0.0" });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`AlegriApp Telegram admin server escuchando en http://localhost:${port}`);
});
