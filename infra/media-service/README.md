# Nexosophy internal media scanner / preview service

Standalone first-party media service; no custom domain is necessary. Deploy on a Render-generated hostname, with at least enough memory for ClamAV signature loading, LibreOffice and ffmpeg. Do not co-host in the 512 MB free worker or disable signatures to make deployment pass.

**Capacity gate:** on a Linux cgroup memory limit below 1 GiB, the entrypoint skips signature updates and the API returns HTTP 503 (`insufficient_scanner_memory`) immediately. Authenticated `/scan` requests also fail closed without downloading the upload. A 1 GiB budget is only the *minimum required to attempt scanning*, not a guarantee of successful operation: size the host using measured ClamAV/LibreOffice peak memory, and verify clean-file and EICAR detection before authorizing scanned assets. The 512 MiB free staging service does **not** satisfy Stage 2 acceptance.

- Container: `infra/docker/Dockerfile.media` (Docker context repository root).
- `MEDIA_STORAGE_HOST`: exact hostname from staging Neon S3 endpoint (no protocol).
- `MEDIA_SERVICE_TOKEN`: random 32+ character shared secret. Set privately in both this service and the worker.
- Worker `MALWARE_SCANNER_URL`: `https://<render-generated-host>/scan`
- Worker `MEDIA_PROCESSOR_URL`: `https://<render-generated-host>/process`
- Worker `MEDIA_SERVICE_TOKEN`: same secret.

The service accepts **only exact-hostname HTTPS presigned storage URLs**, does not follow redirects, caps payload/file sizes, scans using ClamAV with signatures and fails closed when virus data is unavailable. Processes previews with ffmpeg, Poppler and LibreOffice. Do not declare upload trust or derivative readiness without a successful response. Retain tenant-scoped asset downloads and quarantine policies in the API.

Security concerns requiring deployment acceptance: ClamAV memory budget and signature update health; rendering malicious documents in an isolated container; a live EICAR-positive rejection test; scanned checksum/detected MIME; valid thumbnail and PDF conversions; timed API/worker retries; resource limits and log redaction. Real deployment is a Stage 2 blocker until proven.
