import { CompanyModel, DeliveryModel, WhatsAppConnectionModel, WhatsAppGroupBindingModel, WhatsAppInboundMessageModel } from '@/lib/auth/db';
import { sendWhatsAppGroupMessage } from './manager';
import { json } from 'zod';

type Locale = 'fr' | 'en';

const STATUS_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    pending: 'En attente',
    assigned: 'Assignée',
    pickedUp: 'Recuperée',
    inTransit: 'En cours',
    delivered: 'Livrée',
    failed: 'Echouee',
    cancelled: 'Annulée',
  },
  en: {
    pending: 'Pending',
    assigned: 'Assigned',
    pickedUp: 'Picked up',
    inTransit: 'In transit',
    delivered: 'Delivered',
    failed: 'Failed',
    cancelled: 'Cancelled',
  },
};

const CANCELLATION_REASON_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    no_response: "Ne repond pas",
    postponed_later: "Reporté a une date ulterieure",
    postponed: "Reporté a une date ulterieure",
    not_satisfied: "Pas satisfait",
    phone_off: "Telephone fermé",
    will_call_back: "Va rappeler",
    call_rejected: "Appel rejeté",
    already_delivered: "Deja livre",
    afternoon: "Apres midi",
    evening: "En soiree",
    cancelled_by_customer: "Annulé par le client",
    already_delivered_other_driver: "Déja livré par un autre livreur",
    item_unavailable: "Article non disponible",
    awaiting_payment: "En attente de paiement",
    other: "Autre",
  },
  en: {
    no_response: "No response",
    postponed_later: "Rescheduled",
    postponed: "Rescheduled",
    not_satisfied: "Not satisfied",
    phone_off: "Phone off",
    will_call_back: "Will call back",
    call_rejected: "Call rejected",
    already_delivered: "Already delivered",
    afternoon: "Afternoon",
    evening: "Evening",
    cancelled_by_customer: "Cancelled",
    already_delivered_other_driver: "Already delivered by another driver",
    item_unavailable: "Item unavailable",
    awaiting_payment: "Awaiting payment",
    other: "Other",
  },
};

