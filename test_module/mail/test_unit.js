const BACKEND_BASE_URL = "http://localhost:3003"; 

function v(id) {
  return document.getElementById(id).value.trim();
}

async function postJSON(endpoint, body, apiKey) {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${BACKEND_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

document.getElementById("sendBtn").addEventListener("click", async () => {
  const out = document.getElementById("out");
  out.textContent = "Enviando...";

  const endpoint = v("endpoint") || "/api/email/send";
  const apiKey = v("apiKey");

  const to = v("to");
  const subject = v("subject");
  const text = v("text");

  try {
    const payload = { to, message: { subject, text } };
    const result = await postJSON(endpoint, payload, apiKey);
    out.textContent = JSON.stringify(result, null, 2);
  } catch (e) {
    out.textContent = `Error: ${e.message}`;
  }
});
