#!/usr/bin/env python3
"""Bounded, disposable Stage 2 media acceptance. Linux Docker required.

Runs the *actual* media Docker image behind localhost-only HTTPS fixture
storage. This does not certify Render, real Neon/S3, the browser, or a real
object-store signature implementation. Real ClamAV signatures are mandatory.
"""
import base64
import hashlib
import http.client
import json
import os
import pathlib
import secrets
import shutil
import struct
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import wave
import math
import zipfile
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
IMAGE = os.environ.get("MEDIA_TEST_IMAGE", "nexosophy-media-stage2-local")
CLAM_DB = pathlib.Path(os.environ.get("MEDIA_TEST_CLAM_DB", "/tmp/nexosophy-stage2-clamav-db"))
PORT = 4300


def cmd(*args, timeout=100, check=True):
    return subprocess.run(args, check=check, capture_output=True, text=True, timeout=timeout)


def chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)


def fixtures(path):
    inputs = path / "inputs"
    inputs.mkdir()
    (path / "outputs").mkdir()
    pixel_rows = b"".join(bytes([0]) + bytes([255, 20, 40] * 16) for _ in range(16))
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 16, 16, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(pixel_rows)) + chunk(b"IEND", b"")
    (inputs / "sample.png").write_bytes(png)
    stream = b"BT /F1 18 Tf 36 200 Td (Stage 2 PDF proof) Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    pdf = b"%PDF-1.4\n"
    offsets = [0]
    for number, obj in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf += str(number).encode() + b" 0 obj\n" + obj + b"\nendobj\n"
    xref = len(pdf)
    pdf += b"xref\n0 6\n0000000000 65535 f \n"
    for offset in offsets[1:]:
        pdf += f"{offset:010d} 00000 n \n".encode()
    pdf += b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + str(xref).encode() + b"\n%%EOF\n"
    (inputs / "sample.pdf").write_bytes(pdf)
    with zipfile.ZipFile(inputs / "sample.docx", "w") as z:
        z.writestr("[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>""")
        z.writestr("_rels/.rels", """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>""")
        z.writestr("word/document.xml", """<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>Stage 2 Office proof</w:t></w:r></w:p><w:sectPr/></w:body></w:document>""")
    with wave.open(str(inputs / "sample.wav"), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(b"".join(struct.pack("<h", int(9000 * math.sin(2 * math.pi * 440 * i / 8000)))
                                    for i in range(16000)))
    (inputs / "clean.txt").write_text("Stage 2 harmless file.\n")
    (inputs / "eicar.txt").write_bytes(b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*")


def request(path, payload=None, token=None, timeout=120):
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = "Bearer " + token
    body = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}{path}",
                                 data=body, headers=headers,
                                 method="POST" if payload is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())


def storage_url(section, name):
    return f"https://localhost/{section}/{name}?X-Amz-Signature=stage2-local"


def wait_readiness():
    for _ in range(30):
        try:
            status, result = request("/ready", timeout=12)
            if status == 200:
                return
            print("Scanner is not yet ready:", status, result, flush=True)
        except (OSError, TimeoutError) as error:
            print("Waiting for scanner:", type(error).__name__, flush=True)
        time.sleep(4)
    raise RuntimeError("Real ClamAV signature-based /ready never returned 200; no scanning acceptance claim")


