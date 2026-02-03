"use strict";

const express = require("express");
const path = require("path");
const multer = require("multer");

const {
  ensureUserFolders,
  uploadAtPath,
  signedRead,
  exists,
  deleteFile,
  list,
  copy,
  move,
  download,
} = require("../controllers/files.controller");

const { requireApiKey } = require("../core/http/requireApiKey");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

function filesRoutes({ projectRootDir }) {
  const router = express.Router();

  // Static (si lo usas)
  router.use("/files", express.static(path.join(projectRootDir, "files")));

  // API protegida
  router.post("/api/files/ensure-user-folders", requireApiKey, ensureUserFolders);
  router.post("/api/files/upload", requireApiKey, upload.single("file"), uploadAtPath);

  router.get("/api/files/signed-read", requireApiKey, signedRead);
  router.get("/api/files/exists", requireApiKey, exists);
  router.delete("/api/files/delete", requireApiKey, deleteFile);

  router.get("/api/files/list", requireApiKey, list);
  router.post("/api/files/copy", requireApiKey, copy);
  router.post("/api/files/move", requireApiKey, move);
  router.get("/api/files/download", requireApiKey, download);

  return router;
}

module.exports = { filesRoutes };

