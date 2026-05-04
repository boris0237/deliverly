import 'server-only';
import OpenAI from 'openai';
import type { ParsedWhatsAppOrder } from './order-parser';

function sanitizePhone(value: string, fallback = '') {
  const cleaned = String(value || fallback || '').replace(/[^\d+]/g, '');
  return cleaned;
}

function normalizeParsedOrder(value: unknown, fallbackPhone = ''): ParsedWhatsAppOrder | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const customerPhone = sanitizePhone(String(row.customerPhone || ''), fallbackPhone);
  const customerName = String(row.customerName || customerPhone).trim() || customerPhone;
  const address = String(row.address || '').trim();
  const notes = String(row.notes || '').trim();
  const orderTotalRaw = row.orderTotal ?? row.total ?? row.amount;
  const orderTotal = Number(String(orderTotalRaw || '').replace(/\s/g, '').replace(',', '.'));
  const itemsRaw = Array.isArray(row.items) ? row.items : [];
  const items = itemsRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const data = item as Record<string, unknown>;
      const productName = String(data.productName || '').trim();
      const quantity = Number(data.quantity || 0);
      if (!productName || !Number.isFinite(quantity) || quantity <= 0) return null;
      return { productName, quantity: Math.round(quantity) };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!customerPhone || !address || !items.length) return null;
  return {
    customerName,
    customerPhone,
    address,
    notes,
    items,
    orderTotal: Number.isFinite(orderTotal) && orderTotal > 0 ? orderTotal : undefined,
  };
}

function tryParseJson(raw: string): unknown {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function parseWhatsAppOrderWithAI(input: { text: string; fallbackPhone?: string; language?: string }) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const model = String(process.env.OPENAI_MODEL || 'gpt-5-nano').trim();
  const sourceText = String(input.text || '').trim();
  if (!sourceText) return null;

  const prompt = [
    'Extract a delivery order from the WhatsApp message below.',
    'Return ONLY valid JSON with shape:',
    '{"customerName":"string","customerPhone":"string","address":"string","notes":"string","orderTotal":12345,"items":[{"productName":"string","quantity":1}]}',
    'Rules:',
    '- Do not invent Phone numbers, names, addresses, products. If not explicitly mentioned in the message, leave them empty (for strings) or 0 (for numbers).',
    '- Use sender phone as fallback if provided and no phone in message.',
    '- Do not invent products. Items must come from message content.',
    '- quantity must be integer >= 1.',
    '- If message is not an order, return {"customerName":"","customerPhone":"","address":"","notes":"","orderTotal":0,"items":[]}.',
    `Fallback sender phone: ${String(input.fallbackPhone || '')}`,
    `Message language hint: ${String(input.language || 'auto')}`,
    '',
    sourceText,
  ].join('\n');

  try {
    const response = await client.responses.create({
      model,
      input: prompt,
    });
    console.log(`OpenAI API response: ${JSON.stringify(response)}`);
    const parsed = tryParseJson(String(response.output_text || ''));
    return normalizeParsedOrder(parsed, input.fallbackPhone || '');
  } catch (error) {
    console.error('Error calling OpenAI API for WhatsApp order parsing', error);
    return null;
  }
}