def run():
    if os.environ.get("STAGE2_LOCAL_ACCEPTANCE") != "1":
        raise RuntimeError("Set STAGE2_LOCAL_ACCEPTANCE=1 to opt into disposable local Docker tests")
    image = cmd("docker", "image", "inspect", IMAGE, "--format", "{{.Id}}")
    print("Media image:", image.stdout.strip()[:20])
    if not CLAM_DB.exists() or not list(CLAM_DB.glob("*.c*d")):
        raise RuntimeError("Real ClamAV database unavailable; cannot claim scanner acceptance")
    test_id = secrets.token_hex(5)
    names = ["nx-stage2-storage-" + test_id, "nx-stage2-media-" + test_id]
    with tempfile.TemporaryDirectory(prefix="nx-stage2-") as temp:
        folder = pathlib.Path(temp)
        fixtures(folder)
        cmd("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-days", "1", "-subj", "/CN=localhost", "-addext",
            "subjectAltName=DNS:localhost,IP:127.0.0.1",
            "-keyout", str(folder / "key.pem"), "-out", str(folder / "cert.pem"))
        cmd("docker", "run", "--rm", "-v", f"{folder}:/fixtures",
            IMAGE, "ffmpeg", "-v", "error", "-nostdin", "-y",
            "-f", "lavfi", "-i", "color=c=blue:s=160x90:r=2:d=3",
            "-c:v", "mpeg4", "/fixtures/inputs/sample.mp4")
        token = secrets.token_urlsafe(48)
        try:
            cmd("docker", "run", "--rm", "-d", "--name", names[0], "--network", "host",
                "-v", f"{folder}:/fixtures", "-v", f"{ROOT / 'scripts'}:/suite:ro",
                IMAGE, "node", "/suite/stage2-fixture-storage.mjs")
            cmd("docker", "run", "--rm", "-d", "--name", names[1], "--network", "host",
                "--memory", "3g", "-e", "MEDIA_STORAGE_HOST=localhost",
                "-e", "MEDIA_SERVICE_TOKEN=" + token,
                "-e", "NODE_EXTRA_CA_CERTS=/fixtures/cert.pem",
                "-v", f"{folder}:/fixtures:ro",
                "-v", f"{CLAM_DB}:/var/lib/clamav:ro",
                IMAGE, "node", "/srv/media/server.mjs")
            for attempt in range(40):
                try:
                    status, data = request("/health", timeout=4)
                    if status == 200 and data["status"] == "ok":
                        break
                except OSError:
                    pass
                time.sleep(0.5)
            else:
                raise RuntimeError("Local media HTTP server never started")
            status, data = request("/scan", {})
            assert status == 401
            wait_readiness()
            def scan(name):
                input_file = folder / "inputs" / name
                status, out = request("/scan", {
                    "sourceUrl": storage_url("inputs", name),
                    "checksumSha256": hashlib.sha256(input_file.read_bytes()).hexdigest(),
                }, token=token)
                assert status == 200, (name, status, out)
                return out

            safe = scan("clean.txt")
            assert safe["clean"] is True and safe["resultCode"] == "clean", safe
            print("PASS genuine ClamAV clean-file detection")
            malware = scan("eicar.txt")
            assert malware["clean"] is False and malware["resultCode"] == "malware_detected", malware
            print("PASS genuine ClamAV EICAR detection")
            jobs = [
                ("sample.png", "image_preview", b"\x89PNG", "image/png"),
                ("sample.pdf", "pdf_preview", b"\x89PNG", "image/png"),
                ("sample.pdf", "pdf_text", b"Stage 2 PDF proof", "text/plain"),
                ("sample.docx", "office_preview", b"%PDF", "application/pdf"),
                ("sample.wav", "waveform", b"\x89PNG", "image/png"),
                ("sample.wav", "media_metadata", b"{", "application/json"),
                ("sample.mp4", "video_poster", b"\x89PNG", "image/png"),
            ]
            for name, kind, magic, mime in jobs:
                verdict = scan(name)
                assert verdict["clean"] is True, verdict
                output_name = kind + ".dat"
                code, response = request("/process", {
                    "jobType": kind,
                    "source": {
                        "url": storage_url("inputs", name),
                        "mimeType": verdict["detectedMime"],
                    },
                    "target": {
                        "url": storage_url("outputs", output_name),
                        "headers": {"content-type": mime},
                    },
                }, token=token)
                assert code == 200, (kind, code, response)
                content = (folder / "outputs" / output_name).read_bytes()
                assert magic in content and response["mimeType"] == mime, (kind, response)
                assert hashlib.sha256(content).hexdigest() == response["checksumSha256"]
                print("PASS real media processor:", kind, len(content), "bytes")
            print("PASS signed-URL-shaped HTTPS upload -> genuine scan -> preview -> verified download")
        finally:
            for name in reversed(names):
                cmd("docker", "rm", "-f", name, check=False)


if __name__ == "__main__":
    run()
