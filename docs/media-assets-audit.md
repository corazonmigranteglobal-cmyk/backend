# Auditoría de recursos visuales

## Causa de la primera imagen caída
El hero de la vista genérica usaba como fallback
`fileServer.landingHeroImageUrl` → `…/landing_page/media/landing_hero.jpg`,
un archivo que **nunca se subió** a Cloudinary (se subieron `carrusel-*`,
`mission`, `story`, `doctor-*`, etc.). Resultado: 404 → imagen rota.

## Solución
- Defaults de `file-server.ts` reapuntados a imágenes que sí existen
  (`carrusel-2.webp`, `mission.webp`, `story.webp`, `carrusel-*`).
- Componente `SmartImage` (`src/shared/ui/smart-image.tsx`): placeholder de
  carga, fallback a copia local `/landing/*`, relación de aspecto estable
  (sin CLS), carga prioritaria en hero, guarda contra URLs vacías, sin bucles
  de error. El hero de la vista genérica lo usa.
- Script `scripts/audit-media-assets.mjs`: detecta URLs vacías, malformadas y
  archivos locales faltantes; opcional `--net` para HEAD remoto. Sale con
  código 1 si hay problemas (usable en CI).

## Evidencia
- `node scripts/audit-media-assets.mjs` → 0 problemas bloqueantes.
- `tests/unit/smart-image.test.tsx` → fallback, URL vacía, sin bucle, prioridad.