export async function notifyDeliveryStatusToWhatsAppGroup(input: {
  companyId: string;
  deliveryId: string;
  status: string;
  partnerId: string;
  customerName: string;
  customerPhone?: string;
  address: string;
  cancellationReason?: string;
  cancellationNote?: string;
  rescheduledDate?: Date | string | null;
  locale?: Locale;
}) {
  if (!input.partnerId) return;

  const [connection, bindings] = await Promise.all([
    WhatsAppConnectionModel.findOne({ companyId: input.companyId }).sort({ updatedAt: -1 }).lean(),
    WhatsAppGroupBindingModel.find({
      companyId: input.companyId,
      partnerId: input.partnerId,
      isActive: true,
      notifyOnStatusUpdates: true,
    }).lean(),
  ]);
  if (!connection || !bindings.length) return;

  const defaultLocaleEnv = String(process.env.WHATSAPP_DEFAULT_LOCALE || '').toLowerCase();
  let locale: Locale = input.locale === 'en' || defaultLocaleEnv === 'en' ? 'en' : 'fr';
  const company = await CompanyModel.findOne({ id: input.companyId }).select({ whatsappDefaultLocale: 1 }).lean();
  if (company?.whatsappDefaultLocale === 'en') locale = 'en';
  if (company?.whatsappDefaultLocale === 'fr') locale = 'fr';
  const statusLabel = STATUS_LABELS[locale][input.status] || input.status;
  const statusEmoji = STATUS_EMOJIS[input.status] ? `${STATUS_EMOJIS[input.status]} ` : '';
  const rescheduledDateLabel =
    input.rescheduledDate && !Number.isNaN(new Date(input.rescheduledDate).getTime())
      ? new Date(input.rescheduledDate).toLocaleDateString(locale)
      : '';
  const reasonLabel = input.cancellationReason
    ? CANCELLATION_REASON_LABELS[locale][input.cancellationReason] || input.cancellationReason
    : '';
  const reasonPrefix = locale === 'fr' ? 'Motif' : 'Reason';
  const notePrefix = locale === 'fr' ? 'Note' : 'Note';
  const reschedulePrefix = locale === 'fr' ? 'Nouvelle date' : 'New date';
  const statusPrefix = locale === 'fr' ? 'Statut' : 'Status';
  const customerPrefix = locale === 'fr' ? 'Client' : 'Customer';
  const addressPrefix = locale === 'fr' ? 'Adresse' : 'Address';
  const reasonLine = reasonLabel ? `\n${reasonPrefix}: ${reasonLabel}` : '';
  const noteLine = input.cancellationNote ? `\n${notePrefix}: ${input.cancellationNote}` : '';
  const rescheduleLine = rescheduledDateLabel ? `\n${reschedulePrefix}: ${rescheduledDateLabel}` : '';
  const customerValue = input.customerPhone || input.customerName || '-';
  const text =
    `📦 Livraison #${input.deliveryId}\n` +
    `${statusPrefix}: ${statusEmoji}${statusLabel}\n` +
    `${customerPrefix}: ${customerValue}\n` +
    `${addressPrefix}: ${input.address || '-'}${reasonLine}${rescheduleLine}${noteLine}`;

  for (const binding of bindings) {
    const lastInbound =
      (await WhatsAppInboundMessageModel.findOne({
        companyId: input.companyId,
        groupJid: binding.groupJid,
        createdDeliveryId: input.deliveryId,
      })
        .sort({ createdAt: -1 })
        .select({ messageId: 1, senderJid: 1, rawText: 1 })
        .lean()) ||
      (await WhatsAppInboundMessageModel.findOne({
        companyId: input.companyId,
        groupJid: binding.groupJid,
        status: { $in: ['parsed', 'processed'] },
      })
        .sort({ createdAt: -1 })
        .select({ messageId: 1, senderJid: 1, rawText: 1 })
        .lean());
    try {
      await sendWhatsAppGroupMessage({
        companyId: input.companyId,
        connectionId: connection.id,
        groupJid: binding.groupJid,
        message: text,
        quoted: lastInbound?.messageId
          ? {
              messageId: String(lastInbound.messageId),
              participant: String(lastInbound.senderJid || ''),
              text: String(lastInbound.rawText || ''),
            }
          : undefined,
      });
    } catch (error) {
      console.error('Error sending WhatsApp group message', error);
      // keep delivery flow resilient if WhatsApp send fails
    }
  }
}

export async function notifyNewDeliveryToWhatsAppGroup(input: { companyId: string; deliveryId: string; locale?: Locale }) {
  const delivery = await DeliveryModel.findOne({ id: input.deliveryId, companyId: input.companyId }).lean();
  console.log(`Notifying WhatsApp groups about new delivery ${JSON.stringify(delivery)}: ${delivery ? 'found' : 'not found'}`);
  if (!delivery) return;
  await notifyDeliveryStatusToWhatsAppGroup({
    companyId: input.companyId,
    deliveryId: delivery.id,
    status: String(delivery.status || 'pending'),
    partnerId: String(delivery.partnerId || ''),
    customerName: String(delivery.customerName || ''),
    customerPhone: String(delivery.customerPhone || ''),
    address: String(delivery.address || ''),
    cancellationReason: String(delivery.cancellationReason || ''),
    cancellationNote: String(delivery.cancellationNote || ''),
    rescheduledDate: delivery.rescheduledDate || null,
    locale: input.locale,
  });
}
const STATUS_EMOJIS: Record<string, string> = {
  pending: '⏳',
  assigned: '👤',
  pickedUp: '📦',
  inTransit: '🚚',
  delivered: '✅',
  failed: '⚠️',
  cancelled: '❌',
};
