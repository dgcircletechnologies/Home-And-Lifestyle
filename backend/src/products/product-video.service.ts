import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const folder = () => {
  const value = process.env.CLOUDINARY_VIDEO_FOLDER ?? 'home-lifestyle/products/videos';
  if (!/^[A-Za-z0-9_/-]{1,200}$/.test(value)) throw new ServiceUnavailableException('Video storage folder is invalid.');
  return value;
};
const configure = () => {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
  if (!cloudName || !apiKey || !apiSecret) throw new ServiceUnavailableException('Video uploads are not configured.');
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
};

@Injectable()
export class ProductVideoService {
  private readonly logger = new Logger(ProductVideoService.name);
  async upload(file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose an MP4, WebM, or MOV video.');
    if (file.size > MAX_VIDEO_BYTES) throw new BadRequestException('Videos must be 50 MB or smaller.');
    const bytes = file.buffer;
    const mp4OrMov = bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp';
    const webm = bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.mimetype) || !(mp4OrMov || webm)) throw new BadRequestException('The file must be a valid MP4, WebM, or MOV video.');
    configure();
    try {
      const uploaded = await new Promise<UploadApiResponse>((resolve, reject) => cloudinary.uploader.upload_stream({ folder: folder(), resource_type: 'video', unique_filename: true, overwrite: false }, (error, result) => error || !result ? reject(error ?? Error('Upload failed.')) : resolve(result)).end(bytes));
      return { url: uploaded.secure_url, publicId: uploaded.public_id };
    } catch {
      this.logger.warn('Cloudinary video upload failed.');
      throw new ServiceUnavailableException('Video upload failed. Try again.');
    }
  }
  async remove(publicId: string | null | undefined) {
    if (!publicId) return;
    try { configure(); await cloudinary.uploader.destroy(publicId, { resource_type: 'video', invalidate: true }); }
    catch { this.logger.warn('Cloudinary video cleanup deferred.'); }
  }
}
