import { v2 as cloudinary } from 'cloudinary';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'node:crypto';

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 20_000_000;

export interface StoredProfilePhoto {
  url: string;
  publicId: string;
}

function storageError(message = 'Profile photo storage is unavailable. Please try again later.', status = 503) {
  return Object.assign(new Error(message), { status });
}

function configureStorage(): void {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw storageError();
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

export async function storePartnerProfilePhoto(buffer: Buffer): Promise<StoredProfilePhoto> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_FILE_BYTES) {
    throw storageError('Choose a non-empty image no larger than 3 MB.', 400);
  }
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    throw storageError('Only verified PNG, JPEG, and WebP images are accepted.', 400);
  }
  configureStorage();

  let uploaded: any;
  try {
    uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        folder: 'ved-affiliate/partner-photos',
        public_id: randomUUID(),
        resource_type: 'image',
        allowed_formats: ['png', 'jpg', 'jpeg', 'webp'],
        overwrite: false,
      }, (error, result) => error ? reject(error) : resolve(result));
      stream.end(buffer);
    });
  } catch {
    throw storageError();
  }

  const width = Number(uploaded?.width);
  const height = Number(uploaded?.height);
  if (!uploaded?.public_id || !Number.isInteger(width) || !Number.isInteger(height)
    || width <= 0 || height <= 0 || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    if (uploaded?.public_id) await deletePartnerProfilePhoto(uploaded.public_id);
    throw storageError('Image dimensions must be no larger than 4096 × 4096 pixels.', 400);
  }

  const url = cloudinary.url(uploaded.public_id, {
    secure: true,
    format: 'auto',
    transformation: [{ width: 512, height: 512, crop: 'limit', quality: 'auto:good' }],
  });
  if (!url.startsWith('https://')) {
    await deletePartnerProfilePhoto(uploaded.public_id);
    throw storageError();
  }
  return { url, publicId: uploaded.public_id };
}

export async function deletePartnerProfilePhoto(publicId: string): Promise<void> {
  if (!publicId) return;
  configureStorage();
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  } catch {
    throw storageError();
  }
}
