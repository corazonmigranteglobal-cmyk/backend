const { Router } = require("express");
const { asyncHandler } = require("../core/http/asyncHandler.js");
const { contabilidadController } = require("../controllers/contabilidad.controller.js");

const router = Router();

// =========================
// GRUPOS DE CUENTA
// =========================
router.post("/grupos-cuenta/listar", asyncHandler(contabilidadController.listarGruposCuenta));
router.post("/grupos-cuenta/crear", asyncHandler(contabilidadController.crearGrupoCuenta));
router.post("/grupos-cuenta/editar", asyncHandler(contabilidadController.editarGrupoCuenta));

// =========================
// CUENTAS
// =========================
router.post("/cuentas/listar", asyncHandler(contabilidadController.listarCuentas));
router.post("/cuentas/crear", asyncHandler(contabilidadController.crearCuenta));
router.post("/cuentas/editar", asyncHandler(contabilidadController.editarCuenta));
router.post("/cuentas/apagar", asyncHandler(contabilidadController.apagarCuenta));

// =========================
// GRUPOS DE CUENTA 
// =========================
router.post("/grupos-cuenta/listar", asyncHandler(contabilidadController.listarGruposCuenta));
router.post("/grupos-cuenta/crear", asyncHandler(contabilidadController.crearGrupoCuenta));
router.post("/grupos-cuenta/editar", asyncHandler(contabilidadController.editarGrupoCuenta));
router.post("/grupos-cuenta/apagar", asyncHandler(contabilidadController.apagarGrupoCuenta));

// =========================
// CENTROS DE COSTO
// =========================
router.post("/centros-costo/listar", asyncHandler(contabilidadController.listarCentrosCosto));
router.post("/centros-costo/crear", asyncHandler(contabilidadController.crearCentroCosto));
router.post("/centros-costo/editar", asyncHandler(contabilidadController.editarCentroCosto));
router.post("/centros-costo/apagar", asyncHandler(contabilidadController.apagarCentroCosto));

// =========================
// TRANSACCIONES
// =========================
router.post("/transacciones/listar", asyncHandler(contabilidadController.listarTransacciones));
router.post("/transacciones/batch/crear", asyncHandler(contabilidadController.crearTransaccionesBatch));
router.post("/transacciones/apagar", asyncHandler(contabilidadController.apagarTransaccion));
router.post("/transacciones/venta/crear",contabilidadController.crearTransaccionVenta);

module.exports = router;
