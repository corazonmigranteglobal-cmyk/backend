# Auditoría del grafo de conocimiento (Graphify)

> **Fase 1 del plan de documentación.** Antes de escribir arquitectura, se interroga al grafo
> para descubrir el sistema real y se contrasta cada hallazgo contra el código.

- **Grafo analizado:** `graphify-out/graph.json`, reconstruido el 3 de agosto de 2026.
- **Commit del grafo:** `3580196d483f863b14052c002d60d37c8ba85d1a` — idéntico a `HEAD`.
- **Método:** análisis cuantitativo programático del grafo (recuentos por tipo, grados, componentes
  fuertemente conexos con el algoritmo de Tarjan, diferencia contra el árbol de archivos) y
  verificación puntual en el código de cada anomalía.

---

## 1. Resumen ejecutivo

El grafo describe el sistema con fidelidad **una vez reconstruido**. Tal y como estaba al empezar,
no lo describía: le faltaban 87 archivos de `src/`, entre ellos módulos completos. Ese fue el primer
hallazgo y condicionaba todo lo demás, porque cualquier documentación derivada del grafo obsoleto
habría descrito un sistema que ya no existe.

Tras la reconstrucción:

- **Cero divergencias** entre el grafo y el árbol de archivos, en ambos sentidos.
- **Nueve ciclos de importación reales**, todos entre modelos Sequelize y todos consecuencia
  deliberada de las asociaciones bidireccionales del ORM.
- **Un ciclo falso**, producto de una arista inferida por el extractor, descartado contra el código.
- **Ocho nodos huérfanos**, todos legítimos (configuración y scripts sin importadores).
- **Un patrón de acoplamiento dominante y sano:** casi todos los módulos de dominio dependen de
  `audit`, que es un servicio transversal de registro, no una dependencia de negocio.

---

## 2. Estado de partida: el grafo estaba desactualizado

| Métrica | Grafo inicial (`bd59eb5f`) | Grafo reconstruido (`3580196`) |
| --- | ---: | ---: |
| Nodos | 2 521 | 3 640 |
| Aristas | 5 237 | 7 623 |
| Comunidades | 204 | 295 |
| Archivos de `src/` ausentes del grafo | **87** | **0** |

Lo ausente no era marginal. Faltaban por completo:

- `src/observability/**` — los 24 archivos de telemetría, trazas y redacción de spans.
- `src/modules/downloadables/**` — módulo completo, incluido el adaptador de Hotmart.
- `src/modules/notifications/**` — módulo completo.
- `src/database/bootstrap/**` — el arranque idempotente de migraciones y *seeds*.
- Seis modelos del dominio de descargables y las notificaciones de administración.

**Acción ejecutada:** `python -m graphify update .` — reextracción AST sin coste de LLM.

**Riesgo documental identificado (D-01):** un grafo obsoleto no avisa de que lo está; responde con
seguridad sobre un sistema anterior. La disciplina de reconstrucción queda incorporada al proceso en
[docs/governance/documentation-policy.md](../governance/documentation-policy.md) y verificada en CI.

---

## 3. Inventario cuantitativo

### 3.1 Nodos por tipo

Clasificación derivada de la convención de nombres del repositorio (`*.controller.ts`,
`*.service.ts`, …) aplicada al campo `source_file` de cada nodo.

