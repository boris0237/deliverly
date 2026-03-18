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
  const fromName = process.env.MAILJET_FROM_NAME || 'Delivoo';

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

type BulkRecipient = { email: string; name?: string; companyName?: string };

export async function sendBulkMailWithMailjet(input: {
  subject: string;
  text: string;
  html: string;
  recipients: BulkRecipient[];
}): Promise<void> {
  const apiKey = process.env.MAILJET_API_KEY;
  const apiSecret = process.env.MAILJET_SECRET_KEY;
  const fromEmail = process.env.MAILJET_FROM_EMAIL;
  const fromName = process.env.MAILJET_FROM_NAME || 'Delivoo';

  if (!apiKey || !apiSecret || !fromEmail) {
    throw new Error('Missing MAILJET_API_KEY, MAILJET_SECRET_KEY or MAILJET_FROM_EMAIL environment variables');
  }

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const chunkSize = 50;
  for (let i = 0; i < input.recipients.length; i += chunkSize) {
    const chunk = input.recipients.slice(i, i + chunkSize);
    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Messages: chunk.map((recipient) => ({
          From: { Email: fromEmail, Name: fromName },
          To: [{ Email: recipient.email, Name: recipient.name }],
          Subject: input.subject,
          TextPart: input.text,
          HTMLPart: input.html,
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mailjet error (${response.status}): ${body}`);
    }
  }
}

export async function sendBulkMailWithMailjetResults(input: {
  subject: string;
  text: string;
  html: string;
  recipients: BulkRecipient[];
}): Promise<{ sent: string[]; failed: Array<{ email: string; error: string }> }> {
  const apiKey = process.env.MAILJET_API_KEY;
  const apiSecret = process.env.MAILJET_SECRET_KEY;
  const fromEmail = process.env.MAILJET_FROM_EMAIL;
  const fromName = process.env.MAILJET_FROM_NAME || 'Delivoo';

  if (!apiKey || !apiSecret || !fromEmail) {
    throw new Error('Missing MAILJET_API_KEY, MAILJET_SECRET_KEY or MAILJET_FROM_EMAIL environment variables');
  }

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const chunkSize = 50;
  const sent: string[] = [];
  const failed: Array<{ email: string; error: string }> = [];

  const applyTemplate = (value: string, recipient: BulkRecipient) =>
    value
      .replace(/\{name\}/gi, recipient.name || '')
      .replace(/\{companyName\}/gi, recipient.companyName || '')
      .replace(/\{email\}/gi, recipient.email || '');

  for (let i = 0; i < input.recipients.length; i += chunkSize) {
    const chunk = input.recipients.slice(i, i + chunkSize);
    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Messages: chunk.map((recipient) => ({
          From: { Email: fromEmail, Name: fromName },
          To: [{ Email: recipient.email, Name: recipient.name }],
          Subject: applyTemplate(input.subject, recipient),
          TextPart: applyTemplate(input.text, recipient),
          HTMLPart: applyTemplate(input.html, recipient),
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      chunk.forEach((recipient) => failed.push({ email: recipient.email, error: body }));
      continue;
    }

    // Mailjet returns per-message status, but chunked success is enough for basic stats.
    chunk.forEach((recipient) => sent.push(recipient.email));
  }

  return { sent, failed };
}
