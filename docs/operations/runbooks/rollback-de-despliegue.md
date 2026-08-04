# Runbook: revertir un despliegue

**Cuándo:** un despliegue ha degradado el servicio y la causa no es evidente ni rápida de corregir.

## La pregunta que decide todo

**¿El despliegue incluía una migración de base de datos?**

```bash
git diff <commit-anterior>..<commit-desplegado> --name-only -- src/database/migrations/
```

| Respuesta | Vía |
| --- | --- |
| No | Revertir el código. Es seguro y rápido |
| Sí | Sigue leyendo antes de tocar nada |

## Sin migraciones: revertir el código

```bash
# En la plataforma de despliegue, volver a la revisión anterior.
curl -f "$PUBLIC_BASE_URL/health"
curl -sS "$PUBLIC_BASE_URL/health" | jq -r .data.commit   # confirmar la revisión activa
```

`/health` devuelve el commit desplegado, así que sirve para confirmar que la reversión surtió
efecto y no quedó una instancia antigua sirviendo tráfico.

## Con migraciones: no revertir a ciegas

Una versión anterior del código contra un esquema nuevo consulta columnas que quizá ya no existen,
o escribe sin cumplir restricciones nuevas. **Revertir el código sin revertir el esquema puede
corromper datos.**

### Caso A — la migración sólo añade

Añadir tablas, columnas nullable o índices es **compatible hacia atrás**: el código anterior las
ignora.

**Revertir sólo el código. No tocar el esquema.** Es la situación más frecuente y la más segura.

### Caso B — la migración endurece o transforma

Añadir `NOT NULL`, estrechar un tipo, renombrar o borrar columnas, o transformar datos.

```bash
yarn db:migrate:undo    # deshace la última aplicada
```

!!! danger "Comprueba que el `down` existe y es real"
    Una migración que transforma datos raramente puede revertirse sin pérdida. Si el `down` está
    vacío o no reconstruye el estado anterior, **no lo ejecutes**: pasa al
    [runbook de recuperación desde copia](recuperacion-desde-copia.md).

### Caso C — no se puede revertir el esquema

Es lo habitual cuando la migración destruyó información. Entonces la vía no es el rollback sino
**avanzar**: desplegar una corrección encima.

Suele ser más rápido y más seguro que intentar reconstruir un estado que ya no existe.

## Orden de las operaciones

Importa, y equivocarse alarga la incidencia:

```
1. Parar el worker de outbox      (evita que procese con código inconsistente)
2. Revertir el código de la API
3. Revertir el esquema, sólo si es el caso B y el `down` es fiable
4. Comprobar /health
5. Arrancar el worker
```

## Verificar

```bash
curl -sS "$PUBLIC_BASE_URL/health" | jq .
```

Después, ejercitar los recorridos críticos: iniciar sesión, consultar disponibilidad, listar la
agenda propia. Son los cuatro que definen que el servicio «funciona»
([SLO](../../observability/service-level-objectives.md)).

## Después

- Anota qué falló y por qué no lo detectó `verify:ci`. Casi siempre señala un hueco de pruebas.
- Si la causa fue una migración, revisa si podía haberse escrito en tres pasos compatibles
  (añadir nullable → rellenar → endurecer). Es la forma correcta para tablas con datos en
  producción.
- Las migraciones **no se ejecutan en CI** ([G-28](../../reports/documentation-gap-analysis.md)).
  Si esta incidencia fue por una migración, cerrar esa brecha pasa a ser prioritario.

## Lo que hoy no existe

| Capacidad | Estado |
| --- | --- |
| Despliegue gradual o canario | No |
| Reversión automática por métricas | No: no hay métricas |
| Comprobación de humo automática tras desplegar | Existe `yarn smoke:deep`, pero no está integrada en el despliegue |