| Tipo | Nodos | Lectura |
| --- | ---: | --- |
| Documentación (`*.md`) | 904 | El corpus documental previo era voluminoso y disperso: 60 archivos sueltos en `docs/`. |
| Código sin sufijo convencional | 743 | Utilidades, tipos, configuración de `src/common` y `src/config`. |
| Servicios | 508 | Núcleo de la lógica de negocio. |
| Configuración (`*.json`, `*.yml`) | 293 | Incluye workflows, `package.json`, `tsconfig*`. |
| Controladores | 274 | Símbolos dentro de 34 clases de controlador. |
| Scripts | 188 | `scripts/**`: despliegue, humo, respaldo, verificación. |
| Otros TypeScript | 161 | Barriles (`index.ts`), constantes, tipos compartidos. |
| DTO | 129 | Contratos de entrada y salida. |
| Modelos | 119 | 58 modelos Sequelize y sus símbolos. |
| Pruebas | 97 | 41 suites unitarias más 2 e2e. |
| *Seeders* | 83 | Datos de arranque (`boot`) y de maqueta (`mockup`). |
| Módulos | 49 | 19 módulos de dominio más infraestructura. |
| Migraciones | 33 | 11 archivos de migración. |
| Adaptadores | 15 | Integraciones externas; principalmente Hotmart. |
| Guards | 14 | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` y sus pruebas. |
| Interceptores | 11 | `ResponseInterceptor`, `TraceResponseInterceptor`. |
| Decoradores | 8 | `@Public`, `@Roles`, `@Permissions`, `@CurrentUser`. |
| Filtros | 6 | `HttpExceptionFilter`. |
| Workers | 5 | Procesador del *outbox*. |

**Total: 3 640 nodos.**

### 3.2 Aristas por relación

| Relación | Aristas | Qué representa |
| --- | ---: | --- |
| `references` | 2 178 | Uso de un símbolo desde otro archivo. |
| `contains` | 1 731 | Pertenencia estructural (archivo → símbolo). |
| `imports` | 1 055 | Importación de símbolo. |
| `calls` | 1 094 | Invocación directa. |
| `imports_from` | 683 | Importación a nivel de archivo. |
| `method` | 637 | Método de una clase. |
| `re_exports` | 123 | Reexportación, casi toda desde barriles `index.ts`. |
| `indirect_call` | 63 | Invocación deducida, no literal. |
| `extends` / `inherits` | 38 | Herencia de clase. |
| `defines` | 21 | Definición de tipo o interfaz. |

**Total: 7 623 aristas.** Confianza: **7 560 `EXTRACTED` (99,2 %)** frente a **63 `INFERRED` (0,8 %)**.
Las aristas inferidas se tratan como hipótesis, no como hechos: la sección 5.2 documenta una que
resultó falsa.

---

## 4. Componentes críticos y puntos de entrada

### 4.1 Nodos de mayor centralidad

Grado total (entradas + salidas). Estos son los archivos cuyo cambio propaga más impacto.

| Grado | Nodo | Archivo | Por qué es crítico |
| ---: | --- | --- | --- |
| 175 | `index.ts` | `src/database/models/index.ts` | Barril que registra los 58 modelos en Sequelize. Tocarlo afecta al arranque completo. |
| 151 | `AuthenticatedUser` | `src/common/types/authenticated-user.ts` | Forma de la identidad que atraviesa guards, controladores y servicios. |
| 115 | `CurrentUser` | `src/common/decorators/current-user.decorator.ts` | Punto único por el que la identidad entra en cada handler. |
| 77 | `PaginationQueryDto` | `src/common/pagination/pagination.dto.ts` | Contrato de todos los listados, con sus alias legacy. |
| 64 | `Permissions()` | `src/common/decorators/permissions.decorator.ts` | Declara la autorización de grano fino de cada ruta. |
| 61 | `app.module.ts` | `src/app.module.ts` | Composición raíz: registra los cuatro guards globales. |
| 59 | `User` | `src/database/models/user.model.ts` | Entidad central del dominio. |
| 53 | `DownloadablesService` | `src/modules/downloadables/downloadables.service.ts` | Servicio más grande del repositorio. |
| 53 / 51 | `AuditService.log()` / `AuditService` | `src/modules/audit/audit.service.ts` | Invocado desde casi todos los módulos. |
| 42 | `appointments.service.ts` | `src/modules/appointments/appointments.service.ts` | Núcleo de la capacidad de negocio principal. |

**Consecuencia documental:** estos diez elementos concentran el riesgo de cambio y, por tanto, la
prioridad de documentación. Se recogen en la matriz de trazabilidad.

### 4.2 Puntos de entrada del sistema

Verificados contra el código, no deducidos del grafo:

| Punto de entrada | Ubicación | Notas |
| --- | --- | --- |
| API HTTP | `src/main.ts` → 189 rutas | Prefijo `api/v1`; `/health` queda fuera del prefijo a propósito. |
| Worker de *outbox* | `src/workers/outbox.worker.ts` | Proceso separado; consume la tabla `message_outbox`. |
| Webhook de Hotmart | `DownloadablesWebhookController` | Única entrada HTTP de un tercero. |
| Arranque de base de datos | `src/database/bootstrap/**` | Migraciones y *seeds* idempotentes al iniciar la API. |
| Scripts de operación | `scripts/**` | Despliegue de base, respaldo a Neon, pruebas de humo. |

### 4.3 Tamaño relativo de los módulos

| Módulo | Nodos | Controladores | Servicios | DTO |
| --- | ---: | ---: | ---: | ---: |
| `content` | 164 | 47 | 67 | 22 |
| `downloadables` | 121 | 37 | 51 | 11 |
| `files` | 117 | 18 | 72 | 5 |
| `advertising` | 114 | 31 | 52 | 19 |
| `auth` | 62 | 11 | 29 | 11 |
| `scheduling` | 62 | 18 | 29 | 5 |
| `messaging` | 57 | 7 | 30 | 2 |
| `cms` | 50 | 22 | 12 | 5 |
| `appointments` | 46 | 10 | 17 | 6 |
| `users` | 44 | 12 | 16 | 5 |
| `therapy-catalog` | 42 | 14 | 12 | 5 |
| `accounting` | 40 | 12 | 12 | 7 |
| `analytics` | 24 | 7 | 6 | 2 |
| `homepage` | 23 | 8 | 8 | 5 |
| `health` | 22 | 5 | 7 | 0 |
| `notifications` | 20 | 8 | 10 | 0 |
| `audit` | 17 | 4 | 5 | 0 |
| `roles-permissions` | 17 | 0 | 6 | 0 |
| `legacy-compatibility` | 11 | 3 | 0 | 0 |

**Observación:** `content`, `downloadables`, `files` y `advertising` concentran el 46 % de los nodos
de dominio. `files` destaca por su proporción de servicio frente a controlador (72 : 18): la lógica
de almacenamiento, seguridad y acceso pesa mucho más que su superficie HTTP.

---

## 5. Anomalías estructurales

### 5.1 Ciclos de importación

Se detectaron **10 componentes fuertemente conexos** y 29 pares de importación mutua.

**Nueve de los diez son ciclos entre modelos Sequelize:**

| Componente | Archivos | Dominio |
| --- | ---: | --- |
| `user` ↔ `role` ↔ `permission` ↔ `role-permission` ↔ `user-role` ↔ `refresh-token` ↔ `admin-profile` ↔ `patient-profile` ↔ `therapist-profile` ↔ `content-subscriber` | 10 | Identidad y RBAC |
| `ads-campaign` ↔ `ads-company` ↔ `ads-placement` ↔ `ads-campaign-creative` ↔ `ads-campaign-placement` ↔ `ads-campaign-content-target` | 6 | Publicidad |
| `content-publication` ↔ `content-author` ↔ `content-category` ↔ `content-tag` ↔ `content-publication-tag` | 5 | Contenido editorial |
| `account` ↔ `account-group` | 2 | Contabilidad |
| `accounting-entry` ↔ `accounting-transaction` | 2 | Contabilidad |
| `appointment` ↔ `appointment-status-history` | 2 | Citas |
| `cms-page` ↔ `cms-element` | 2 | CMS |
| `homepage-section` ↔ `homepage-featured-item` | 2 | Portada |
| `therapy-product` ↔ `therapy-approach` | 2 | Catálogo |

**Veredicto: no son un defecto.** `sequelize-typescript` expresa las asociaciones con decoradores
que referencian la clase del otro extremo (`@BelongsTo(() => User)`, `@HasMany(() => Appointment)`).
Una relación bidireccional produce necesariamente una importación mutua. El patrón es intencionado,
está confinado a la capa de modelos y no cruza fronteras de módulo. Queda registrado como decisión
en [ADR-0003](../adr/ADR-0003-orm-y-modelo-de-datos.md) para que ningún análisis futuro lo reabra
como si fuera deuda.

**El décimo componente es falso.** El grafo enlaza
`downloadables.service.ts` → `downloadables.service.spec.ts`. Verificado en el código: el servicio
no contiene ninguna referencia a su archivo de prueba. La arista es
`indirect_call` con confianza `INFERRED` (`.applyHotmartNotification()` → `resource()`, L723): una
coincidencia de nombres que el extractor resolvió hacia el símbolo equivocado. **Descartada.**

### 5.2 Nodos huérfanos

Ocho nodos sin ninguna arista. Revisados uno a uno; **ninguno indica código muerto**:

| Nodo | Motivo legítimo |
| --- | --- |
| `.eslintrc.js`, `jest.config.js` | Configuración que consumen las herramientas, no el código. |
| `src/database/sequelize-cli.config.cjs` | Lo lee `sequelize-cli` por convención de `.sequelizerc`. |
| `scripts/graphify-query.ps1` | Utilidad de consulta del propio grafo. |
| `sql/fix_uuid_defaults_and_front_seeds.sql`, `sql/seed_front_required_public_data.sql` | SQL de operación, ejecutado a mano. |
| `src/modules/accounting/accounting.service.spec.ts` | Prueba cuyo enlace al servicio el extractor no resolvió; el archivo sí importa el servicio. Artefacto de extracción, no huérfano real. |
| `pendientes.md` | El propio plan de documentación. |

---

## 6. Acoplamiento entre módulos

Aristas agregadas entre carpetas `src/modules/*`. Sólo se cuentan las que cruzan la frontera.

| Origen → Destino | Aristas |
| --- | ---: |
| `advertising` → `audit` | 23 |
| `content` → `audit` | 21 |
| `files` → `audit` | 15 |
| `cms` → `audit` | 13 |
| `auth` → `audit` | 12 |
| `therapy-catalog` → `audit` | 12 |
| `users` → `audit` | 11 |
| `auth` → `roles-permissions` | 11 |
| `accounting` → `audit` | 10 |
| `auth` → `messaging` | 10 |
| `appointments` → `audit` | 9 |
| `users` → `roles-permissions` | 9 |
| `scheduling` → `audit` | 8 |
| `appointments` → `messaging` | 7 |
| `appointments` → `notifications` | 7 |
| `homepage` → `advertising` | 6 |
| `appointments` → `scheduling` | 6 |
| `homepage` → `audit` | 6 |
| `downloadables` → `notifications` | 6 |
| `homepage` → `content` | 3 |

### Lectura

1. **`audit` es un sumidero transversal, no una dependencia de negocio.** Recibe aristas de diez
   módulos y no emite ninguna hacia ellos. Es el comportamiento correcto de un registro de auditoría:
   todo el mundo escribe, nadie depende de su lógica. No es acoplamiento excesivo.
2. **`auth` y `users` dependen ambos de `roles-permissions`**, que es la fuente única del RBAC.
   Coherente con el diseño: los guards resuelven roles y permisos contra ese módulo.
3. **`appointments` es el módulo con más dependencias salientes distintas** (`audit`, `messaging`,
   `notifications`, `scheduling`). Refleja que reservar una cita coordina disponibilidad, notifica al
   paciente y avisa al panel administrativo. Es el flujo de negocio más complejo del sistema y por eso
   se documenta en detalle en [Flujos críticos](../business/critical-workflows.md).
4. **`homepage` agrega tres dominios** (`content`, `advertising`, `audit`): es una vista de
   composición sobre contenido ajeno, no un dominio con entidades propias de peso.
5. **No hay ciclos entre módulos.** Ninguna pareja aparece en ambos sentidos.

---

## 7. Contraste entre el grafo y el código

| Comprobación | Resultado |
| --- | --- |
| Archivos `.ts` de `src/` presentes en el grafo | 100 % (0 ausentes) |
| Nodos del grafo que apuntan a archivos inexistentes | 0 |
| Commit del grafo frente a `HEAD` | Idénticos (`3580196`) |
| Rutas HTTP del grafo frente a rutas registradas por NestJS | Contrastado por vía independiente: la tabla de rutas se extrae de los metadatos de Nest en `scripts/generate-openapi.ts`, no del grafo. Coinciden 189/189. |
| Ciclos declarados por el grafo verificados en código | 9 confirmados, 1 descartado |
| Huérfanos declarados verificados en código | 8 revisados, 0 son código muerto |

---

## 8. Riesgos identificados

### Riesgos documentales

| ID | Riesgo | Severidad | Mitigación |
| --- | --- | --- | --- |
| D-01 | El grafo se desactualiza en silencio y responde con confianza sobre un sistema anterior | ALTA | Comprobación de frescura del grafo en CI: se compara `built_at_commit` con `HEAD`. |
| D-02 | Las aristas `INFERRED` (0,8 %) pueden inducir conclusiones falsas, como el ciclo descartado en 5.1 | MEDIA | Regla explícita: toda conclusión estructural derivada de una arista inferida se verifica en el código antes de documentarla. |
| D-03 | 904 nodos de documentación previa, dispersos y en buena parte históricos (hotfixes, notas de versión) | MEDIA | Reorganización en el portal; el material histórico se conserva pero deja de competir con la documentación viva. |

### Riesgos arquitectónicos

| ID | Riesgo | Severidad | Estado |
| --- | --- | --- | --- |
| A-01 | `src/database/models/index.ts` concentra el grado más alto del grafo: cualquier error ahí rompe el arranque completo | MEDIA | Aceptado. Es la consecuencia natural del registro centralizado de modelos que exige `SequelizeModule`. Cubierto por `associations.spec.ts`. |
| A-02 | `files` tiene 72 nodos de servicio frente a 18 de controlador: mucha lógica de almacenamiento y seguridad concentrada | MEDIA | Documentado en el módulo; la complejidad es real y responde a dos proveedores de almacenamiento intercambiables. |
| A-03 | `content` y `downloadables` superan los 120 nodos cada uno | BAJA | Aceptado. Son los dominios con más superficie funcional (47 y 37 símbolos de controlador). |
| A-04 | Los ciclos entre modelos impiden mover un modelo de módulo sin arrastrar sus vecinos | BAJA | Aceptado y registrado en ADR-0003. |

---

## 9. Acciones ejecutadas en esta fase

1. Reconstrucción del grafo con `graphify update` — 87 archivos recuperados.
2. Análisis programático completo: recuentos, grados, Tarjan, diferencia contra el sistema de archivos.
3. Verificación en código de las 10 anomalías estructurales; 1 descartada por falso positivo.
4. Extracción independiente de la tabla de 189 rutas desde los metadatos de NestJS.
5. Redacción de los artefactos derivados:
   - [Dependencias entre módulos](../architecture/module-dependencies.md)
   - [Mapa de integraciones](../architecture/integration-map.md)
   - [Matriz de trazabilidad](../governance/traceability-matrix.md)

## 10. Criterio de salida de la Fase 1

| Criterio | Estado |
| --- | --- |
| Artefactos de Graphify consultados | ✅ `graph.json`, `GRAPH_REPORT.md`, `manifest.json`, `.graphify_labels.json` |
| Inventario por tipo de nodo y relación | ✅ sección 3 |
| Módulos y componentes críticos identificados | ✅ sección 4 |
| Ciclos analizados y clasificados | ✅ sección 5.1 |
| Huérfanos revisados | ✅ sección 5.2 |
| Diferencias entre grafo y código resueltas | ✅ sección 7 |
| Riesgos registrados | ✅ sección 8 |
| Informe previo a toda documentación arquitectónica | ✅ este documento precede a `docs/architecture/**` |

**Fase 1 cerrada.**
