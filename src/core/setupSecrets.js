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
                // If directory creation fails, we can't proceed with writing the file.
                return;
            }
        }

        const credentialsPath = path.join(secretsDir, "google_credentials.json");
        try {
            // Attempt to parse the JSON to ensure it's valid before writing
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
            // Write the parsed JSON back to the file, formatted for readability
            fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
            process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
            console.log("[Setup] Google Credentials written to:", credentialsPath);
        } catch (e) {
            if (e instanceof SyntaxError) {
                console.error("[Setup] Error parsing GOOGLE_CREDENTIALS_JSON:", e.message);
                // Log a snippet of the raw content for debugging, if available
                if (process.env.GOOGLE_CREDENTIALS_JSON) {
                    console.error("[Setup] Raw Content (first 50 chars):", process.env.GOOGLE_CREDENTIALS_JSON.substring(0, 50) + (process.env.GOOGLE_CREDENTIALS_JSON.length > 50 ? "..." : ""));
                }
                console.error("[Setup] Google Cloud Storage functionality may be impacted.");
            } else {
                console.error("[Setup] Error writing credentials file:", e);
            }
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
