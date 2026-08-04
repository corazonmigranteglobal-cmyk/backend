# Módulo `advertising`

!!! info "Página generada"
    Los inventarios de esta página los genera `scripts/generate-module-docs.mjs` a partir de los metadatos de NestJS y del contrato OpenAPI. El contexto de negocio se edita en `docs/modules/_context/advertising.md`. No edites este archivo directamente.

## Ficha

| Dato | Valor |
| --- | --- |
| Ruta en el código | `src/modules/advertising/` |
| Etiqueta en la API | `Publicidad` |
| Operaciones HTTP | 23 |
| Controladores | 2 |
| Servicios | 5 |
| DTO | 5 |
| Políticas de dominio | 2 |
| Adaptadores externos | 0 |
| Suites de prueba | 1 |
| Roles que intervienen | `ADMIN`, `SUPER_ADMIN` |
| Permisos que exige | — |

## Por qué existe

Sostiene la financiación del proyecto editorial: empresas anunciantes contratan campañas que se
muestran en emplazamientos concretos del sitio público.

## Reglas de dominio

- **La jerarquía es empresa → campaña → creatividad → emplazamiento.** Una campaña sin creatividad
  asociada no se muestra.
- **Las fechas de campaña las valida una política explícita**
  (`policies/campaign-date.policy.ts`): una campaña no puede terminar antes de empezar ni activarse
  fuera de su ventana.
- **Las impresiones se registran** (`ads_impression`) para poder justificar lo facturado.
- **La resolución pública no expone datos del anunciante**, sólo la creatividad que toca mostrar.

## Endpoints

| Operación | Qué hace | Acceso | Permisos |
| --- | --- | --- | --- |
| `GET /api/v1/admin/advertising/ads` | Listar creatividades del catálogo | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/advertising/ads` | Crear una creatividad | `ADMIN`, `SUPER_ADMIN` | — |
| `DELETE /api/v1/admin/advertising/ads/{id}` | Eliminar una creatividad | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/advertising/ads/{id}` | Actualizar una creatividad | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/advertising/campaigns` | Listar campañas publicitarias | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/advertising/campaigns` | Crear una campaña publicitaria | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/advertising/campaigns/{campaignId}/creatives` | Listar las creatividades asociadas a una campaña | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/advertising/campaigns/{campaignId}/creatives` | Asociar una creatividad a una campaña | `ADMIN`, `SUPER_ADMIN` | — |
| `DELETE /api/v1/admin/advertising/campaigns/{id}` | Eliminar una campaña publicitaria | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/advertising/campaigns/{id}` | Consultar el detalle de una campaña | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/advertising/campaigns/{id}` | Actualizar una campaña publicitaria | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/advertising/campaigns/{id}/status` | Cambiar el estado de una campaña | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/advertising/companies` | Listar empresas anunciantes | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/advertising/companies` | Registrar una empresa anunciante | `ADMIN`, `SUPER_ADMIN` | — |
| `DELETE /api/v1/admin/advertising/companies/{id}` | Dar de baja una empresa anunciante | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/advertising/companies/{id}` | Actualizar una empresa anunciante | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/advertising/creatives/{id}` | Actualizar una creatividad de campaña | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/admin/advertising/placements` | Listar emplazamientos publicitarios disponibles | `ADMIN`, `SUPER_ADMIN` | — |
| `POST /api/v1/admin/advertising/placements` | Crear un emplazamiento publicitario | `ADMIN`, `SUPER_ADMIN` | — |
| `PATCH /api/v1/admin/advertising/placements/{id}` | Actualizar un emplazamiento publicitario | `ADMIN`, `SUPER_ADMIN` | — |
| `GET /api/v1/advertising/placements` | Listar los emplazamientos publicitarios públicos | Público | — |
| `GET /api/v1/advertising/slots` | Resolver los anuncios que corresponden a cada emplazamiento | Público | — |
| `GET /api/v1/public/advertising` | Resolver anuncios por emplazamiento (alias de compatibilidad) | Público | — |

## Código

**Controladores**

- [`src/modules/advertising/admin-advertising.controller.ts`](../../src/modules/advertising/admin-advertising.controller.ts)
- [`src/modules/advertising/public-advertising.controller.ts`](../../src/modules/advertising/public-advertising.controller.ts)

**Servicios**

- [`src/modules/advertising/advertising-campaigns.service.ts`](../../src/modules/advertising/advertising-campaigns.service.ts)
- [`src/modules/advertising/advertising-companies.service.ts`](../../src/modules/advertising/advertising-companies.service.ts)
- [`src/modules/advertising/advertising-creatives.service.ts`](../../src/modules/advertising/advertising-creatives.service.ts)
- [`src/modules/advertising/advertising-placements.service.ts`](../../src/modules/advertising/advertising-placements.service.ts)
- [`src/modules/advertising/advertising-public.service.ts`](../../src/modules/advertising/advertising-public.service.ts)

**Políticas de dominio**

- [`src/modules/advertising/policies/campaign-date.policy.spec.ts`](../../src/modules/advertising/policies/campaign-date.policy.spec.ts)
- [`src/modules/advertising/policies/campaign-date.policy.ts`](../../src/modules/advertising/policies/campaign-date.policy.ts)

**DTO**

- [`src/modules/advertising/dto/advertising-query.dto.ts`](../../src/modules/advertising/dto/advertising-query.dto.ts)
- [`src/modules/advertising/dto/campaign.dto.ts`](../../src/modules/advertising/dto/campaign.dto.ts)
- [`src/modules/advertising/dto/company.dto.ts`](../../src/modules/advertising/dto/company.dto.ts)
- [`src/modules/advertising/dto/creative.dto.ts`](../../src/modules/advertising/dto/creative.dto.ts)
- [`src/modules/advertising/dto/placement.dto.ts`](../../src/modules/advertising/dto/placement.dto.ts)

## Modelo de datos

Entidades que este módulo lee o escribe:

- `AdsCampaign` — ver [catálogo de entidades](../data/entity-catalog.md)
- `AdsCampaignContentTarget` — ver [catálogo de entidades](../data/entity-catalog.md)
- `AdsCampaignCreative` — ver [catálogo de entidades](../data/entity-catalog.md)
- `AdsCampaignPlacement` — ver [catálogo de entidades](../data/entity-catalog.md)
- `AdsCompany` — ver [catálogo de entidades](../data/entity-catalog.md)
- `AdsPlacement` — ver [catálogo de entidades](../data/entity-catalog.md)
- `CmsPage` — ver [catálogo de entidades](../data/entity-catalog.md)
- `ContentCategory` — ver [catálogo de entidades](../data/entity-catalog.md)
- `ContentPublication` — ver [catálogo de entidades](../data/entity-catalog.md)

## Pruebas

- [`src/modules/advertising/policies/campaign-date.policy.spec.ts`](../../src/modules/advertising/policies/campaign-date.policy.spec.ts)

