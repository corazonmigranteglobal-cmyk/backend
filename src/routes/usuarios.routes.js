const { Router } = require("express");
const { asyncHandler } = require("../core/http/asyncHandler.js");
const { usuariosController } = require("../controllers/usuarios.controller.js");

const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const router = Router();

router.post("/login", asyncHandler(usuariosController.loginPassword));

router.post("/signup/admin", asyncHandler(usuariosController.signupAdmin));
router.post("/signup/paciente", asyncHandler(usuariosController.signupPaciente));
router.post("/signup/terapeuta", asyncHandler(usuariosController.signupTerapeuta));
router.post("/verify-pin", asyncHandler(usuariosController.verifyAuthPin));

router.patch("/paciente/modificar", asyncHandler(usuariosController.updatePacienteFull));
router.patch("/admin/modificar", asyncHandler(usuariosController.updateAdminFull));
router.patch("/terapeuta/modificar", asyncHandler(usuariosController.updateTerapeutaFull));
router.post("/auth-pin/request", asyncHandler(usuariosController.requestNewAuthPin));
router.post("/password-recovery/request", asyncHandler(usuariosController.requestPasswordRecoveryPin));
router.post("/password/recovery/update", asyncHandler(usuariosController.updatePasswordRecovery));

router.post("/super_usuarios/estado/listar", asyncHandler(usuariosController.superListarUsuariosEstado));
router.post("/super_usuarios/:user_id/estado", asyncHandler(usuariosController.superSetUsuarioEstado));

router.get("/terapeutas/sin-admin-activo",asyncHandler(usuariosController.getTerapeutasSinAdminActivo));

router.patch("/obtener/terapeuta", usuariosController.obtenerUsuarioTerapeuta);
router.patch("/obtener/admin", usuariosController.obtenerUsuarioAdmin);
router.post("/archivo/actualizar-con-archivo", upload.single("file"), asyncHandler(usuariosController.actualizarUsuarioArchivoConArchivo));
router.patch("/terapeuta/:user_id/con-archivo",upload.single("file"),asyncHandler(usuariosController.updateTerapeutaFullConArchivo));

module.exports = router;
