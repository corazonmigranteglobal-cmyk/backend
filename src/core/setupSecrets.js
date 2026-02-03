"use strict";

const path = require("path");
const fs = require("fs");

/**
 * Checks for GOOGLE_CREDENTIALS_JSON environment variable.
 * If present, writes it to secrets/google_credentials.json and sets GOOGLE_APPLICATION_CREDENTIALS.
 * This is used for deployments like Coolify where we pass secrets as env vars.
 */
function setupSecrets() {
    let credentials = null;

    // 1. Try parsing GOOGLE_CREDENTIALS_JSON
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
        try {
            credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
            console.log("[Setup] Parsed credentials from GOOGLE_CREDENTIALS_JSON");
        } catch (e) {
            console.error("[Setup] Error parsing GOOGLE_CREDENTIALS_JSON:", e.message);
            if (process.env.GOOGLE_CREDENTIALS_JSON) {
                console.error("[Setup] Raw Content (first 50 chars):", process.env.GOOGLE_CREDENTIALS_JSON.substring(0, 50) + "...");
            }
        }
    }
    // 2. Fallback: Try individual GCP_* variables if present
    else if (process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY) {
        try {
            credentials = {
                type: process.env.GCP_TYPE || "service_account",
                project_id: process.env.GCP_PROJECT_ID,
                private_key_id: process.env.GCP_PRIVATE_KEY_ID,
                private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
                client_email: process.env.GCP_CLIENT_EMAIL,
                client_id: process.env.GCP_CLIENT_ID,
                auth_uri: process.env.GCP_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
                token_uri: process.env.GCP_TOKEN_URI || "https://oauth2.googleapis.com/token",
                auth_provider_x509_cert_url: process.env.GCP_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
                client_x509_cert_url: process.env.GCP_CLIENT_X509_CERT_URL,
                universe_domain: process.env.GCP_UNIVERSE_DOMAIN || "googleapis.com"
            };
            console.log("[Setup] Constructed credentials from individual GCP_* env vars");
        } catch (e) {
            console.error("[Setup] Error constructing credentials from individual vars:", e);
        }
    }

    // Write credentials to file if we found them
    if (credentials) {
        const secretsDir = path.resolve(process.cwd(), "secrets");
        if (!fs.existsSync(secretsDir)) {
            try {
                fs.mkdirSync(secretsDir, { recursive: true });
            } catch (e) {
                console.error("[Setup] Error creating secrets directory:", e);
                return;
            }
        }

        const credentialsPath = path.join(secretsDir, "google_credentials.json");
        try {
            fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
            process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
            console.log("[Setup] Google Credentials written to:", credentialsPath);
        } catch (e) {
            console.error("[Setup] Error writing credentials file:", e);
        }
    }

    // Resolve absolute path if it's set (whether by us above or by user manually)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
            process.env.GOOGLE_APPLICATION_CREDENTIALS
        );
    }
}

module.exports = { setupSecrets };
