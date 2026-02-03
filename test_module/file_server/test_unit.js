let lastSignedUrl = null;

function $(id) { return document.getElementById(id); }

function setOut(ok, data) {
  $("status").innerHTML = ok
    ? `<span class="ok">OK</span>`
    : `<span class="bad">ERROR</span>`;
  $("out").textContent = JSON.stringify(data, null, 2);
}

function headers() {
  const h = { "Content-Type": "application/json" };
  const apiKey = $("apiKey").value.trim();
  if (apiKey) h["x-api-key"] = apiKey;
  return h;
}

function base() {
  return $("baseUrl").value.trim().replace(/\/+$/, "");
}

/**
 * Convención de endpoints esperados:
 * POST   /api/files/users/:userId/ensure-folders
 * POST   /api/files/upload-at-path
 * POST   /api/files/signed-read
 * POST   /api/files/exists
 * DELETE /api/files/delete  (body con targetPath) o POST /delete
 * POST   /api/files/list
 * POST   /api/files/copy
 * POST   /api/files/move
 * GET    /api/files/download?path=...
 *
 * Si tus rutas son distintas, cámbialas aquí.
 */
const API = {
  ensureFolders: (userId) => `${base()}/api/files/users/${encodeURIComponent(userId)}/ensure-folders`,
  uploadAtPath: () => `${base()}/api/files/upload-at-path`,
  signedRead: () => `${base()}/api/files/signed-read`,
  exists: () => `${base()}/api/files/exists`,
  del: () => `${base()}/api/files/delete`,
  list: () => `${base()}/api/files/list`,
  copy: () => `${base()}/api/files/copy`,
  move: () => `${base()}/api/files/move`,
  download: (path) => `${base()}/api/files/download?path=${encodeURIComponent(path)}`,
};

async function jpost(url, body) {
  const res = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function jdel(url, body) {
  // fetch DELETE con body funciona en muchos entornos; si tu backend no lo soporta,
  // cambia este endpoint a POST /delete.
  const res = await fetch(url, { method: "DELETE", headers: headers(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function uploadFileMultipart(url, { targetPath, file, contentType }) {
  const fd = new FormData();
  fd.append("targetPath", targetPath);
  if (contentType) fd.append("contentType", contentType);
  fd.append("file", file);

  const apiKey = $("apiKey").value.trim();
  const h = {};
  if (apiKey) h["x-api-key"] = apiKey;

  const res = await fetch(url, { method: "POST", headers: h, body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

$("btnEnsure").addEventListener("click", async () => {
  try {
    const userId = $("userId").value.trim();
    const data = await jpost(API.ensureFolders(userId), {});
    setOut(true, data);
  } catch (e) {
    setOut(false, e);
  }
});

$("btnUpload").addEventListener("click", async () => {
  try {
    const targetPath = $("uploadPath").value.trim();
    const contentType = $("contentType").value.trim();
    const file = $("fileInput").files?.[0];
    if (!file) return setOut(false, { error: "Selecciona un archivo" });
    const data = await uploadFileMultipart(API.uploadAtPath(), { targetPath, file, contentType });
    setOut(true, data);
  } catch (e) {
    setOut(false, e);
  }
});

$("btnSignedRead").addEventListener("click", async () => {
  try {
    const targetPath = $("signedReadPath").value.trim();
    const ttlSeconds = Number($("ttl").value || 900);
    const data = await jpost(API.signedRead(), { targetPath, ttlSeconds });
    lastSignedUrl = data?.url || data?.data?.url || null;
    setOut(true, data);
  } catch (e) {
    setOut(false, e);
  }
});

$("btnOpenSigned").addEventListener("click", () => {
  if (!lastSignedUrl) return setOut(false, { error: "Primero genera una signed URL" });
  window.open(lastSignedUrl, "_blank");
});

$("btnExists").addEventListener("click", async () => {
  try {
    const targetPath = $("targetPathBasic").value.trim();
    const data = await jpost(API.exists(), { targetPath });
    setOut(true, data);
  } catch (e) {
    setOut(false, e);
  }
});

$("btnDelete").addEventListener("click", async () => {
  try {
    const targetPath = $("targetPathBasic").value.trim();
    const data = await jdel(API.del(), { targetPath });
    setOut(true, data);
  } catch (e) {
    setOut(false, e);
  }
});

$("btnList").addEventListener("click", async () => {
  try {
    const prefix = $("listPrefix").value.trim();
    const data = await jpost(API.list(), { prefix });
    setOut(true, data);
  } catch (e) {
    setOut(false, e);
  }
});

$("btnCopy").addEventListener("click", async () => {
  try {
    const fromPath = $("fromPath").value.trim();
    const toPath = $("toPath").value.trim();
    const data = await jpost(API.copy(), { fromPath, toPath });
    setOut(true, data);
  } catch (e) {
    setOut(false, e);
  }
});

$("btnMove").addEventListener("click", async () => {
  try {
    const fromPath = $("fromPath").value.trim();
    const toPath = $("toPath").value.trim();
    const data = await jpost(API.move(), { fromPath, toPath });
    setOut(true, data);
  } catch (e) {
    setOut(false, e);
  }
});

$("btnDownload").addEventListener("click", async () => {
  try {
    const targetPath = $("downloadPath").value.trim();
    const res = await fetch(API.download(targetPath), { headers: (() => {
      const h = {};
      const apiKey = $("apiKey").value.trim();
      if (apiKey) h["x-api-key"] = apiKey;
      return h;
    })()});

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw err;
    }

    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    const fallbackName = targetPath.split("/").pop() || "download.bin";
    const match = cd.match(/filename="([^"]+)"/);
    const filename = match?.[1] || fallbackName;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setOut(true, { ok: true, downloaded: filename, bytes: blob.size });
  } catch (e) {
    setOut(false, e);
  }
});
