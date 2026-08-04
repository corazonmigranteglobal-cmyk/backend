# ADR-0015: Interoperabilidad de módulos CommonJS

## Estado
Aceptado

## Contexto

`tsconfig.json` activa `allowSyntheticDefaultImports` pero **no** `esModuleInterop`. La primera opción
sólo afecta a la comprobación de tipos: permite escribir `import x from "cjs-module"` sin error de
compilación. La segunda es la que hace que TypeScript **emita** el ayudante de interoperabilidad.

Con una activada y la otra no, el código compila y falla en ejecución. Fue exactamente lo que ocurrió:
`test/auth.e2e-spec.ts` usaba `import request from "supertest"`, TypeScript emitía `supertest_1.default`
y en un módulo CommonJS eso es `undefined`. **La suite e2e llevaba sin poder ejecutarse un tiempo
indeterminado**, y ni `yarn typecheck` ni `yarn lint` podían detectarlo porque el error es de ejecución.

## Opciones consideradas

1. **Activar `esModuleInterop: true`.** Es el valor por defecto de NestJS y elimina la clase entera de
   error. Pero cambia la semántica de *todos* los imports del proyecto y obliga a revalidar 41 suites
   y el arranque completo.
2. **Corregir el import afectado** con `import * as request from "supertest"`, que es la forma correcta
   bajo la configuración actual.

## Decisión

Se aplica la opción 2 y se registra la 1 como cambio pendiente con su propio riesgo. Corregir un
archivo desbloquea la suite e2e hoy; cambiar la configuración global merece su propia validación.

## Consecuencias negativas

- La incoherencia entre las dos opciones sigue ahí, así que el mismo error puede repetirse en un
  archivo nuevo que importe un módulo CommonJS con import por defecto.
- La defensa actual es que `yarn test:e2e` se ejecuta ahora en CI, donde antes no se ejecutaba.

## Evidencia

- [`test/auth.e2e-spec.ts`](../../test/auth.e2e-spec.ts)
- [Línea base, hallazgo B-03](../reports/baseline.md)

## Plan de revisión
Activar `esModuleInterop` en la próxima ventana en la que se pueda revalidar el arranque completo.
