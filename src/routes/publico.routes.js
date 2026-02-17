const { Router } = require("express");
const multer = require("multer");
const { asyncHandler } = require("../core/http/asyncHandler.js");
const { publicoController } = require("../controllers/publico.controller.js");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});
const router = Router();

// =========================
// UI PÚBLICA - ELEMENTOS
// =========================
router.post("/ui/elementos/listar", asyncHandler(publicoController.listarElementosUi));
router.post("/ui/elementos/obtener", asyncHandler(publicoController.obtenerElementoUi));
router.post("/ui/elementos/crear", asyncHandler(publicoController.crearElementoUi));
router.post("/ui/elementos/actualizar", asyncHandler(publicoController.actualizarElementoUi));
router.post("/ui/elementos/apagar", asyncHandler(publicoController.apagarElementoUi));
router.post("/ui/elementos/actualizar-con-archivo", upload.single("file"),asyncHandler(publicoController.actualizarElementoUiConArchivo));

// =========================
// UI PÚBLICA - SERVIDORES DE ARCHIVOS (catálogo)
// =========================
router.post("/ui/servidores-archivos/listar", asyncHandler(publicoController.listarServidoresArchivos));

// =========================
// UI PÚBLICA - BOOTSTRAP
// =========================
router.post("/ui/bootstrap", asyncHandler(publicoController.uiBootstrap));
router.get("/ui/pagina-publica", asyncHandler(publicoController.obtenerPaginaPublicaBundle));

// =========================
// UI PÚBLICA - PÁGINAS
// =========================
router.post("/ui/paginas/listar", asyncHandler(publicoController.listarPaginasUi));
router.post("/ui/paginas/obtener", asyncHandler(publicoController.obtenerPaginaUi));
router.post("/ui/paginas/crear", asyncHandler(publicoController.crearPaginaUi));
router.post("/ui/paginas/actualizar", asyncHandler(publicoController.actualizarPaginaUi));
router.post("/ui/paginas/apagar", asyncHandler(publicoController.apagarPaginaUi));

module.exports = router;

