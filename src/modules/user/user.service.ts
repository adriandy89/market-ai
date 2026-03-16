import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { CacheService, DbService, getSessionKeyAuth } from 'src/libs';

@Injectable()
export class UserService {
  readonly prismaUserSelect: Prisma.UserSelect = {
    id: true,
    email: true,
    name: true,
    disabled: true,
    updated_at: true,
    created_at: true,
    role: true,
    is_email_verified: true,
  };

  constructor(
    private dbService: DbService,
    private readonly cacheService: CacheService,
  ) { }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [itemCount, users] = await this.dbService.$transaction([
      this.dbService.user.count(),
      this.dbService.user.findMany({
        skip,
        take: limit,
        select: this.prismaUserSelect,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return { data: users, meta: { itemCount, page, limit } };
  }

  async findOne(id: string) {
    return await this.dbService.user.findUnique({
      where: { id },
      select: this.prismaUserSelect,
    });
  }

  async delete(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new Error('You cannot delete yourself');
    }

    const deleted = await this.dbService.user.delete({
      where: { id },
      select: this.prismaUserSelect,
    });
    return { ok: true, data: deleted };
  }

  async disableMany(ids: string[], currentUserId: string) {
    if (ids.includes(currentUserId)) {
      throw new Error('You cannot disable yourself');
    }

    await this.dbService.user.updateMany({
      where: { id: { in: ids } },
      data: { disabled: true },
    });
    return { ok: true };
  }

  async enableMany(ids: string[]) {
    await this.dbService.user.updateMany({
      where: { id: { in: ids } },
      data: { disabled: false },
    });
    return { ok: true };
  }

  // ============ SESSION MANAGEMENT ============

  async saveUserSession(userId: string, sessionId: string) {
    const TTL = 60 * 60 * 24 * 3; // 3 days
    await this.cacheService.set(`user-session:${userId}:${sessionId}`, '1', TTL);
  }

  async countOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    const pattern = `user-session:${userId}:*`;
    const keys = await this.cacheService.keys(pattern);
    const otherSessions = keys.filter(key => !key.includes(currentSessionId));
    return otherSessions.length;
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const pattern = `user-session:${userId}:*`;
    const keys = await this.cacheService.keys(pattern);

    for (const key of keys) {
      if (!key.includes(currentSessionId)) {
        const sessionId = key.split(':').pop();
        if (sessionId) {
          await this.cacheService.del(getSessionKeyAuth(sessionId));
          await this.cacheService.del(key);
        }
      }
    }
  }
}
