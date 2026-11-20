export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return res.status(200).json({
    configured: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    hasToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
    hasPhoneId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    hasGateway: !!process.env.WA_GATEWAY_URL,
  });
}
