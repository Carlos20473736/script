import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BASE = "https://tubecoin.com.br";

// ── Configuração Young Money ──
const MONETAG_API = "https://monetag-postback-server-production.up.railway.app";
const ZONE_ID = "10325249";
const MAX_CLICKS = 2;
const MAX_IMPRESSIONS = 20;
const RESET_INTERVAL_MS = 60 * 60 * 1000; // 1 hora em ms

// Store de cookies por sessão (TubeCoin)
const sessions = new Map();

// Store de timestamps de liberação por usuario
const userAccess = new Map();

// Middleware
app.use(express.json({ limit: "5mb" }));
app.use(express.static(join(__dirname, "public")));

// ── Helpers ──
function parseCookiesFromResponse(resp) {
  const cookies = [];
  const raw = resp.headers.raw ? resp.headers.raw()["set-cookie"] : null;
  if (raw) {
    raw.forEach(c => cookies.push(c));
  } else {
    const sc = resp.headers.get("set-cookie");
    if (sc) sc.split(/,(?=\s*\w+=)/).forEach(c => cookies.push(c.trim()));
  }
  return cookies;
}

function mergeCookies(existing, newCookies) {
  const jar = new Map();
  if (existing) {
    existing.split("; ").forEach(c => {
      const [k, ...v] = c.split("=");
      if (k) jar.set(k.trim(), v.join("="));
    });
  }
  newCookies.forEach(sc => {
    const parts = sc.split(";")[0];
    const [k, ...v] = parts.split("=");
    if (k) jar.set(k.trim(), v.join("="));
  });
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

// ── Young Money: Enviar postback (impressão ou clique) ──
app.get("/api/ym/postback", async (req, res) => {
  try {
    const { event_type, user_id } = req.query;
    
    if (!event_type || !user_id) {
      return res.status(400).json({ success: false, error: "Parâmetros event_type e user_id são obrigatórios" });
    }
    
    const price = event_type === "click" ? "0.0045" : "0.0023";
    const params = new URLSearchParams({
      event_type,
      zone_id: ZONE_ID,
      ymid: user_id,
      user_email: user_id,
      estimated_price: price
    });
    
    const url = `${MONETAG_API}/api/postback?${params.toString()}`;
    console.log(`[YM Postback] Enviando ${event_type} para ${user_id}: ${url}`);
    
    const apiResp = await fetch(url, { method: "GET", mode: "cors" });
    const data = await apiResp.json();
    
    console.log(`[YM Postback] Resposta:`, data);
    res.json(data);
    
  } catch (error) {
    console.error("[YM Postback Error]", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Young Money: Verificar status das tarefas ──
app.get("/api/ym/status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verificar se o usuário já tem acesso liberado e se ainda está no período válido
    const access = userAccess.get(userId);
    if (access) {
      const elapsed = Date.now() - access.grantedAt;
      if (elapsed < RESET_INTERVAL_MS) {
        const remainingMs = RESET_INTERVAL_MS - elapsed;
        return res.json({
          success: true,
          status: "granted",
          remainingMs,
          resetAt: access.grantedAt + RESET_INTERVAL_MS,
          grantedAt: access.grantedAt,
          clicks: access.clicks,
          impressions: access.impressions
        });
      } else {
        userAccess.delete(userId);
      }
    }
    
    // Consultar API do Monetag para verificar progresso
    const apiResp = await fetch(`${MONETAG_API}/api/stats/user/${userId}`);
    const data = await apiResp.json();
    
    if (!data.success) {
      return res.json({
        success: true,
        status: "pending",
        clicks: 0,
        impressions: 0,
        maxClicks: MAX_CLICKS,
        maxImpressions: MAX_IMPRESSIONS,
        message: "Usuário não encontrado na API"
      });
    }
    
    const clicks = parseInt(data.total_clicks) || 0;
    const impressions = parseInt(data.total_impressions) || 0;
    
    // Verificar se completou todas as tarefas
    if (clicks >= MAX_CLICKS && impressions >= MAX_IMPRESSIONS) {
      const grantedAt = Date.now();
      userAccess.set(userId, { grantedAt, clicks, impressions });
      
      return res.json({
        success: true,
        status: "granted",
        remainingMs: RESET_INTERVAL_MS,
        resetAt: grantedAt + RESET_INTERVAL_MS,
        grantedAt,
        clicks,
        impressions
      });
    }
    
    // Tarefas ainda pendentes
    return res.json({
      success: true,
      status: "pending",
      clicks,
      impressions,
      maxClicks: MAX_CLICKS,
      maxImpressions: MAX_IMPRESSIONS
    });
    
  } catch (error) {
    console.error("[YM Status Error]", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Young Money: Forçar reset (para testes) ──
app.post("/api/ym/reset/:userId", (req, res) => {
  const { userId } = req.params;
  userAccess.delete(userId);
  res.json({ success: true, message: "Acesso resetado" });
});

// ── Proxy API (TubeCoin) ──
app.post("/api/proxy", async (req, res) => {
  try {
    const { method, path, body: reqBody, contentType, csrfToken, sessionId: sid } = req.body;
    const sessionId = sid || "default";
    let cookies = sessions.get(sessionId) || "";

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
      "X-Requested-With": "XMLHttpRequest",
    };

    if (cookies) headers["Cookie"] = cookies;
    if (csrfToken) headers["X-CSRF-TOKEN"] = csrfToken;

    const fetchOpts = {
      method: method || "GET",
      headers,
      redirect: "manual",
    };

    if (method === "POST") {
      headers["Content-Type"] = contentType || "application/json";
      headers["Referer"] = BASE + "/dashboard";
      headers["Origin"] = BASE;
      if (reqBody) fetchOpts.body = reqBody;
    }

    const url = BASE + path;
    const resp = await fetch(url, fetchOpts);

    // Salvar cookies
    const newCookies = parseCookiesFromResponse(resp);
    if (newCookies.length > 0) {
      cookies = mergeCookies(cookies, newCookies);
      sessions.set(sessionId, cookies);
    }

    // Seguir redirects manualmente para manter cookies
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      if (location) {
        const redirUrl = location.startsWith("http") ? location : BASE + location;
        const resp2 = await fetch(redirUrl, {
          headers: { ...headers, Cookie: cookies },
          redirect: "manual",
        });
        const nc2 = parseCookiesFromResponse(resp2);
        if (nc2.length > 0) {
          cookies = mergeCookies(cookies, nc2);
          sessions.set(sessionId, cookies);
        }
        const html = await resp2.text();
        return res.json({ success: true, html, status: resp2.status });
      }
    }

    const responseText = await resp.text();
    let isJson = false;
    try { JSON.parse(responseText); isJson = true; } catch (e) {}

    const result = { success: true, status: resp.status };
    if (isJson) result.body = responseText;
    else result.html = responseText;

    res.json(result);

  } catch (error) {
    console.error("[Proxy Error]", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Health check ──
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", sessions: sessions.size, activeUsers: userAccess.size });
});

// ── SPA fallback ──
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TubeCoin Bot + Young Money rodando na porta ${PORT}`);
});
