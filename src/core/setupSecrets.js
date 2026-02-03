"use strict";

const path = require("path");
const fs = require("fs");

/**
 * Checks for GOOGLE_CREDENTIALS_JSON environment variable.
 * If present, writes it to secrets/google_credentials.json and sets GOOGLE_APPLICATION_CREDENTIALS.
 * This is used for deployments like Coolify where we pass secrets as env vars.
 */
function setupSecrets() {
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
        const secretsDir = path.resolve(process.cwd(), "secrets");

        if (!fs.existsSync(secretsDir)) {
            try {
                fs.mkdirSync(secretsDir, { recursive: true });
            } catch (e) {
                console.error("[Setup] Error creating secrets directory:", e);
            }
        }

        const credentialsPath = path.join(secretsDir, "google_credentials.json");
        try {
            fs.writeFileSync(credentialsPath, process.env.GOOGLE_CREDENTIALS_JSON);
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
