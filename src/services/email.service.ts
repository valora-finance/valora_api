import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Doğrulama kodu e-postası gönderir (Resend HTTP API).
 */
export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  if (!config.resend.apiKey) {
    logger.warn('RESEND_API_KEY tanımlı değil — e-posta gönderilemiyor');
    if (config.env !== 'production') {
      logger.info({ email, code }, 'DEV: Doğrulama kodu (e-posta gönderilmedi)');
      return;
    }
    throw new Error('Email service is not configured');
  }

  const html = buildVerificationEmailHtml(code);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.resend.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.resend.from,
      to: [email],
      subject: 'Valora — Doğrulama Kodu',
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Resend API hatası: ${res.status} — ${(body as Record<string, unknown>).message || res.statusText}`);
  }

  logger.info({ email }, 'Doğrulama e-postası gönderildi');
}

function buildVerificationEmailHtml(code: string): string {
  const digits = code.split('');
  const digitBoxes = digits
    .map(
      (d) =>
        `<span style="display:inline-block;width:42px;height:52px;line-height:52px;text-align:center;font-size:28px;font-weight:700;color:#1D1D1F;background:#F5F5F7;border:1px solid #E0E0E0;border-radius:10px;margin:0 3px;font-family:'SF Pro Display',system-ui,sans-serif;">${d}</span>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:'SF Pro Display',system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:420px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#C6A15B 0%,#E1C78C 100%);padding:32px 24px;text-align:center;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:1px;">VALORA</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 24px;">
          <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#1D1D1F;text-align:center;">Doğrulama Kodu</h2>
          <p style="margin:0 0 24px;font-size:15px;color:#6E6E73;text-align:center;line-height:1.5;">
            Hesabınızı doğrulamak için aşağıdaki kodu kullanın.
          </p>
          <div style="text-align:center;margin:0 0 24px;">
            ${digitBoxes}
          </div>
          <p style="margin:0 0 4px;font-size:13px;color:#6E6E73;text-align:center;">
            Bu kod <strong>5 dakika</strong> içinde geçerliliğini yitirecektir.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 24px 24px;border-top:1px solid #F0F0F0;">
          <p style="margin:0;font-size:12px;color:#A0A0A0;text-align:center;line-height:1.5;">
            Bu kodu siz talep etmediyseniz bu e-postayı görmezden gelebilirsiniz.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
