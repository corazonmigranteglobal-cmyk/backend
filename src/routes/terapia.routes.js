const { Router } = require("express");
const multer = require("multer");
const { asyncHandler } = require("../core/http/asyncHandler.js");
const { terapiaController } = require("../controllers/terapia.controller.js");

const router = Router();

// =========================
// UPLOADS (multipart/form-data)
// =========================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});


// =========================
// ENFOQUES
// =========================
router.post("/enfoques/listar", asyncHandler(terapiaController.listarEnfoques));
router.post("/enfoques/crear", asyncHandler(terapiaController.crearEnfoque));
router.post("/enfoques/modificar", asyncHandler(terapiaController.updateEnfoque));
router.post("/enfoques/apagar", asyncHandler(terapiaController.apagarEnfoque));

// =========================
// PRODUCTOS
// =========================
router.post("/productos/listar", asyncHandler(terapiaController.listarProductos));
router.post("/productos/crear", asyncHandler(terapiaController.crearProducto));
router.post("/productos/modificar", asyncHandler(terapiaController.updateProducto));
router.post("/productos/apagar", asyncHandler(terapiaController.apagarProducto));


// =========================
// HORARIOS TERAPEUTA
// =========================
router.post("/horarios/obtener", asyncHandler(terapiaController.obtenerHorariosTerapeuta));
router.post("/horarios/crear", asyncHandler(terapiaController.crearHorarioTerapeuta));
router.post("/horarios/actualizar-versionado", asyncHandler(terapiaController.actualizarHorarioTerapeutaVersionado));
router.post("/horarios/obtener-disponibilidad", asyncHandler(terapiaController.obtenerDisponibilidadHorarios));
router.post("/horarios/apagar", asyncHandler(terapiaController.apagarHorarioTerapeuta));

// =========================
// BLOQUEOS AGENDA
// =========================
router.post("/agenda/bloqueos/crear", asyncHandler(terapiaController.crearBloqueoAgenda));
router.post("/agenda/bloqueos/apagar", asyncHandler(terapiaController.apagarBloqueoAgenda));

// =========================
// CITAS
// =========================
router.post("/citas/registrar", asyncHandler(terapiaController.registrarCita));
router.post("/citas/detalle/actualizar", asyncHandler(terapiaController.actualizarDetalleCita));
router.post("/citas/estados/actualizar", asyncHandler(terapiaController.actualizarEstadoCita));
router.post("/citas/apagar", asyncHandler(terapiaController.apagarCita));

// =========================
// ADMIN - SOLICITUDES
// =========================
router.post("/admin/citas/solicitudes/listar", asyncHandler(terapiaController.listarSolicitudesCitaAdmin));

// =========================
// BOOTSTRAPS
// =========================
router.post("/bootstrap/enfoque-producto", asyncHandler(terapiaController.bootstrapEnfoqueProducto));
router.post("/booking/bootstrap", asyncHandler(terapiaController.bookingBootstrap));


router.patch("/producto/obtener", terapiaController.obtenerProducto);
router.patch("/enfoque/obtener", terapiaController.obtenerEnfoque);
router.post( "/enfoques/crear-con-archivo",upload.single("file"), asyncHandler(terapiaController.crearEnfoqueConArchivo));
router.post("/enfoques/modificar-con-archivo", upload.single("file"), asyncHandler(terapiaController.updateEnfoqueConArchivo));

module.exports = router;
