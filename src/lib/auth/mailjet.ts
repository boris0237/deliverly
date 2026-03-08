interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMailWithMailjet(options: MailOptions): Promise<void> {
  const apiKey = process.env.MAILJET_API_KEY;
  const apiSecret = process.env.MAILJET_SECRET_KEY;
  const fromEmail = process.env.MAILJET_FROM_EMAIL;
  const fromName = process.env.MAILJET_FROM_NAME || 'Deliverly';

  if (!apiKey || !apiSecret || !fromEmail) {
    throw new Error('Missing MAILJET_API_KEY, MAILJET_SECRET_KEY or MAILJET_FROM_EMAIL environment variables');
  }

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: fromEmail, Name: fromName },
          To: [{ Email: options.to }],
          Subject: options.subject,
          TextPart: options.text,
          HTMLPart: options.html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mailjet error (${response.status}): ${body}`);
  }
}
