import https from 'https';

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
}

export function sendWhatsAppMessage(toPhone: string, messageText: string, config?: WhatsAppConfig): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    // Read from provided config or environment variables
    const phoneNumberId = config?.phoneNumberId || process.env.VITE_WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = config?.accessToken || process.env.VITE_WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      console.warn('[WhatsApp Service] Meta WhatsApp Cloud API credentials not configured yet.');
      return resolve({
        success: false,
        error: 'WhatsApp API credentials (Phone Number ID / Access Token) not configured in settings.'
      });
    }

    // Clean phone number (convert 0300... to 92300...)
    let cleanPhone = toPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '92' + cleanPhone.slice(1);
    } else if (cleanPhone.length === 10) {
      cleanPhone = '92' + cleanPhone;
    }

    if (!cleanPhone) {
      return resolve({ success: false, error: 'Invalid recipient phone number.' });
    }

    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: messageText
      }
    });

    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v19.0/${phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[WhatsApp Service] Message successfully delivered to ${cleanPhone}`);
          resolve({ success: true });
        } else {
          console.error(`[WhatsApp Service] Meta API error (${res.statusCode}):`, data);
          try {
            const parsed = JSON.parse(data);
            resolve({ success: false, error: parsed.error?.message || `Meta API Error ${res.statusCode}` });
          } catch {
            resolve({ success: false, error: `Meta API HTTP ${res.statusCode}` });
          }
        }
      });
    });

    req.on('error', (err) => {
      console.error('[WhatsApp Service] Network error sending WhatsApp message:', err);
      resolve({ success: false, error: err.message });
    });

    req.setTimeout(8000, () => {
      req.destroy();
      resolve({ success: false, error: 'WhatsApp request timed out (8s).' });
    });

    req.write(payload);
    req.end();
  });
}
