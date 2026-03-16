import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CacheService, getSessionKeyAuth } from 'src/libs';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto, SignUpUserDto } from './dtos';
import { SessionGuard } from './guards';
import { LocalAuthGuard } from './guards/local-auth.guard';
import type { SessionUser } from './interfaces';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly authService: AuthService,
  ) { }

  @UseGuards(LocalAuthGuard)
  @ApiBody({
    schema: {
      example: {
        username: 'string',
        password: 'string',
      },
    },
  })
  @Post('signin')
  async signIn(@Req() req: Request) {
    const user = req.user as SessionUser;
    if (user) {
      await this.authService.registerSessionLog(req);
    }
    return { user };
  }

  @UseGuards(SessionGuard)
  @Get('profile')
  async getProfile(@Req() req: Request) {
    const user = req.user;
    return { user };
  }

  @UseGuards(SessionGuard)
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const user = req.user as SessionUser;
    if (user) {
      await this.authService.registerSessionOutLog(req.sessionID, user.id);
    }
    req.logout(async (err) => {
      if (err) {
        return res.status(400).json({ message: 'Failed to logout' });
      }
      res.clearCookie('market.ai.sid');
      await this.cacheService.del(getSessionKeyAuth(req.sessionID));
      return res.status(200).json({ message: 'Logged out successfully' });
    });
  }

  @Get('activate-email/:token')
  activateUserByEmailToken(@Param('token') token: string) {
    return this.authService.activateUserByEmailToken(token);
  }

  @Post('signup')
  async signUp(@Body() userDTO: SignUpUserDto) {
    return await this.authService.signup(userDTO);
  }

  @UseGuards(SessionGuard)
  @Put('change-password')
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const user = req.user as SessionUser;
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
