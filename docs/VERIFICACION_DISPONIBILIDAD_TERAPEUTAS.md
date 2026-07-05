# Verificación de endpoints de disponibilidad de terapeutas

Se verificó en la última versión disponible del backend que siguen existiendo los endpoints que calculan horarios disponibles por terapeuta.

## Endpoints existentes

```txt
GET  /api/v1/booking/availability
GET  /api/v1/therapists/me/schedules
POST /api/v1/therapists/me/schedules
POST /api/v1/therapists/me/blocked-times
```

## Endpoint principal para booking

```txt
GET /api/v1/booking/availability?therapistUserId=<uuid>&productId=<uuid>&from=2026-07-01&to=2026-07-14&timezone=America/La_Paz
```

Este endpoint existe en:

```txt
src/modules/scheduling/scheduling.controller.ts
```

Y llama a:

```txt
SchedulingService.getAvailability(...)
```

## Regla de cálculo confirmada

La disponibilidad se calcula desde:

```txt
therapist_schedules
```

Luego se restan:

```txt
therapist_blocked_times con status ACTIVE
appointments con status REQUESTED o CONFIRMED
```

Por eso el resultado final entrega únicamente slots libres. Es decir, descuenta bloqueos de agenda y horarios ya ocupados.

## Nota técnica

En la versión revisada, el cálculo está implementado en el servicio de scheduling. No se encontró una `CREATE VIEW` SQL activa para disponibilidad en las migraciones actuales. Aun así, el comportamiento funcional esperado se mantiene: el endpoint devuelve horarios disponibles después de excluir bloqueos y citas activas.
