# Phase 4 — File storage and external providers

## Implemented controls

- Multipart requests are bounded by file size, part count, field count and field size.
- The final validator reads file signatures for PNG, JPEG, WEBP and PDF; the client-provided MIME type is not trusted by itself.
- SHA-256 checksums are calculated incrementally with a read stream instead of loading the complete file.
- Temporary files are removed in `finally` paths and external objects are compensated when database registration fails.
- Local object paths are resolved inside the configured upload root and reject traversal.
- Local file operations use asynchronous APIs; request handlers no longer use synchronous rename, delete or checksum reads.
- GCS uploads enable CRC32C validation and use resumable upload for larger accepted files.
- Cloudinary and deletion calls have bounded timeouts and return sanitized provider failures.
- Direct Cloudinary completion requires and verifies `public_id`, version, signature, asset ID, format, resource type and byte count.
- Upload authorization signatures are compared with `timingSafeEqual`.
- The 1,028-line file service was split by storage, direct upload, administration, access, validation and response mapping responsibilities.

## Resource boundary

Server-side Cloudinary upload still holds one accepted file in memory because the native `FormData` implementation requires a Blob. The buffer is bounded by `MAX_UPLOAD_MB`; image clients are required to use direct Cloudinary upload, so this path mainly protects compatibility for non-image files. A future provider SDK/streaming adapter can remove this remaining bounded buffer if large-file requirements are introduced.
