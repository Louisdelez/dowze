import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Envoi d'emails transactionnels via le serveur mail dédié Dowze (docker-mailserver sur prod,
 * dowze.ch, DKIM/relais VPS). Voir memory dowze-mail-server. Best-effort : un échec n'interrompt
 * jamais le flux applicatif.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger('Email');
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(@Inject(ENV) env: Env) {
    this.from = env.SMTP_FROM ?? 'Dowze <noreply@dowze.ch>';
    if (!env.SMTP_HOST) {
      this.transport = null;
      this.logger.warn('SMTP_HOST absent — envoi d’email désactivé (journalisation seule).');
      return;
    }
    this.transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 25,
      secure: false, // STARTTLS opportuniste ; réseau interne de confiance
      auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      tls: { rejectUnauthorized: false }, // cert interne
    });
  }

  get enabled(): boolean {
    return this.transport !== null;
  }

  async send(input: SendEmailInput): Promise<boolean> {
    if (!this.transport) {
      this.logger.log(`[email désactivé] → ${input.to} : ${input.subject}`);
      return false;
    }
    try {
      const info = await this.transport.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      this.logger.log(`email envoyé → ${input.to} (${info.messageId})`);
      return true;
    } catch (e) {
      this.logger.warn(`échec envoi email → ${input.to}: ${e instanceof Error ? e.message : e}`);
      return false;
    }
  }
}
