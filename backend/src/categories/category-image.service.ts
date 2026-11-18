import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';

export type CategoryImage = { url: string; publicId: string; format: string | null; width: number | null; height: number | null; resourceType: string };

const imageType = (file: Express.Multer.File) => {
  const bytes = file.buffer;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes.length >= 12 && bytes.subarray(0, 4).equals(Buffer.from('RIFF')) && bytes.subarray(8, 12).equals(Buffer.from('WEBP'))) return 'webp';
  return null;
};

const sourceDimensions = (bytes: Buffer, type: string): [number, number] | null => {
  if (type === 'png' && bytes.length >= 24) return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (type === 'webp' && bytes.length >= 30) {
    const kind = bytes.toString('ascii', 12, 16);
    if (kind === 'VP8X') return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
    if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L' && bytes[20] === 0x2f) return [1 + (((bytes[22] & 0x3f) << 8) | bytes[21]), 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6))];
  }
  if (type === 'jpeg') {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at++] !== 0xff) continue;
      const marker = bytes[at++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0xff || marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = bytes.readUInt16BE(at);
      if (length < 2 || at + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return [bytes.readUInt16BE(at + 5), bytes.readUInt16BE(at + 3)];
      at += length;
    }
  }
  return null;
};

export const categoryImageConfig = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const values = [cloudName, apiKey, apiSecret];
  if (!values.some(Boolean)) return null;
  if (values.some(value => !value?.trim())) throw new ServiceUnavailableException({ code: 'IMAGE_STORAGE_UNAVAILABLE', message: 'Category image storage is not fully configured.' });
  const maxBytes = Number(process.env.CATEGORY_IMAGE_MAX_BYTES ?? 5 * 1024 * 1024);
  if (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 20 * 1024 * 1024) throw new ServiceUnavailableException({ code: 'IMAGE_STORAGE_UNAVAILABLE', message: 'Category image upload configuration is invalid.' });
  const folder = process.env.CLOUDINARY_FOLDER ?? 'home-lifestyle/categories';
  if (!/^[A-Za-z0-9_/-]{1,200}$/.test(folder)) throw new ServiceUnavailableException({ code: 'IMAGE_STORAGE_UNAVAILABLE', message: 'Category image upload configuration is invalid.' });
  return { cloudName: cloudName!, apiKey: apiKey!, apiSecret: apiSecret!, folder, maxBytes };
};

@Injectable()
export class CategoryImageService {
  private readonly logger = new Logger(CategoryImageService.name);
  maxBytes() { const configured = categoryImageConfig()?.maxBytes; if (configured) return configured; const fallback = Number(process.env.CATEGORY_IMAGE_MAX_BYTES ?? 5 * 1024 * 1024); return Number.isInteger(fallback) && fallback >= 1024 && fallback <= 20 * 1024 * 1024 ? fallback : 5 * 1024 * 1024; }
  async upload(file: Express.Multer.File, purpose: 'category' | 'avatar' = 'category'): Promise<CategoryImage> {
    const config = categoryImageConfig();
    if (!config) throw new ServiceUnavailableException({ code: 'IMAGE_STORAGE_UNAVAILABLE', message: `${purpose === 'avatar' ? 'Profile photo' : 'Category image'} uploads are not configured. Add Cloudinary credentials to the backend environment.` });
    if (!file?.buffer?.length) throw new BadRequestException({ code: 'IMAGE_REQUIRED', message: 'Choose a JPEG, PNG, or WebP image.' });
    if (file.size > config.maxBytes) throw new BadRequestException({ code: 'IMAGE_TOO_LARGE', message: `${purpose === 'avatar' ? 'Profile photos' : 'Category images'} must be ${Math.floor(config.maxBytes / 1024 / 1024)} MB or smaller.` });
    const type = imageType(file);
    if (!type) throw new BadRequestException({ code: 'IMAGE_INVALID', message: `${purpose === 'avatar' ? 'Profile photos' : 'Category images'} must be valid JPEG, PNG, or WebP files.` });
    if (purpose === 'avatar') {
      const dimensions = sourceDimensions(file.buffer, type);
      if (!dimensions || dimensions.some(value => value < 32 || value > 8192) || dimensions[0] * dimensions[1] > 16000000) throw new BadRequestException({ code: 'IMAGE_INVALID_DIMENSIONS', message: 'Profile photos must be 32–8192 pixels per side and at most 16 megapixels.' });
    }
    cloudinary.config({ cloud_name: config.cloudName, api_key: config.apiKey, api_secret: config.apiSecret, secure: true });
    let result: UploadApiResponse;
    try {
      result = await new Promise<UploadApiResponse>((resolve, reject) => cloudinary.uploader.upload_stream({ folder: purpose === 'avatar' ? config.folder.replace(/\/categories$/, '') + '/avatars' : config.folder, resource_type: 'image', unique_filename: true, overwrite: false, ...(purpose === 'avatar' ? { transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'auto' }] } : {}) }, (error, uploaded) => error || !uploaded ? reject(error ?? Error('Cloudinary upload failed.')) : resolve(uploaded)).end(file.buffer));
    } catch (error) {
      const providerStatus = (error as { http_code?: number })?.http_code;
      this.logger.warn(`Image upload failed${typeof providerStatus === 'number' ? ` (provider HTTP ${providerStatus})` : ''}.`);
      throw new ServiceUnavailableException({ code: 'IMAGE_UPLOAD_FAILED', message: 'The category image could not be uploaded. Please try again.' });
    }
    return { url: result.secure_url, publicId: result.public_id, format: result.format ?? null, width: result.width ?? null, height: result.height ?? null, resourceType: result.resource_type };
  }
  async remove(publicId: string | null | undefined) {
    if (!publicId || !categoryImageConfig()) return;
    try { await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true }); }
    catch (error) { this.logger.warn(`Category image cleanup failed for ${publicId}: ${error instanceof Error ? error.message : 'unknown error'}`); }
  }
}
