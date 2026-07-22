import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sendGridMail from '@sendgrid/mail';
import { MessageOutbox } from '@/database/models';
import {
  EmailMessagePayload,
  MESSAGE_CHANNEL_EMAIL,
  MessageProviderResult,
  NormalizedProviderError,
} from './messaging.types';

const PROVIDER_DEV_NULL = 'DEV_NULL';
const PROVIDER_SENDGRID = 'SENDGRID';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readHeader(
  headers: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return typeof value === 'string' ? value : undefined;
}

@Injectable()
export class MessagingProviderService {
  constructor(private readonly config: ConfigService) {}

  async send(message: MessageOutbox): Promise<MessageProviderResult> {
    if (message.channel !== MESSAGE_CHANNEL_EMAIL) {
      return this.sendToDevelopmentSink(message, { reason: 'CHANNEL_NOT_IMPLEMENTED' });
    }

    if (this.currentEmailProvider === PROVIDER_SENDGRID) {
      return this.sendEmailWithSendGrid(message);
    }

    return this.sendToDevelopmentSink(message, { reason: 'EMAIL_PROVIDER_DEV_NULL' });
  }

  normalizeError(error: unknown): NormalizedProviderError {
    const errorRecord = asRecord(error);
    const responseRecord = asRecord(errorRecord?.response);
    const bodyRecord = asRecord(responseRecord?.body);
    const headers = asRecord(responseRecord?.headers);
    const bodyErrors = Array.isArray(bodyRecord?.errors) ? bodyRecord.errors : [];
    const firstBodyError = asRecord(bodyErrors[0]);
    const providerMessage = firstBodyError?.message;
    const nativeMessage = error instanceof Error ? error.message : undefined;
    const statusCode = responseRecord?.statusCode ?? errorRecord?.code;

    return {
      message: String(providerMessage ?? nativeMessage ?? 'Unknown messaging provider error').slice(
        0,
        2_000,
      ),
      metadata: {
        statusCode:
          typeof statusCode === 'string' || typeof statusCode === 'number' ? statusCode : undefined,
        requestId: readHeader(headers, 'x-request-id') ?? readHeader(headers, 'x-message-id'),
        provider: this.currentEmailProvider,
      },
    };
  }

  private get currentEmailProvider() {
    return (this.config.get<string>('email.provider') ?? PROVIDER_DEV_NULL).toUpperCase();
  }

  private sendToDevelopmentSink(
    message: MessageOutbox,
    metadata: Record<string, unknown>,
  ): MessageProviderResult {
    return {
      provider: PROVIDER_DEV_NULL,
      providerMessageId: `dev-${message.id}`,
      metadata: {
        simulated: true,
        channel: message.channel,
        templateCode: message.templateCode,
        ...metadata,
      },
    };
  }

  private async sendEmailWithSendGrid(message: MessageOutbox): Promise<MessageProviderResult> {
    const apiKey = this.config.get<string>('email.sendgrid.apiKey');
    const defaultFromEmail = this.config.get<string>('email.fromEmail');
    const defaultFromName = this.config.get<string>('email.fromName') ?? 'Corazon Migrante';
    const replyTo = this.config.get<string>('email.replyTo') || undefined;

    if (!apiKey) {
      throw new BadRequestException({
        code: 'SENDGRID_API_KEY_REQUIRED',
        message: 'Debe configurar SENDGRID_API_KEY.',
      });
    }
    if (!defaultFromEmail) {
      throw new BadRequestException({
        code: 'EMAIL_FROM_EMAIL_REQUIRED',
        message: 'Debe configurar EMAIL_FROM_EMAIL.',
      });
    }

    const payload = message.payload as EmailMessagePayload;
    const subject = payload.subject ?? `Corazon Migrante - ${message.templateCode}`;
    const text =
      payload.text ?? `Mensaje automatico de Corazon Migrante. Plantilla: ${message.templateCode}`;

    sendGridMail.setApiKey(apiKey.trim());
    const [response] = await sendGridMail.send({
      to: message.recipient,
      from: {
        email: payload.fromEmail ?? defaultFromEmail,
        name: payload.fromName ?? defaultFromName,
      },
      subject,
      text,
      html: payload.html,
      replyTo,
    });

    const headers = asRecord(response.headers);
    return {
      provider: PROVIDER_SENDGRID,
      providerMessageId: readHeader(headers, 'x-message-id'),
      metadata: {
        statusCode: response.statusCode,
        requestId: readHeader(headers, 'x-request-id'),
      },
    };
  }
}
