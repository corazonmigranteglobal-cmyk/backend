export const MESSAGE_CHANNEL_EMAIL = 'EMAIL';

export const MESSAGE_STATUS = {
  pending: 'PENDIENTE',
  processing: 'PROCESANDO',
  sent: 'ENVIADO',
  failed: 'FALLIDO',
  cancelled: 'CANCELADO',
} as const;

export const MESSAGE_API_STATUS: Record<string, string> = {
  [MESSAGE_STATUS.pending]: 'PENDING',
  [MESSAGE_STATUS.processing]: 'PROCESSING',
  [MESSAGE_STATUS.sent]: 'SENT',
  [MESSAGE_STATUS.failed]: 'FAILED',
  [MESSAGE_STATUS.cancelled]: 'CANCELLED',
};

export type EmailMessagePayload = {
  subject?: string;
  text?: string;
  html?: string;
  fromEmail?: string;
  fromName?: string;
};

export type MessageProviderResult = {
  provider: string;
  providerMessageId?: string;
  metadata: Record<string, unknown>;
};

export type NormalizedProviderError = {
  message: string;
  metadata: Record<string, unknown>;
};
