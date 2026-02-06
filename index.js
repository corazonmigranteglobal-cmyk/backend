const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();
// Setup secrets (Google Credentials) from ENV if needed
require("./src/core/setupSecrets").setupSecrets();

const db = require("./src/core/db/dbUitls");
const { logger } = require("./src/core/logger");

const { emailRoutes } = require("./src/routes/email.routes");
const { filesRoutes } = require("./src/routes/files.routes");
const { initRedis } = require("./src/core/cache/redis");

const terapiaRoutes = require("./src/routes/terapia.routes");
const usuariosRoutes = require("./src/routes/usuarios.routes");
const publicoRoutes = require("./src/routes/publico.routes");
const contabilidadRoutes = require("./src/routes/contabilidad.routes");

const { errorHandler } = require("./src/core/http/errorHandler");

const app = express();

// =====================================================
// Middlewares globales
// =====================================================

// ✅ Permitir que translate.google.com embeba la web (PROD incluido)
// Esto evita el error: "The website is not accessible through this address."
app.use(
  helmet({
    // Evita X-Frame-Options: SAMEORIGIN / DENY
    frameguard: false,

    // Permite "frame-ancestors" para Google Translate
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "frame-ancestors": [
          "'self'",
          "https://translate.google.com",
          "https://translate.googleusercontent.com",
        ],
      },
    },
  })
);

app.use(
  cors({
    origin: [
      "https://dev.corazondemigrante.com/",
      "https://dev.corazondemigrante.com",
      "https://corazondemigrante.com",
      "http://localhost:5173",
    ],
    allowedHeaders: ["Content-Type", "x-api-key", "Authorization"],
  })
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Health
app.get("/health", (req, res) => {
  return res.status(200).json({
    ok: true,
    message: "API de agenda de terapia funcionando",
  });
});

app.use(emailRoutes({ projectRootDir: __dirname }));
app.use(filesRoutes({ projectRootDir: __dirname }));
app.use("/api/terapia", terapiaRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/publico", publicoRoutes);
app.use("/api/contabilidad", contabilidadRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3003;

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection", { reason });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", { error: err });
});

const fs = require("fs");
async function startServer() {
  try {
    console.log("[cwd]", process.cwd());
    console.log("[GAC raw]", process.env.GOOGLE_APPLICATION_CREDENTIALS);

    const abs = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log("[GAC abs]", abs);
    console.log("[GAC exists]", fs.existsSync(abs));

    console.log("MAIL_PROVIDER:", process.env.MAIL_PROVIDER);
    console.log("HAS_SENDGRID_KEY:", !!process.env.SENDGRID_API_KEY);
    console.log(
      "KEY_PREFIX:",
      (process.env.SENDGRID_API_KEY || "").slice(0, 3)
    ); // debería ser "SG."

    try {
      await initRedis();
    } catch (e) {
      console.warn("[redis:init_failed]", e?.message || String(e));
    }

    app.listen(PORT, () => {
      console.log(`Servidor escuchando en puerto ${PORT}`);
      console.log(`Email listening`);
      console.log(`GCS listening`);
    });
  } catch (error) {
    console.error("Error al conectar con la base de datos:", error);
    process.exit(1);
  }
}

startServer();

/* 
========================================
npm instal express                     |
npm body-parser                        |
npm nodemon                            |
npm helmet                             |
npm corse                              |
npm pg                                 |
npm winston                            | 
========================================
*/
