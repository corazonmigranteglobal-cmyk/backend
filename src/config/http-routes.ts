import { RequestMethod } from '@nestjs/common';
import type { RouteInfo } from '@nestjs/common/interfaces';

/**
 * Rutas que quedan fuera del prefijo global de la API.
 *
 * `/health` vive en la raíz porque lo consultan orquestadores y balanceadores
 * que no conocen el prefijo versionado (`api/v1`) y que, en muchos casos, no
 * permiten configurar la ruta de la sonda.
 *
 * Es una constante compartida a propósito: `main.ts` la aplica en tiempo de
 * ejecución y `scripts/generate-openapi.ts` la necesita para calcular las
 * mismas rutas al construir el contrato. Duplicarla haría que el contrato
 * publicara `/api/v1/health`, una ruta que no existe.
 */
export const API_PREFIX_EXCLUDED_ROUTES: RouteInfo[] = [
  { path: 'health', method: RequestMethod.GET },
  //  no forma parte de la API del producto: lo consume la
  // infraestructura de monitorizacion, que espera esa ruta en la raiz.
  { path: 'metrics', method: RequestMethod.GET },
];

/** ¿Esta operación queda fuera del prefijo global? */
export function isPrefixExcluded(path: string, method: RequestMethod) {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  return API_PREFIX_EXCLUDED_ROUTES.some(
    (route) =>
      route.path.replace(/^\/+|\/+$/g, '') === normalized &&
      (route.method === RequestMethod.ALL || route.method === method),
  );
}
