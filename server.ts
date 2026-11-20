import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  Browsers,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";

type WaPhase = "disconnected" | "connecting" | "qr" | "connected" | "error";

interface WaDeviceState {
  status: WaPhase;
  qrDataUrl: string | null;
  qrUpdatedAt: number | null;
  device: {
    id: string;
    phone: string;
    name: string;
    platform: string;
    connectedAt: string;
  } | null;
  lastError: string | null;
}

const AUTH_DIR = path.join(process.cwd(), ".baileys_auth");
const logger = pino({ level: "silent" });

let waSocket: WASocket | null = null;
let isInitializing = false;
let manualDisconnect = false;
let qrAttemptCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

let waState: WaDeviceState = {
  status: "disconnected",
  qrDataUrl: null,
  qrUpdatedAt: null,
  device: null,
  lastError: null,
};

// Prevent Baileys background socket rejections from crashing the Express server
process.on("unhandledRejection", (reason: any) => {
  console.error("[WA Server] Unhandled Rejection:", reason?.message || reason);
});

process.on("uncaughtException", (err: any) => {
  console.error("[WA Server] Uncaught Exception:", err?.message || err);
});

function clearAuthFolder() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch (err) {
    console.error("Failed clearing auth folder:", err);
  }
}

function formatPhoneToJid(phone: string): string {
  let clean = String(phone || "").replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) {
    clean = "62" + clean.slice(1);
  } else if (!clean.startsWith("62") && clean.length >= 8) {
    clean = "62" + clean;
  }
  return `${clean}@s.whatsapp.net`;
}

function extractPhoneFromJid(jid?: string): string {
  if (!jid) return "-";
  return jid.split(":")[0].split("@")[0];
}

async function destroyExistingSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (waSocket) {
    try {
      waSocket.ev.removeAllListeners("connection.update");
      waSocket.ev.removeAllListeners("creds.update");
      waSocket.end(undefined);
    } catch {
      // Ignore cleanup errors
    }
    waSocket = null;
  }
}

