import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

/**
 * Adaptador desacoplado para la integración con Hotmart.
 *
 * IMPORTANTE:
 *  - Los secretos de Hotmart (client id/secret, webhook signature) viven SOLO en
 *    la configuración segura del backend (variables de entorno), nunca en tablas
 *    de contenido ni en respuestas al frontend.
 *  - Cuando las credenciales no están presentes, el adaptador queda en modo
 *    "no configurado": expone los contratos y validadores, pero no confirma
 *    compras reales. Esto permite construir y probar el resto del módulo.
 */
export type HotmartEnvironment = 'sandbox' | 'production' | 'unconfigured';

export interface HotmartPurchaseNotification {
  /** id del evento entrante (para idempotencia). */
  eventId: string;
  productId: string;
  buyerEmail?: string;
  buyerUserId?: string;
  status: 'APPROVED' | 'REFUNDED' | 'CHARGEBACK' | 'CANCELLED' | string;
  externalReference?: string;
  rawSignature?: string;
}

export interface HotmartVerificationResult {
  valid: boolean;
  reason?: string;
}

@Injectable()
export class HotmartAdapter {
  private readonly logger = new Logger(HotmartAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private get clientId(): string | undefined {
    return this.config.get<string>('HOTMART_CLIENT_ID');
  }
  private get clientSecret(): string | undefined {
    return this.config.get<string>('HOTMART_CLIENT_SECRET');
  }
  private get webhookSecret(): string | undefined {
    return this.config.get<string>('HOTMART_WEBHOOK_SECRET');
  }

  environment(): HotmartEnvironment {
    if (!this.clientId || !this.clientSecret) return 'unconfigured';
    return (this.config.get<string>('HOTMART_ENV') ?? 'sandbox') === 'production'
      ? 'production'
      : 'sandbox';
  }

  isConfigured(): boolean {
    return this.environment() !== 'unconfigured';
  }

  /**
   * Verifica la autenticidad de una notificación entrante de Hotmart.
   * Sin webhook secret configurado, devuelve `valid: false` (no confirma compras).
   */
  verifyNotification(payload: HotmartPurchaseNotification): HotmartVerificationResult {
    if (!this.webhookSecret) {
      return { valid: false, reason: 'HOTMART_WEBHOOK_SECRET no configurado' };
    }
    if (!payload.rawSignature) {
      return { valid: false, reason: 'firma ausente' };
    }
    // La verificación real de firma (HMAC/hottok) se realiza aquí cuando existan
    // credenciales. Contrato listo para implementación productiva.
    return this.matchesSecret(payload.rawSignature, this.webhookSecret)
      ? { valid: true }
      : { valid: false, reason: 'firma inválida' };
  }

  /**
   * Comparación en tiempo constante: un `===` filtra por cuánto tarda en fallar
   * cuántos caracteres iniciales del hottok acertó quien lo intenta.
   */
  private matchesSecret(candidate: string, expected: string): boolean {
    const candidateBuffer = Buffer.from(candidate, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return (
      candidateBuffer.length === expectedBuffer.length &&
      timingSafeEqual(candidateBuffer, expectedBuffer)
    );
  }

  /**
   * Determina si una notificación verificada concede acceso.
   */
  grantsAccess(payload: HotmartPurchaseNotification): boolean {
    return payload.status === 'APPROVED';
  }

  /**
   * Determina si una notificación verificada revoca acceso.
   */
  revokesAccess(payload: HotmartPurchaseNotification): boolean {
    return ['REFUNDED', 'CHARGEBACK', 'CANCELLED'].includes(payload.status);
  }
}
