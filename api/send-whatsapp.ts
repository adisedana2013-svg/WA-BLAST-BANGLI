export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { to, message } = req.body || {};
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
          "WhatsApp Cloud API belum dikonfigurasi. Tambahkan WHATSAPP_ACCESS_TOKEN dan WHATSAPP_PHONE_NUMBER_ID pada Environment Variables Vercel.",
      });
    }

    let cleanedPhone = String(to).replace(/[^0-9]/g, "");
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

    return res.status(200).json({
      success: true,
      message: "Pesan berhasil terkirim melalui WhatsApp Cloud API",
      data: responseData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Terjadi kesalahan pada server",
    });
  }
}
