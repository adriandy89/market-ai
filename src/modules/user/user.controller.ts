import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from 'generated/prisma/enums';
import { UUIDArrayDto } from 'src/libs';
import { GetUserInfo, Permissions } from '../auth/decorators';
import { PermissionsGuard, SessionGuard } from '../auth/guards';
import type { SessionUser } from '../auth/interfaces';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(SessionGuard)
export class UserController {
  constructor(private readonly userService: UserService) { }

  // ============ SESSIONS ============

  @Get('sessions/active')
  async countActiveSessions(
    @GetUserInfo() user: SessionUser,
    @Req() req: Request
  ) {
    const sessionId = (req as any).sessionID;
    const count = await this.userService.countOtherSessions(user.id, sessionId);
    return { ok: true, count };
  }

  @Delete('sessions/others')
  async revokeOtherSessions(
    @GetUserInfo() user: SessionUser,
    @Req() req: Request
  ) {
    const sessionId = (req as any).sessionID;
    await this.userService.revokeOtherSessions(user.id, sessionId);
    return { ok: true };
  }

  // ============ LANGUAGE ============

  @Put('language')
  async updateLanguage(
    @GetUserInfo() user: SessionUser,
    @Body() body: { language: string },
  ) {
    return this.userService.updateLanguage(user.id, body.language);
  }

  // ============ ADMIN: USER MANAGEMENT ============

  @Get()
  @Permissions([Role.ADMIN])
  @UseGuards(PermissionsGuard)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.userService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get(':id')
  @Permissions([Role.ADMIN])
  @UseGuards(PermissionsGuard)
  async findOne(@Param('id') id: string) {
    const found = await this.userService.findOne(id);
    if (!found) {
      throw new NotFoundException('User not found');
    }
    return found;
  }

  @Delete(':id')
  @Permissions([Role.ADMIN])
  @UseGuards(PermissionsGuard)
  async delete(@Param('id') id: string, @GetUserInfo() user: SessionUser) {
    return this.userService.delete(id, user.id);
  }

  @Put('disable/many')
  @Permissions([Role.ADMIN])
  @UseGuards(PermissionsGuard)
  async disableMany(@Body() dto: UUIDArrayDto, @GetUserInfo() user: SessionUser) {
    try {
      return await this.userService.disableMany(dto.uuids, user.id);
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'Bad request');
    }
  }

  @Put('enable/many')
  @Permissions([Role.ADMIN])
  @UseGuards(PermissionsGuard)
  async enableMany(@Body() dto: UUIDArrayDto) {
    return this.userService.enableMany(dto.uuids);
  }
}
