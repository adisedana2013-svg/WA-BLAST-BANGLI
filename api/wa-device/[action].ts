const ALLOWED_ACTIONS = new Set(["status", "connect", "disconnect", "send"]);

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const rawAction = req.query?.action;
  const action = Array.isArray(rawAction) ? rawAction[0] : String(rawAction || "");

  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(404).json({
      success: false,
      error: `Endpoint WA device tidak ditemukan: ${action}`,
    });
  }

  const gatewayUrl = (process.env.WA_GATEWAY_URL || "").trim().replace(/\/+$/, "");

  // If external Node.js WA Gateway server is configured in Vercel env, proxy all requests cleanly
  if (gatewayUrl) {
    try {
      const targetUrl = `${gatewayUrl}/api/wa-device/${action}`;
      const fetchOptions: RequestInit = {
        method: req.method || "GET",
        headers: {
          "Content-Type": "application/json",
        },
      };
      if (req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined) {
        fetchOptions.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      }

      const upstream = await fetch(targetUrl, fetchOptions);
      const text = await upstream.text();
      try {
        const json = text ? JSON.parse(text) : {};
        return res.status(upstream.status).json(json);
      } catch {
        return res.status(502).json({
          success: false,
          error: `Server WA Gateway (${gatewayUrl}) tidak merespons JSON yang valid (HTTP ${upstream.status}).`,
        });
      }
    } catch (err: any) {
      return res.status(502).json({
        success: false,
        error: `Gagal terhubung ke WA Gateway (${gatewayUrl}): ${err?.message || err}`,
      });
    }
  }

  // No WA_GATEWAY_URL configured on Vercel serverless environment
  if (action === "status") {
    return res.status(200).json({
      status: "disconnected",
      qrDataUrl: null,
      qrUpdatedAt: null,
      device: null,
      lastError: null,
      serverlessUnconfigured: true,
    });
  }

  return res.status(400).json({
    success: false,
    code: "SERVERLESS_UNSUPPORTED",
    serverlessUnconfigured: true,
    error:
      "Aplikasi berjalan di Vercel (serverless) yang tidak mendukung koneksi WebSocket WhatsApp QR secara langsung. Jalankan server.ts di Railway/Render/VPS/Cloud Run lalu masukkan URL Server WA Gateway pada menu Perangkat.",
  });
}
