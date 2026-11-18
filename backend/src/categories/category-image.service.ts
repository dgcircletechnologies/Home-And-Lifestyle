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
  maxBytes() { return categoryImageConfig()?.maxBytes ?? Number(process.env.CATEGORY_IMAGE_MAX_BYTES ?? 5 * 1024 * 1024); }
  async upload(file: Express.Multer.File): Promise<CategoryImage> {
    const config = categoryImageConfig();
    if (!config) throw new ServiceUnavailableException({ code: 'IMAGE_STORAGE_UNAVAILABLE', message: 'Category image uploads are not configured. Add Cloudinary credentials to the backend environment.' });
    if (!file?.buffer?.length) throw new BadRequestException({ code: 'IMAGE_REQUIRED', message: 'Choose a JPEG, PNG, or WebP image.' });
    if (file.size > config.maxBytes) throw new BadRequestException({ code: 'IMAGE_TOO_LARGE', message: `Category images must be ${Math.floor(config.maxBytes / 1024 / 1024)} MB or smaller.` });
    if (!imageType(file)) throw new BadRequestException({ code: 'IMAGE_INVALID', message: 'Category images must be valid JPEG, PNG, or WebP files.' });
    cloudinary.config({ cloud_name: config.cloudName, api_key: config.apiKey, api_secret: config.apiSecret, secure: true });
    let result: UploadApiResponse;
    try {
      result = await new Promise<UploadApiResponse>((resolve, reject) => cloudinary.uploader.upload_stream({ folder: config.folder, resource_type: 'image', unique_filename: true, overwrite: false }, (error, uploaded) => error || !uploaded ? reject(error ?? Error('Cloudinary upload failed.')) : resolve(uploaded)).end(file.buffer));
    } catch (error) {
      this.logger.warn(`Category image upload failed: ${error instanceof Error ? error.message : 'unknown error'}`);
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
