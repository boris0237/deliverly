import 'server-only';
import { createRequire } from 'module';

type NodeCryptoModule = {
  createHash: (algorithm: 'sha1') => { update: (value: string) => { digest: (encoding: 'hex') => string } };
};

const require = createRequire(import.meta.url);

function getNodeCrypto(): NodeCryptoModule {
  return require('node:crypto') as NodeCryptoModule;
}

type UploadOptions = {
  folder?: string;
  publicId?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
};

type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET.');
  }

  return { cloudName, apiKey, apiSecret };
}

export async function uploadToCloudinary(file: File, options: UploadOptions = {}): Promise<CloudinaryUploadResult> {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const resourceType = options.resourceType || 'image';

  const params: Record<string, string> = { timestamp };
  if (options.folder) params.folder = options.folder;
  if (options.publicId) params.public_id = options.publicId;

  const signaturePayload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  const { createHash } = getNodeCrypto();
  const signature = createHash('sha1').update(`${signaturePayload}${apiSecret}`).digest('hex');

  const payload = new FormData();
  payload.append('file', file);
  payload.append('api_key', apiKey);
  payload.append('timestamp', timestamp);
  payload.append('signature', signature);
  if (options.folder) payload.append('folder', options.folder);
  if (options.publicId) payload.append('public_id', options.publicId);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: payload,
  });

  const result = await response.json();
  if (!response.ok || !result?.secure_url || !result?.public_id) {
    throw new Error(result?.error?.message || 'Cloudinary upload failed.');
  }

  return {
    secureUrl: result.secure_url as string,
    publicId: result.public_id as string,
  };
}
