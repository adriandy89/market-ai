import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { DbService } from 'src/libs';

@Injectable()
export class VerificationsService {
  private readonly logger = new Logger(VerificationsService.name);
  private readonly appUrl: string;
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly dbService: DbService,
    private readonly configService: ConfigService,
  ) {
    this.appUrl = this.configService.get<string>('PUBLIC_APP_URL', 'http://localhost:4201');
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });
  }

  // ═══════════════ TOKEN GENERATION ═══════════════

  async generateVerificationToken(email: string, longExpiry = false) {
    const token = uuidv4();
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + (longExpiry ? 172800 : 3600)); // 48h or 1h

    // Delete previous tokens for this email
    await this.dbService.verificationToken.deleteMany({ where: { email } });

    return this.dbService.verificationToken.create({
      data: { email, token, expires },
    });
  }

  async generatePasswordResetToken(email: string) {
    const token = uuidv4();
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + 3600); // 1 hour

    await this.dbService.passwordResetToken.deleteMany({ where: { email } });

    return this.dbService.passwordResetToken.create({
      data: { email, token, expires },
    });
  }

  // ═══════════════ TOKEN RETRIEVAL ═══════════════

  async getVerificationTokenByToken(token: string) {
    return this.dbService.verificationToken.findUnique({ where: { token } });
  }

  async getPasswordResetTokenByToken(token: string) {
    return this.dbService.passwordResetToken.findUnique({ where: { token } });
  }

  // ═══════════════ EMAIL SENDING ═══════════════

  async sendVerificationEmail(email: string) {
    const { token } = await this.generateVerificationToken(email);
    const link = `${this.appUrl}/activate-user?token=${token}`;

    const html = this.getEmailTemplate(
      'Welcome to Market AI!',
      'Please confirm your email address to start using the platform. Click the button below to verify your account.',
      'Verify Email',
      link,
    );

    await this.sendEmail(email, 'Confirm your email - Market AI', html);
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const link = `${this.appUrl}/auth/new-password?token=${token}`;

    const html = this.getEmailTemplate(
      'Reset Password',
      'We received a request to reset your password. Click the button below to set a new password. This link expires in 1 hour.',
      'Reset Password',
      link,
    );

    await this.sendEmail(email, 'Reset your password - Market AI', html);
  }

  async sendEmail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_USER'),
        to,
        subject,
        html,
      });
      this.logger.verbose(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
    }
  }

  // ═══════════════ EMAIL TEMPLATE ═══════════════

  private getEmailTemplate(title: string, content: string, buttonText: string, buttonLink: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:12px;border:1px solid #1f2937;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:32px 32px 16px;text-align:center;">
          <h1 style="margin:0;font-size:24px;font-weight:700;">
            <span style="color:#10b981;">Market</span><span style="color:#f59e0b;">AI</span>
          </h1>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:16px 32px;">
          <h2 style="color:#e5e7eb;font-size:20px;margin:0 0 12px;">${title}</h2>
          <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 24px;">${content}</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${buttonLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                ${buttonText}
              </a>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 32px;border-top:1px solid #1f2937;">
          <p style="color:#6b7280;font-size:12px;margin:0;text-align:center;">
            If you didn't request this email, you can safely ignore it.<br>
            &copy; ${new Date().getFullYear()} Market AI
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
