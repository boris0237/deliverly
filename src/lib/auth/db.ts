import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import type { UserRole } from '@/types';

const MONGODB_URI = process.env.MONGODB_URI;
const USER_ROLES: UserRole[] = ['superAdmin', 'admin', 'manager', 'stockManager', 'partnerManager', 'driver', 'accountant'];
const AUTH_TOKEN_TYPES = ['verify_email', 'reset_password'] as const;

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI environment variable');
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache || { conn: null, promise: null };

if (!global._mongooseCache) {
  global._mongooseCache = cache;
}

export async function connectDb(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(MONGODB_URI as string, {
        dbName: process.env.MONGODB_DB || 'deliverly',
      })
      .catch((error: unknown) => {
        cache.promise = null;
        throw error;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

const userSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, default: '' },
    avatar: { type: String, default: '' },
    vehicleId: { type: String, default: '' },
    currentLocation: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },
    companyId: { type: String, required: true, index: true },
    role: { type: String, enum: USER_ROLES, required: true, default: 'admin' },
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

const companySchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: true },
    ownerUserId: { type: String, default: null, index: true },
    logo: { type: String, default: '' },
    address: { type: String, default: '' },
    whatsappDefaultLocale: { type: String, default: 'fr' },
    businessHours: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '18:00' },
      days: { type: [Number], default: [1, 2, 3, 4, 5] },
    },
    deliveryPricing: {
      currency: { type: String, default: 'XAF' },
      fixed: {
        enabled: { type: Boolean, default: false },
        amount: { type: Number, default: 0 },
      },
      package: {
        enabled: { type: Boolean, default: false },
        plans: {
          type: [
            {
              id: { type: String, required: true },
              name: { type: String, required: true },
              amount: { type: Number, required: true },
            },
          ],
          default: [],
        },
      },
      percentage: {
        enabled: { type: Boolean, default: false },
        value: { type: Number, default: 0 },
      },
      zone: {
        enabled: { type: Boolean, default: false },
        zones: {
          type: [
            {
              id: { type: String, required: true },
              name: { type: String, required: true },
              amount: { type: Number, required: true },
              neighborhoods: {
                type: [
                  {
                    id: { type: String, required: true },
                    name: { type: String, required: true },
                    address: { type: String, default: '' },
                    latitude: { type: Number, required: true },
                    longitude: { type: Number, required: true },
                    placeId: { type: String, default: '' },
                  },
                ],
                default: [],
              },
            },
          ],
          default: [],
        },
      },
    },
    notificationSettings: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
    },
    vehicles: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
          type: { type: String, required: true },
          plateNumber: { type: String, required: true },
          capacityKg: { type: Number, default: 0 },
          isActive: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const companyMemberSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    companyId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: USER_ROLES, required: true, default: 'admin' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

companyMemberSchema.index({ companyId: 1, userId: 1 }, { unique: true });

const partnerSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    companyId: { type: String, required: true, index: true },
    name: { type: String, required: true, index: true },
    type: { type: String, enum: ['restaurant', 'shop', 'pharmacy', 'ecommerce', 'other'], required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    logo: { type: String, default: '' },
    commissionRate: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    pricing: {
      type: { type: String, enum: ['fixed', 'package', 'percentage', 'zone'], required: true, default: 'fixed' },
      currency: { type: String, default: 'XAF' },
      useDefaultValue: { type: Boolean, default: true },
      fixedAmount: { type: Number, default: 0 },
      percentageValue: { type: Number, default: 0 },
      packagePlanId: { type: String, default: '' },
      packagePlanName: { type: String, default: '' },
      zoneId: { type: String, default: '' },
      zoneName: { type: String, default: '' },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const deliverySchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    companyId: { type: String, required: true, index: true },
    partnerId: { type: String, required: true, index: true },
    driverId: { type: String, default: '', index: true },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, required: true },
    address: { type: String, required: true },
    neighborhoodId: { type: String, default: '' },
    deliveryDate: { type: Date, required: true, index: true },
    orderValue: { type: Number, required: true, min: 0 },
    collectFromCustomer: { type: Boolean, required: true, default: true },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    partnerExtraCharge: { type: Number, required: true, min: 0, default: 0 },
    items: {
      type: [
        {
          productId: { type: String, required: true },
          productName: { type: String, required: true },
          quantity: { type: Number, required: true, min: 1 },
          unitPrice: { type: Number, required: true, min: 0 },
          total: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },
    logs: {
      type: [
        {
          id: { type: String, required: true },
          action: { type: String, required: true },
          message: { type: String, default: '' },
          actorId: { type: String, default: '' },
          actorName: { type: String, default: '' },
          createdAt: { type: Date, required: true },
        },
      ],
      default: [],
    },
    cancellationReason: { type: String, default: '' },
    cancellationNote: { type: String, default: '' },
    rescheduledDate: { type: Date },
    accountingDate: { type: Date, index: true },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'pickedUp', 'inTransit', 'delivered', 'failed', 'cancelled'],
      required: true,
      default: 'pending',
      index: true,
    },
    createdBy: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

const productSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    companyId: { type: String, required: true, index: true },
    name: { type: String, required: true, index: true },
    sku: { type: String, required: true, index: true },
    category: { type: String, default: '' },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    stockQuantity: { type: Number, required: true, min: 0, default: 0 },
    minStockLevel: { type: Number, required: true, min: 0, default: 0 },
    partnerId: { type: String, default: '' },
    warehouseLocation: { type: String, default: '' },
    image: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const expenseSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    companyId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, enum: ['fuel', 'maintenance', 'salaries', 'equipment', 'other'], required: true, default: 'other' },
    date: { type: Date, required: true, index: true },
    targetType: { type: String, enum: ['partner', 'user', 'vehicle', 'other'], required: true, default: 'other', index: true },
    targetId: { type: String, default: '', index: true },
    targetLabel: { type: String, default: '' },
    description: { type: String, default: '' },
    receipt: { type: String, default: '' },
    createdBy: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

const remittanceSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    companyId: { type: String, required: true, index: true },
    partnerId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'XAF' },
    note: { type: String, default: '' },
    remittanceDate: { type: Date, required: true, index: true },
    createdBy: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

const stockMovementSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    companyId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    type: { type: String, enum: ['entry', 'exit', 'transfer', 'adjustment'], required: true },
    quantity: { type: Number, required: true, min: 1 },
    previousStock: { type: Number, required: true, min: 0 },
    newStock: { type: Number, required: true, min: 0 },
    reason: { type: String, default: '' },
    performedBy: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const notificationSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    companyId: { type: String, required: true, index: true },
    type: { type: String, enum: ['delivery', 'driver', 'inventory', 'system'], required: true, default: 'system' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const authTokenSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: AUTH_TOKEN_TYPES, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const sessionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const whatsappConnectionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    companyId: { type: String, required: true, index: true },
    ownerUserId: { type: String, required: true, index: true },
    displayName: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    status: { type: String, enum: ['disconnected', 'connecting', 'qr', 'connected', 'error'], default: 'disconnected', index: true },
    qrCode: { type: String, default: '' },
    lastError: { type: String, default: '' },
    lastSeenAt: { type: Date, default: null },
    reconnectAttempts: { type: Number, default: 0 },
    workerKey: { type: String, default: '' },
  },
  { timestamps: true }
);

const whatsappGroupBindingSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    companyId: { type: String, required: true, index: true },
    connectionId: { type: String, required: true, index: true },
    groupJid: { type: String, required: true, index: true },
    groupName: { type: String, default: '' },
    partnerId: { type: String, default: '', index: true },
    isActive: { type: Boolean, default: true, index: true },
    notifyOnStatusUpdates: { type: Boolean, default: true },
    lastInboundAt: { type: Date, default: null },
    lastOutboundAt: { type: Date, default: null },
  },
  { timestamps: true }
);
whatsappGroupBindingSchema.index({ companyId: 1, connectionId: 1, groupJid: 1 }, { unique: true });

const whatsappInboundMessageSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    companyId: { type: String, required: true, index: true },
    connectionId: { type: String, required: true, index: true },
    groupJid: { type: String, required: true, index: true },
    senderJid: { type: String, default: '' },
    senderName: { type: String, default: '' },
    messageId: { type: String, default: '', index: true },
    rawText: { type: String, default: '' },
    status: { type: String, enum: ['received', 'parsed', 'processed', 'failed'], default: 'received', index: true },
    errorCode: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
    parsedPayload: { type: Schema.Types.Mixed, default: {} },
    createdDeliveryId: { type: String, default: '' },
  },
  { timestamps: true }
);
whatsappInboundMessageSchema.index({ companyId: 1, connectionId: 1, messageId: 1 }, { unique: true, sparse: true });

