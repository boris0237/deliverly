export type ParsedWhatsAppOrderItem = {
  productName: string;
  quantity: number;
};

export type ParsedWhatsAppOrder = {
  customerName: string;
  customerPhone: string;
  address: string;
  notes: string;
  items: ParsedWhatsAppOrderItem[];
  orderTotal?: number;
};

function normalizeText(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function parseItemLine(line: string): ParsedWhatsAppOrderItem | null {
  const normalized = normalizeText(line).replace(/^[-*•]\s*/, '');
  if (!normalized) return null;

  const leftQty = normalized.match(/^(\d+)\s*[xX]\s+(.+)$/);
  if (leftQty) {
    const quantity = Number(leftQty[1] || 0);
    const productName = normalizeText(leftQty[2] || '');
    if (quantity > 0 && productName) return { productName, quantity };
  }

  const rightQty = normalized.match(/^(.+?)\s*[xX]\s*(\d+)$/);
  if (rightQty) {
    const productName = normalizeText(rightQty[1] || '');
    const quantity = Number(rightQty[2] || 0);
    if (quantity > 0 && productName) return { productName, quantity };
  }

  const withDash = normalized.match(/^(.+?)\s*[-:]\s*(\d+)$/);
  if (withDash) {
    const productName = normalizeText(withDash[1] || '');
    const quantity = Number(withDash[2] || 0);
    if (quantity > 0 && productName) return { productName, quantity };
  }

  return null;
}

function normalizeForMatch(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function extractPhoneFromLine(line: string): string {
  const candidates = line.match(/(?:\+?\d[\d\s().-]{6,}\d)/g) || [];
  for (const candidate of candidates) {
    const cleaned = candidate.replace(/[^\d+]/g, '');
    if (cleaned.replace(/\D/g, '').length >= 8) return cleaned;
  }
  return '';
}

function looksLikeAddressLine(line: string) {
  const normalized = normalizeForMatch(line);
  if (!normalized) return false;
  if (
    normalized.startsWith('address:') ||
    normalized.startsWith('adresse:') ||
    normalized.startsWith('quartier:') ||
    normalized.startsWith('lieu:') ||
    normalized.startsWith('location:')
  ) {
    return true;
  }
  return /^(adresse|address|quartier|lieu|location)\b/.test(normalized);
}

export function parseWhatsAppOrder(text: string, fallbackPhone = ''): ParsedWhatsAppOrder | null {
  const lines = normalizeText(text)
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);
  if (!lines.length) return null;

  let customerName = '';
  let customerPhone = '';
  let address = '';
  let orderTotal: number | null = null;
  const notesParts: string[] = [];
  const itemCandidates: ParsedWhatsAppOrderItem[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('client:') || lower.startsWith('customer:') || lower.startsWith('nom:') || lower.startsWith('name:')) {
      customerName = normalizeText(line.split(':').slice(1).join(':'));
      continue;
    }
    if (lower.startsWith('phone:') || lower.startsWith('tel:') || lower.startsWith('tél:') || lower.startsWith('telephone:')) {
      customerPhone = normalizeText(line.split(':').slice(1).join(':'));
      continue;
    }
    if (looksLikeAddressLine(line)) {
      const withSeparator = line.includes(':') ? normalizeText(line.split(':').slice(1).join(':')) : '';
      address = withSeparator || normalizeText(line.replace(/^(adresse|address|quartier|lieu|location)\s*/i, ''));
      continue;
    }
    if (orderTotal === null) {
      const totalMatch = line.match(/^(total|montant|somme|prix)\s*[:\-]?\s*([0-9][0-9\s.,]*)/i);
      if (totalMatch) {
        const raw = String(totalMatch[2] || '').replace(/\s/g, '').replace(',', '.');
        const numeric = Number(raw);
        if (Number.isFinite(numeric) && numeric > 0) {
          orderTotal = numeric;
          continue;
        }
      }
    }
    if (!customerPhone) {
      const guessedPhone = extractPhoneFromLine(line);
      if (guessedPhone) {
        customerPhone = guessedPhone;
        continue;
      }
    }
    const parsedItem = parseItemLine(line);
    if (parsedItem) {
      itemCandidates.push(parsedItem);
      continue;
    }
    notesParts.push(line);
  }

  const cleanedPhone = (customerPhone || fallbackPhone).replace(/[^\d+]/g, '');
  if (!cleanedPhone || !address || itemCandidates.length === 0) return null;

  const mergedByProduct = new Map<string, number>();
  for (const item of itemCandidates) {
    const key = item.productName.toLowerCase();
    mergedByProduct.set(key, Number(mergedByProduct.get(key) || 0) + item.quantity);
  }

  const items: ParsedWhatsAppOrderItem[] = [];
  for (const [key, quantity] of mergedByProduct.entries()) {
    const name = itemCandidates.find((candidate) => candidate.productName.toLowerCase() === key)?.productName || key;
    items.push({ productName: name, quantity });
  }
  if (!items.length) return null;

  return {
    customerName: customerName || cleanedPhone || 'Client WhatsApp',
    customerPhone: cleanedPhone,
    address,
    notes: notesParts.join(' ').trim(),
    items,
    orderTotal: orderTotal ?? undefined,
  };
}
