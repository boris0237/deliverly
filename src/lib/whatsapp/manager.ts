import 'server-only';
import { createRequire } from 'module';
import { randomToken } from '@/lib/auth/crypto';
import { CompanyModel, WhatsAppConnectionModel, WhatsAppGroupBindingModel, WhatsAppInboundMessageModel } from '@/lib/auth/db';
import { emitWhatsAppRealtimeEvent } from '@/lib/realtime/socket-server';
import { parseWhatsAppOrder } from './order-parser';
import { parseWhatsAppOrderWithAI } from './order-parser-ai';
import { createDeliveryFromWhatsAppOrder } from './delivery-import';

type SocketContext = {
  socket: any;
  connectionId: string;
  companyId: string;
};

const sockets = new Map<string, SocketContext>();
let bootstrapPromise: Promise<void> | null = null;

type FsPromisesModule = {
  mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
};

type PathModule = {
  join: (...parts: string[]) => string;
};

const require = createRequire(import.meta.url);

function getFsPromises(): FsPromisesModule {
  return require('node:fs/promises') as FsPromisesModule;
}

function getPathModule(): PathModule {
  return require('node:path') as PathModule;
}

function authDirFor(connectionId: string) {
  return getPathModule().join(process.cwd(), '.baileys-auth', connectionId);
}

async function loadBaileys(): Promise<any> {
  const importer = new Function('m', 'return import(m);') as (m: string) => Promise<any>;
  return importer('baileys');
}

function extractTextFromMessageContent(message: any): string {
  if (!message) return '';
  const unwrapped =
    message?.ephemeralMessage?.message ||
    message?.viewOnceMessage?.message ||
    message?.viewOnceMessageV2?.message ||
    message?.viewOnceMessageV2Extension?.message ||
    message?.deviceSentMessage?.message ||
    message;
  if (unwrapped && unwrapped !== message) {
    return extractTextFromMessageContent(unwrapped);
  }
  return (
    unwrapped?.conversation ||
    unwrapped?.extendedTextMessage?.text ||
    unwrapped?.imageMessage?.caption ||
    unwrapped?.videoMessage?.caption ||
    unwrapped?.documentMessage?.caption ||
    unwrapped?.buttonsResponseMessage?.selectedDisplayText ||
    unwrapped?.listResponseMessage?.title ||
    unwrapped?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    unwrapped?.templateButtonReplyMessage?.selectedDisplayText ||
    unwrapped?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    ''
  );
}

