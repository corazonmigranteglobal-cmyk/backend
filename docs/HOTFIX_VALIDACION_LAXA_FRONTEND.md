# Hotfix: validación laxa para compatibilidad con el frontend

## Problema

El backend estaba usando `ValidationPipe` con:

```ts
forbidNonWhitelisted: true
```

Eso hacía que cualquier query/body con propiedades adicionales respondiera `400 Bad Request`, por ejemplo:

- `property role should not exist`
- `property rol should not exist`
- `property status should not exist`
- `property p_estado should not exist`
- `property sortBy should not exist`
- `property sortDir should not exist`

En una plataforma con frontend todavía en ajuste, tablas con filtros, formularios legacy o módulos que comparten helpers HTTP, esta configuración es demasiado rígida y hace que pantallas completas fallen aunque el dato útil sí sea correcto.

## Cambio aplicado

Ahora el backend queda en modo compatible por defecto:

```ts
whitelist: true
forbidNonWhitelisted: process.env.VALIDATION_FORBID_NON_WHITELISTED === 'true'
forbidUnknownValues: false
transform: true
transformOptions: { enableImplicitConversion: true }
```

## Qué significa

- El backend ya no responde `400` solo porque el frontend mande una propiedad extra.
- Las propiedades extras se eliminan antes de llegar al controller/service porque `whitelist: true` se mantiene activo.
- Se conserva la validación importante: tipos, enums, campos obligatorios, emails, fechas y reglas de DTO.
- Si más adelante se quiere volver al modo estricto, se puede poner:

```env
VALIDATION_FORBID_NON_WHITELISTED=true
```

## Archivos modificados

- `src/main.ts`
- `dist/main.js`
- `src/config/env.validation.ts`
- `dist/config/env.validation.js`
- `.env.example`
- `test/auth.e2e-spec.ts`
- `scripts/check-validation-lax.mjs`
- `package.json`

## Comando de verificación

```bash
yarn smoke:validation-lax
```

También puedes correrlo sin Yarn:

```bash
node scripts/check-validation-lax.mjs
```

## Nota importante

Este cambio no convierte el backend en inseguro: no se aceptan campos extras para persistirlos en base de datos, porque `whitelist: true` sigue limpiando el payload. Solo se evita que el backend sea frágil ante propiedades no reconocidas.