export type UserDoc = InferSchemaType<typeof userSchema>;
export type CompanyDoc = InferSchemaType<typeof companySchema>;
export type CompanyMemberDoc = InferSchemaType<typeof companyMemberSchema>;
export type PartnerDoc = InferSchemaType<typeof partnerSchema>;
export type DeliveryDoc = InferSchemaType<typeof deliverySchema>;
export type ProductDoc = InferSchemaType<typeof productSchema>;
export type ExpenseDoc = InferSchemaType<typeof expenseSchema>;
export type RemittanceDoc = InferSchemaType<typeof remittanceSchema>;
export type StockMovementDoc = InferSchemaType<typeof stockMovementSchema>;
export type NotificationDoc = InferSchemaType<typeof notificationSchema>;
export type AuthTokenDoc = InferSchemaType<typeof authTokenSchema>;
export type SessionDoc = InferSchemaType<typeof sessionSchema>;
export type WhatsAppConnectionDoc = InferSchemaType<typeof whatsappConnectionSchema>;
export type WhatsAppGroupBindingDoc = InferSchemaType<typeof whatsappGroupBindingSchema>;
export type WhatsAppInboundMessageDoc = InferSchemaType<typeof whatsappInboundMessageSchema>;

export const UserModel: Model<UserDoc> =
  (mongoose.models.AuthUser as Model<UserDoc>) || mongoose.model<UserDoc>('AuthUser', userSchema);

export const CompanyModel: Model<CompanyDoc> =
  (mongoose.models.Company as Model<CompanyDoc>) || mongoose.model<CompanyDoc>('Company', companySchema);

export const CompanyMemberModel: Model<CompanyMemberDoc> =
  (mongoose.models.CompanyMember as Model<CompanyMemberDoc>) || mongoose.model<CompanyMemberDoc>('CompanyMember', companyMemberSchema);

export const PartnerModel: Model<PartnerDoc> =
  (mongoose.models.Partner as Model<PartnerDoc>) || mongoose.model<PartnerDoc>('Partner', partnerSchema);

export const DeliveryModel: Model<DeliveryDoc> =
  (mongoose.models.Delivery as Model<DeliveryDoc>) || mongoose.model<DeliveryDoc>('Delivery', deliverySchema);

export const ProductModel: Model<ProductDoc> =
  (mongoose.models.Product as Model<ProductDoc>) || mongoose.model<ProductDoc>('Product', productSchema);

export const ExpenseModel: Model<ExpenseDoc> =
  (mongoose.models.Expense as Model<ExpenseDoc>) || mongoose.model<ExpenseDoc>('Expense', expenseSchema);

export const RemittanceModel: Model<RemittanceDoc> =
  (mongoose.models.Remittance as Model<RemittanceDoc>) || mongoose.model<RemittanceDoc>('Remittance', remittanceSchema);

export const StockMovementModel: Model<StockMovementDoc> =
  (mongoose.models.StockMovement as Model<StockMovementDoc>) || mongoose.model<StockMovementDoc>('StockMovement', stockMovementSchema);

export const NotificationModel: Model<NotificationDoc> =
  (mongoose.models.Notification as Model<NotificationDoc>) || mongoose.model<NotificationDoc>('Notification', notificationSchema);

export const AuthTokenModel: Model<AuthTokenDoc> =
  (mongoose.models.AuthToken as Model<AuthTokenDoc>) || mongoose.model<AuthTokenDoc>('AuthToken', authTokenSchema);

export const SessionModel: Model<SessionDoc> =
  (mongoose.models.AuthSession as Model<SessionDoc>) || mongoose.model<SessionDoc>('AuthSession', sessionSchema);

export const WhatsAppConnectionModel: Model<WhatsAppConnectionDoc> =
  (mongoose.models.WhatsAppConnection as Model<WhatsAppConnectionDoc>) ||
  mongoose.model<WhatsAppConnectionDoc>('WhatsAppConnection', whatsappConnectionSchema);

export const WhatsAppGroupBindingModel: Model<WhatsAppGroupBindingDoc> =
  (mongoose.models.WhatsAppGroupBinding as Model<WhatsAppGroupBindingDoc>) ||
  mongoose.model<WhatsAppGroupBindingDoc>('WhatsAppGroupBinding', whatsappGroupBindingSchema);

export const WhatsAppInboundMessageModel: Model<WhatsAppInboundMessageDoc> =
  (mongoose.models.WhatsAppInboundMessage as Model<WhatsAppInboundMessageDoc>) ||
  mongoose.model<WhatsAppInboundMessageDoc>('WhatsAppInboundMessage', whatsappInboundMessageSchema);
