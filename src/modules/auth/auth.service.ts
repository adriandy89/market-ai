import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { UserSelect } from 'generated/prisma/models';
import { CacheService, DbService } from 'src/libs';
import { VerificationsService } from '../verifications';
import { SignUpUserDto } from './dtos';
import { SessionUser } from './interfaces';

@Injectable()
export class AuthService {
  readonly prismaUserSelect: UserSelect = {
    id: true,
    email: true,
    disabled: true,
    name: true,
    role: true,
  };

  constructor(
    private dbService: DbService,
    private cacheService: CacheService,
    private verificationsService: VerificationsService,
  ) { }

  async signup(userDTO: SignUpUserDto) {
    const user = await this.dbService.user.findUnique({
      where: { email: userDTO.email },
      select: { ...this.prismaUserSelect, is_email_verified: true },
    });
    const hash = await this.hashPassword(userDTO.password);
    if (user) {
      if (user.is_email_verified) {
        return {
          ok: false,
          active: true,
          message: 'User already exist',
        };
      }
      await this.dbService.user.update({
        where: { id: user.id },
        data: {
          ...userDTO,
          password: hash,
        },
      });
      await this.verificationsService.sendVerificationEmail(userDTO.email);
      return { ok: true, active: false };
    }

    const { email } = await this.dbService.user.create({
      data: {
        ...userDTO,
        password: hash,
        is_email_verified: false,
        disabled: false,
        role: 'USER',
      },
      select: { email: true },
    });
    await this.verificationsService.sendVerificationEmail(email);
    return { ok: true, active: false };
  }

  async activateUserByEmailToken(token: string) {
    const existingToken = await this.verificationsService.getVerificationTokenByToken(token);

    if (!existingToken) {
      return { error: 'Token does not exist!' };
    }

    const hasExpired = new Date(existingToken.expires) < new Date();

    if (hasExpired) {
      await this.dbService.verificationToken.delete({
        where: { id: existingToken.id },
      });
      return { error: 'Token has expired!' };
    }

    const existingUser = await this.dbService.user.findUnique({
      where: {
        email: existingToken.email,
        disabled: false,
        is_email_verified: false,
      },
    });

    if (!existingUser) {
      return { error: 'Verification Error!' };
    }

    await this.dbService.user.update({
      where: { id: existingUser.id },
      data: { is_email_verified: true },
    });

    await this.dbService.verificationToken.delete({
      where: { id: existingToken.id },
    });

    return { success: 'Email verified!' };
  }

  async validateUser(username: string, password: string): Promise<SessionUser | null> {
    const user = await this.dbService.user.findUnique({
      where: { email: username, disabled: false, is_email_verified: true },
      select: { ...this.prismaUserSelect, password: true },
    });
    if (!user) {
      return null;
    }

    const isValidPassword = await this.checkPassword(password, user.password);

    if (user && isValidPassword) {
      const { password, ...result } = user;
      return result as SessionUser;
    }

    return null;
  }

  async checkPassword(password: string, passwordDB: string): Promise<boolean> {
    return await bcrypt.compare(password, passwordDB);
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.dbService.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isValid = await this.checkPassword(currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hash = await this.hashPassword(newPassword);
    await this.dbService.user.update({
      where: { id: userId },
      data: { password: hash },
    });

    return { message: 'Password updated successfully' };
  }

  async forgotPassword(email: string) {
    const rateLimitKey = `pwd-reset-attempts:${email}`;
    const attempts = await this.cacheService.incrWithExpire(rateLimitKey, 3600);

    if (attempts > 5) {
      throw new BadRequestException(
        'Too many attempts. Try again in 1 hour.',
      );
    }

    const user = await this.dbService.user.findUnique({
      where: { email, disabled: false, is_email_verified: true },
      select: { id: true, email: true },
    });

    if (user) {
      const { token } = await this.verificationsService.generatePasswordResetToken(email);
      await this.verificationsService.sendPasswordResetEmail(email, token);
    }

    return { message: 'If the email exists, you will receive a password reset link' };
  }

  async resetPassword(token: string, newPassword: string) {
    const existingToken = await this.verificationsService.getPasswordResetTokenByToken(token);

    if (!existingToken) {
      throw new BadRequestException('Invalid or expired token');
    }

    const hasExpired = new Date(existingToken.expires) < new Date();
    if (hasExpired) {
      await this.dbService.passwordResetToken.delete({
        where: { id: existingToken.id },
      });
      throw new BadRequestException('Invalid or expired token');
    }

    const user = await this.dbService.user.findUnique({
      where: { email: existingToken.email },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }

    const hash = await this.hashPassword(newPassword);
    await this.dbService.user.update({
      where: { id: user.id },
      data: { password: hash },
    });

    await this.dbService.passwordResetToken.delete({
      where: { id: existingToken.id },
    });

    return { message: 'Password reset successfully' };
  }

  async registerSessionLog(req: Request) {
    try {
      const user = req.user as SessionUser;
      const session_id = req.sessionID;
      await this.dbService.sessionLogs.create({
        data: {
          session_id,
          user_id: user.id,
          email: user.email,
          ip: req.ip || req.socket?.remoteAddress || null,
          attributes: {
            userAgent: req.headers['user-agent'] || null,
            referer: req.headers['referer'] || null,
            origin: req.headers['origin'] || null,
          },
        },
      });
    } catch (error) {
      console.log('Error registering session log:', error);
    }
  }

  async registerSessionOutLog(session_id: string, user_id: string) {
    try {
      await this.dbService.sessionLogs.updateMany({
        where: { session_id, user_id },
        data: { logout_at: new Date() },
      });
    } catch (error) {
      console.log('Error registering session out log:', error);
    }
  }
}
