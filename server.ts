import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Get configuration status of WhatsApp Cloud API
  app.get("/api/whatsapp-status", (req, res) => {
    res.json({
      configured: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      hasToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
      hasPhoneId: !!process.env.WHATSAPP_PHONE_NUMBER_ID
    });
  });

  // API: Send message through Meta's WhatsApp Cloud API
  app.post("/api/send-whatsapp", async (req, res) => {
    try {
      const { to, message } = req.body;
      if (!to || !message) {
        return res.status(400).json({ 
          success: false, 
          error: "Nomor tujuan (to) dan pesan (message) harus diisi" 
        });
      }

      const token = process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (!token || !phoneId) {
        return res.status(400).json({
          success: false,
          error: "WhatsApp Cloud API belum dikonfigurasi di server. Silakan tambahkan WHATSAPP_ACCESS_TOKEN dan WHATSAPP_PHONE_NUMBER_ID di tab Pengaturan / Secrets."
        });
      }

      // Clean phone number (remove non-digits)
      let cleanedPhone = to.replace(/[^0-9]/g, '');
      
      // Convert leading 0 to country code 62 (Indonesia) if applicable
      if (cleanedPhone.startsWith('0')) {
        cleanedPhone = '62' + cleanedPhone.slice(1);
      }

      const metaUrl = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
      
      const response = await fetch(metaUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanedPhone,
          type: "text",
          text: {
            preview_url: false,
            body: message
          }
        })
      });

      const responseData: any = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: responseData.error?.message || "Gagal mengirim pesan melalui Meta API",
          details: responseData.error
        });
      }

      res.json({ 
        success: true, 
        message: "Pesan berhasil terkirim melalui WhatsApp Cloud API", 
        data: responseData 
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message || "Terjadi kesalahan pada internal server" 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
