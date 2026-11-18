import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CategoryImageService } from '../categories/category-image.service';
import { safeUser } from './users.service';

@Injectable()
export class ProfilePhotoService {
  private readonly logger = new Logger(ProfilePhotoService.name);
  constructor(private readonly db: PrismaService, private readonly images: CategoryImageService) {}
  private changed() { return new ConflictException({ code: 'PROFILE_PHOTO_CHANGED', message: 'Your profile photo changed. Refresh and try again.' }); }
  private async cleanup(publicId: string | null) { if (!publicId) return; try { if (!await this.db.user.count({ where: { avatarPublicId: publicId } })) await this.images.remove(publicId); } catch { this.logger.warn(`Profile photo cleanup deferred for asset ${publicId}. Verify no user references it before removing it from Cloudinary.`); } }
  async upload(userId: string, file: Express.Multer.File) {
    const current = await this.db.user.findUnique({ where: { id: userId } }); if (!current) throw new NotFoundException();
    const uploaded = await this.images.upload(file, 'avatar');
    let saved;
    try {
      saved = await this.db.user.update({ where: { id: userId, avatarPublicId: current.avatarPublicId }, data: { avatarUrl: uploaded.url, avatarPublicId: uploaded.publicId } });
    } catch (error) { await this.cleanup(uploaded.publicId); if ((error as { code?: string }).code === 'P2025') throw this.changed(); throw error; }
    if (current.avatarPublicId && current.avatarPublicId !== uploaded.publicId) await this.cleanup(current.avatarPublicId);
    return safeUser(saved);
  }
  async remove(userId: string) {
    const current = await this.db.user.findUnique({ where: { id: userId } }); if (!current) throw new NotFoundException();
    let saved; try { saved = await this.db.user.update({ where: { id: userId, avatarPublicId: current.avatarPublicId }, data: { avatarUrl: null, avatarPublicId: null } }); } catch (error) { if ((error as { code?: string }).code === 'P2025') throw this.changed(); throw error; }
    await this.cleanup(current.avatarPublicId); return safeUser(saved);
  }
}
