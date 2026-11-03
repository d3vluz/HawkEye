import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService, SESSION_COOKIE } from './auth.service';
import { AllowPendingPassword, CurrentMember, Public, SessionMember } from './decorators';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { LoginThrottlerGuard } from './login-throttler.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(LoginThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, member } = await this.auth.login(dto);
    this.setCookie(res, token);
    return member;
  }

  // Pública para limpar também cookies de sessões já invalidadas; sem isso o
  // middleware do frontend ainda aceitaria o JWT e devolveria a pessoa à área interna.
  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, this.auth.cookieOptions);
    return { success: true };
  }

  @AllowPendingPassword()
  @Get('me')
  me(@CurrentMember() member: SessionMember) {
    return member;
  }

  @AllowPendingPassword()
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentMember() member: SessionMember,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.changePassword(member, dto);
    this.setCookie(res, session.token);
    return session.member;
  }

  private setCookie(res: Response, token: string) {
    res.cookie(SESSION_COOKIE, token, { ...this.auth.cookieOptions, maxAge: this.auth.sessionMaxAge });
  }
}