async function persistGroupList(input: { companyId: string; connectionId: string; groups: Array<{ id: string; subject: string }> }) {
  const existingBindings = await WhatsAppGroupBindingModel.find({
    companyId: input.companyId,
    connectionId: input.connectionId,
  }).lean();
  const existingByJid = new Map(existingBindings.map((binding) => [binding.groupJid, binding]));
  const now = new Date();

  for (const group of input.groups) {
      const existing = existingByJid.get(group.id);
      const safeGroupName = String(group.subject || group.id || '').trim();
      if (existing) {
        await WhatsAppGroupBindingModel.updateOne(
          { id: existing.id },
          { $set: { groupName: safeGroupName, updatedAt: now } }
        );
        continue;
      }
      await WhatsAppGroupBindingModel.create({
      id: randomToken(12),
        companyId: input.companyId,
        connectionId: input.connectionId,
        groupJid: group.id,
        groupName: safeGroupName,
        partnerId: '',
        isActive: false,
      notifyOnStatusUpdates: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  emitWhatsAppRealtimeEvent({
    companyId: input.companyId,
    connectionId: input.connectionId,
    type: 'groups',
  });
}

async function handleInboundGroupMessage(input: {
  companyId: string;
  connectionId: string;
  groupJid: string;
  senderJid: string;
  senderName: string;
  messageId: string;
  text: string;
}) {
  const binding = await WhatsAppGroupBindingModel.findOne({
    companyId: input.companyId,
    connectionId: input.connectionId,
    groupJid: input.groupJid,
    partnerId: { $exists: true, $nin: ['', null] },
    isActive: true,
  })
    .select({ _id: 0, id: 1 })
    .lean();
    console.log(`Found binding for group ${input.groupJid}: ${binding ? binding.id : 'none'}`);
  if (!binding) return;

  const normalizedText = String(input.text || '').trim();
  if (!normalizedText) return;
  const fallbackPhone = String(input.senderJid || '').replace(/[^\d+]/g, '');

  const existing = await WhatsAppInboundMessageModel.findOne({
    companyId: input.companyId,
    connectionId: input.connectionId,
    messageId: input.messageId,
  }).lean();
  if (existing) return;

  const logId = randomToken(12);
  await WhatsAppInboundMessageModel.create({
    id: logId,
    companyId: input.companyId,
    connectionId: input.connectionId,
    groupJid: input.groupJid,
    senderJid: input.senderJid,
    senderName: input.senderName,
    messageId: input.messageId,
    rawText: normalizedText,
    status: 'received',
  });

  try {
    const parsed =
      (await parseWhatsAppOrderWithAI({
        text: normalizedText,
        fallbackPhone,
        language: 'fr',
      })) || parseWhatsAppOrder(normalizedText, fallbackPhone);
      console.log(`Parsed order for message ${input.messageId}: ${parsed ? JSON.stringify(parsed) : 'none'}`);
    if (!parsed) {
      await WhatsAppInboundMessageModel.updateOne(
        { id: logId },
        {
          $set: {
            status: 'failed',
            errorCode: 'WHATSAPP_ORDER_PARSE_FAILED',
            errorMessage: 'Unable to parse order message',
            updatedAt: new Date(),
          },
        }
      );
      return;
    }

    await WhatsAppInboundMessageModel.updateOne(
      { id: logId },
      {
        $set: {
          status: 'parsed',
          parsedPayload: parsed,
          updatedAt: new Date(),
        },
      }
    );

    const created = await createDeliveryFromWhatsAppOrder({
      companyId: input.companyId,
      connectionId: input.connectionId,
      groupJid: input.groupJid,
      senderName: input.senderName,
      senderJid: input.senderJid,
      order: parsed,
    });

    await WhatsAppInboundMessageModel.updateOne(
      { id: logId },
      {
        $set: {
          status: 'processed',
          createdDeliveryId: created.id,
          updatedAt: new Date(),
        },
      }
    );
    await WhatsAppInboundMessageModel.updateOne(
      {
        companyId: input.companyId,
        connectionId: input.connectionId,
        messageId: input.messageId,
      },
      {
        $set: {
          createdDeliveryId: created.id,
          updatedAt: new Date(),
        },
      }
    );
    await WhatsAppGroupBindingModel.updateOne(
      { companyId: input.companyId, connectionId: input.connectionId, groupJid: input.groupJid },
      { $set: { lastInboundAt: new Date(), updatedAt: new Date() } }
    );
    emitWhatsAppRealtimeEvent({
      companyId: input.companyId,
      connectionId: input.connectionId,
      type: 'inbound',
    });
  } catch (error) {
    await WhatsAppInboundMessageModel.updateOne(
      { id: logId },
      {
        $set: {
          status: 'failed',
          errorCode: 'WHATSAPP_ORDER_PROCESS_FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unexpected error',
          updatedAt: new Date(),
        },
      }
    );
  }
}

export async function connectWhatsAppConnection(input: { companyId: string; connectionId: string }) {
  const existing = sockets.get(input.connectionId);
  if (existing) return;

  await getFsPromises().mkdir(authDirFor(input.connectionId), { recursive: true });
  const baileys = await loadBaileys();
  const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;
  const { state, saveCreds } = await useMultiFileAuthState(authDirFor(input.connectionId));
  const { version } = await fetchLatestBaileysVersion();

  await WhatsAppConnectionModel.updateOne(
    { id: input.connectionId, companyId: input.companyId },
    {
      $set: {
        status: 'connecting',
        lastError: '',
        reconnectAttempts: 0,
        updatedAt: new Date(),
      },
    }
  );

  const socket = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    browser: ['Deliverly Assistant', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  });
  sockets.set(input.connectionId, { socket, connectionId: input.connectionId, companyId: input.companyId });

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update: any) => {
    if (update?.qr) {
      await WhatsAppConnectionModel.updateOne(
        { id: input.connectionId, companyId: input.companyId },
        {
          $set: {
            status: 'qr',
            qrCode: update.qr,
            updatedAt: new Date(),
          },
        }
      );
      emitWhatsAppRealtimeEvent({
        companyId: input.companyId,
        connectionId: input.connectionId,
        type: 'connection',
      });
    }
    if (update?.connection === 'open') {
      await WhatsAppConnectionModel.updateOne(
        { id: input.connectionId, companyId: input.companyId },
        {
          $set: {
            status: 'connected',
            qrCode: '',
            phoneNumber: String(socket?.user?.id || '').split(':')[0],
            displayName: String(socket?.user?.name || ''),
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
      emitWhatsAppRealtimeEvent({
        companyId: input.companyId,
        connectionId: input.connectionId,
        type: 'connection',
      });
      try {
        const groups = await socket.groupFetchAllParticipating();
        const groupRows = Object.values(groups || {}).map((group: any) => ({
          id: String(group.id || ''),
          subject: String(group.subject || ''),
        }));
        await persistGroupList({ companyId: input.companyId, connectionId: input.connectionId, groups: groupRows });
      } catch (error) {
        await WhatsAppConnectionModel.updateOne(
          { id: input.connectionId, companyId: input.companyId },
          {
            $set: {
              lastError: error instanceof Error ? error.message : 'Group sync failed on connection open',
              updatedAt: new Date(),
            },
          }
        );
      }
    }
    if (update?.connection === 'close') {
      await WhatsAppConnectionModel.updateOne(
        { id: input.connectionId, companyId: input.companyId },
        {
          $set: {
            status: 'disconnected',
            updatedAt: new Date(),
          },
        }
      );
      sockets.delete(input.connectionId);
      emitWhatsAppRealtimeEvent({
        companyId: input.companyId,
        connectionId: input.connectionId,
        type: 'connection',
      });
    }
  });

  socket.ev.on('messages.upsert', async (event: any) => {
    const messages = Array.isArray(event?.messages) ? event.messages : [];
    for (const message of messages) {
      const remoteJid = String(message?.key?.remoteJid || '');
      if (!remoteJid || !remoteJid.endsWith('@g.us')) continue;
      //if (message?.key?.) continue;
      const text = extractTextFromMessageContent(message.message);
      console.log(`Extracted text: ${text}`);
      if (!text) continue;
      await handleInboundGroupMessage({
        companyId: input.companyId,
        connectionId: input.connectionId,
        groupJid: remoteJid,
        senderJid: String(message?.key?.participant || ''),
        senderName: String(message?.pushName || ''),
        messageId: String(message?.key?.id || randomToken(6)),
        text,
      });
    }
  });
}

export async function disconnectWhatsAppConnection(input: { companyId: string; connectionId: string }) {
  const context = sockets.get(input.connectionId);
  if (context?.socket) {
    try {
      await context.socket.logout();
    } catch {
      // ignore
    }
    sockets.delete(input.connectionId);
  }
  await WhatsAppConnectionModel.updateOne(
    { id: input.connectionId, companyId: input.companyId },
    {
      $set: {
        status: 'disconnected',
        qrCode: '',
        updatedAt: new Date(),
      },
    }
  );
  emitWhatsAppRealtimeEvent({
    companyId: input.companyId,
    connectionId: input.connectionId,
    type: 'connection',
  });
}

export async function sendWhatsAppGroupMessage(input: {
  companyId: string;
  connectionId: string;
  groupJid: string;
  message: string;
  quoted?: { messageId: string; participant?: string; text?: string };
}) {
  let context = sockets.get(input.connectionId);
  if (!context?.socket) {
    await connectWhatsAppConnection({ companyId: input.companyId, connectionId: input.connectionId });
    context = sockets.get(input.connectionId);
  }
  if (!context?.socket) throw new Error('WHATSAPP_NOT_CONNECTED');
  const quotedMessageId = String(input.quoted?.messageId || '').trim();
  const quotedParticipant = String(input.quoted?.participant || '').trim();
  const quotedText = String(input.quoted?.text || '').trim();
  const canQuote = quotedMessageId && quotedParticipant && quotedText;
  if (canQuote) {
    try {
      await context.socket.sendMessage(
        input.groupJid,
        { text: input.message },
        {
          quoted: {
            key: {
              remoteJid: input.groupJid,
              id: quotedMessageId,
              fromMe: false,
              participant: quotedParticipant,
            },
            message: {
              conversation: quotedText,
            },
          },
        }
      );
    } catch (error) {
      console.log('Error sending quoted message', error);
      await context.socket.sendMessage(input.groupJid, { text: input.message });
    }
  } else {
    await context.socket.sendMessage(input.groupJid, { text: input.message });
  }
  await WhatsAppGroupBindingModel.updateOne(
    { companyId: input.companyId, connectionId: input.connectionId, groupJid: input.groupJid },
    { $set: { lastOutboundAt: new Date(), updatedAt: new Date() } }
  );
}

export async function syncWhatsAppGroups(input: { companyId: string; connectionId: string }) {
  const context = sockets.get(input.connectionId);
  if (!context?.socket) {
    throw new Error('WHATSAPP_NOT_CONNECTED');
  }
  const groups = await context.socket.groupFetchAllParticipating();
  const groupRows = Object.values(groups || {}).map((group: any) => ({
    id: String(group.id || ''),
    subject: String(group.subject || ''),
  }));
  await persistGroupList({ companyId: input.companyId, connectionId: input.connectionId, groups: groupRows });
}

export async function bootstrapWhatsAppConnections() {
  const companies = await CompanyModel.find({ isActive: true }).select({ _id: 0, id: 1 }).lean();
  if (!companies.length) return;

  const rows = await WhatsAppConnectionModel.find({
    companyId: { $in: companies.map((company) => company.id) },
    status: { $in: ['connected', 'connecting', 'qr'] },
  })
    .select({ _id: 0, id: 1, companyId: 1 })
    .lean();

  for (const row of rows) {
    if (sockets.has(row.id)) continue;
    try {
      await connectWhatsAppConnection({ companyId: String(row.companyId), connectionId: String(row.id) });
    } catch {
      await WhatsAppConnectionModel.updateOne(
        { id: row.id },
        {
          $set: {
            status: 'error',
            lastError: 'Bootstrap failed',
            updatedAt: new Date(),
          },
        }
      );
    }
  }
}

export async function ensureWhatsAppBootstrap() {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapWhatsAppConnections().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }
  await bootstrapPromise;
}