async function getSafeWaVersion(): Promise<[number, number, number]> {
  const fallback: [number, number, number] = [2, 3000, 1027934701];
  try {
    const result = await Promise.race([
      fetchLatestWaWebVersion({}),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (result && "version" in result && Array.isArray(result.version)) {
      return result.version;
    }
  } catch {
    // Use fallback version
  }
  return fallback;
}

async function startWhatsAppSession(resetAuth = false): Promise<void> {
  if (isInitializing) return;
  isInitializing = true;
  manualDisconnect = false;

  try {
    await destroyExistingSocket();

    if (resetAuth) {
      clearAuthFolder();
      qrAttemptCount = 0;
    }

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    waState = {
      status: "connecting",
      qrDataUrl: null,
      qrUpdatedAt: null,
      device: null,
      lastError: null,
    };

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const version = await getSafeWaVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.ubuntu("SAMSAT Bangli WA"),
      printQRInTerminal: false,
      connectTimeoutMs: 30000,
      defaultQueryTimeoutMs: 30000,
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    waSocket = sock;

    sock.ev.on("creds.update", async () => {
      try {
        await saveCreds();
      } catch (e) {
        console.error("[WA Server] saveCreds error:", e);
      }
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrAttemptCount += 1;
        if (qrAttemptCount > 6 && !state.creds.registered) {
          manualDisconnect = true;
          await destroyExistingSocket();
          waState = {
            status: "disconnected",
            qrDataUrl: null,
            qrUpdatedAt: null,
            device: null,
            lastError:
              "Barcode QR kedaluwarsa karena belum dipindai. Klik tombol untuk membuat barcode baru.",
          };
          return;
        }

        try {
          const dataUrl = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2,
            color: {
              dark: "#0f172a",
              light: "#ffffff",
            },
          });
          waState = {
            status: "qr",
            qrDataUrl: dataUrl,
            qrUpdatedAt: Date.now(),
            device: null,
            lastError: null,
          };
        } catch (err: any) {
          waState = {
            ...waState,
            status: "error",
            lastError: err?.message || "Gagal merender QR Code",
          };
        }
      }

      if (connection === "open") {
        qrAttemptCount = 0;
        const user = sock.user;
        waState = {
          status: "connected",
          qrDataUrl: null,
          qrUpdatedAt: null,
          device: {
            id: user?.id || "-",
            phone: extractPhoneFromJid(user?.id),
            name: user?.name || "Perangkat WhatsApp",
            platform: "WhatsApp Multi-Device",
            connectedAt: new Date().toISOString(),
          },
          lastError: null,
        };
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const errorMessage =
          (lastDisconnect?.error as any)?.message || "Koneksi WhatsApp terputus";

        if (manualDisconnect) {
          waState = {
            status: "disconnected",
            qrDataUrl: null,
            qrUpdatedAt: null,
            device: null,
            lastError: null,
          };
          return;
        }

        const isLoggedOut =
          statusCode === DisconnectReason.loggedOut ||
          statusCode === DisconnectReason.forbidden ||
          statusCode === DisconnectReason.badSession;

        if (isLoggedOut) {
          clearAuthFolder();
          await destroyExistingSocket();
          waState = {
            status: "disconnected",
            qrDataUrl: null,
            qrUpdatedAt: null,
            device: null,
            lastError:
              statusCode === DisconnectReason.loggedOut
                ? "Sesi perangkat telah keluar (logout) dari HP. Silakan scan barcode ulang."
                : "Sesi tidak valid. Silakan scan barcode ulang.",
          };
          return;
        }

        if (
          statusCode === DisconnectReason.restartRequired ||
          statusCode === DisconnectReason.connectionClosed ||
          statusCode === DisconnectReason.connectionLost ||
          statusCode === DisconnectReason.timedOut ||
          statusCode === DisconnectReason.unavailableService ||
          !statusCode
        ) {
          waState = {
            ...waState,
            status: "connecting",
            lastError: null,
          };
          reconnectTimer = setTimeout(() => {
            if (!manualDisconnect) {
              void startWhatsAppSession(false);
            }
          }, 1500);
        } else {
          waState = {
            status: "error",
            qrDataUrl: null,
            qrUpdatedAt: null,
            device: null,
            lastError: errorMessage,
          };
        }
      }
    });
  } catch (err: any) {
    waState = {
      status: "error",
      qrDataUrl: null,
      qrUpdatedAt: null,
      device: null,
      lastError: err?.message || "Gagal menginisialisasi koneksi WhatsApp",
    };
  } finally {
    isInitializing = false;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Auto-resume existing paired WhatsApp session if credentials exist on disk
  if (fs.existsSync(path.join(AUTH_DIR, "creds.json"))) {
    void startWhatsAppSession(false);
  }

  // API: Get configuration status of WhatsApp Cloud API
  app.get("/api/whatsapp-status", (req, res) => {
    res.json({
      configured: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      hasToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
      hasPhoneId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    });
  });

  // API: Get local paired WhatsApp device status & QR
  app.get("/api/wa-device/status", (req, res) => {
    res.json(waState);
  });

  // API: Start pairing & generate QR code (non-blocking so HTTP responds immediately)
  app.post("/api/wa-device/connect", (req, res) => {
    try {
      const { fresh } = req.body || {};
      if (waState.status === "connected" && !fresh) {
        return res.json({ success: true, ...waState });
      }
      qrAttemptCount = 0;
      const shouldReset = Boolean(fresh) || waState.status === "error";
      waState = {
        status: "connecting",
        qrDataUrl: null,
        qrUpdatedAt: null,
        device: null,
        lastError: null,
      };
      void startWhatsAppSession(shouldReset);
      res.json({ success: true, ...waState });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error?.message || "Gagal memulai sesi WhatsApp",
      });
    }
  });

  // API: Disconnect / logout linked WhatsApp device
  app.post("/api/wa-device/disconnect", async (req, res) => {
    manualDisconnect = true;
    try {
      if (waSocket && waState.status === "connected") {
        await waSocket.logout();
      }
    } catch {
      // Ignore logout network error and still clear local auth
    }
    await destroyExistingSocket();
    clearAuthFolder();
    qrAttemptCount = 0;
    waState = {
      status: "disconnected",
      qrDataUrl: null,
      qrUpdatedAt: null,
      device: null,
      lastError: null,
    };
    res.json({ success: true, ...waState });
  });

  // API: Send WhatsApp message using connected paired device
  app.post("/api/wa-device/send", async (req, res) => {
    try {
      const { to, message } = req.body || {};
      if (!to || !message) {
        return res.status(400).json({
          success: false,
          error: "Nomor tujuan (to) dan isi pesan (message) harus diisi",
        });
      }

      if (!waSocket || waState.status !== "connected") {
        return res.status(400).json({
          success: false,
          error:
            "Perangkat WhatsApp belum terhubung. Silakan scan barcode di menu Perangkat terlebih dahulu.",
        });
      }

      const jid = formatPhoneToJid(to);
      const cleanNumber = jid.split("@")[0];

      let targetJid = jid;
      try {
        const results = await waSocket.onWhatsApp(cleanNumber);
        const match = results?.[0];
        if (match && match.exists === false) {
          return res.status(400).json({
            success: false,
            error: `Nomor ${cleanNumber} tidak terdaftar di WhatsApp.`,
          });
        }
        if (match?.jid) {
          targetJid = match.jid;
        }
      } catch {
        // Proceed with standard JID if lookup times out
      }

      const sent = await waSocket.sendMessage(targetJid, { text: message });
      res.json({
        success: true,
        message: "Pesan berhasil dikirim melalui perangkat WhatsApp tertaut",
        messageId: sent?.key?.id || null,
        to: cleanNumber,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error?.message || "Gagal mengirim pesan melalui perangkat tertaut",
      });
    }
  });

  // API: Send message through Meta's WhatsApp Cloud API
  app.post("/api/send-whatsapp", async (req, res) => {
    try {
      const { to, message } = req.body;
      if (!to || !message) {
        return res.status(400).json({
          success: false,
          error: "Nomor tujuan (to) dan pesan (message) harus diisi",
        });
      }

      const token = process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (!token || !phoneId) {
        return res.status(400).json({
          success: false,
          error:
            "WhatsApp Cloud API belum dikonfigurasi di server. Silakan tambahkan WHATSAPP_ACCESS_TOKEN dan WHATSAPP_PHONE_NUMBER_ID di tab Pengaturan / Secrets.",
        });
      }

      let cleanedPhone = to.replace(/[^0-9]/g, "");
      if (cleanedPhone.startsWith("0")) {
        cleanedPhone = "62" + cleanedPhone.slice(1);
      }

      const metaUrl = `https://graph.facebook.com/v18.0/${phoneId}/messages`;

      const response = await fetch(metaUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanedPhone,
          type: "text",
          text: {
            preview_url: false,
            body: message,
          },
        }),
      });

      const responseData: any = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: responseData.error?.message || "Gagal mengirim pesan melalui Meta API",
          details: responseData.error,
        });
      }

      res.json({
        success: true,
        message: "Pesan berhasil terkirim melalui WhatsApp Cloud API",
        data: responseData,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Terjadi kesalahan pada internal server",
      });
    }
  });

  // Ensure unknown /api/* routes always return JSON
  app.use("/api", (req, res) => {
    res.status(404).json({
      success: false,
      error: `Endpoint API tidak ditemukan: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global JSON error handler for Express
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith("/api")) {
      return res.status(err?.status || 500).json({
        success: false,
        error: err?.message || "Terjadi kesalahan pada server",
      });
    }
    next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
