import { createHash, createHmac } from "node:crypto";

export type StorageObjectRef = {
  bucket: string;
  key: string;
  etag?: string;
  size?: number;
};

export type MultipartPart = {
  partNumber: number;
  etag: string;
};

export type HeadObjectResult = {
  size: number;
  etag: string | null;
  contentType: string | null;
  checksumSha256: string | null;
};

export interface StorageAdapter {
  readonly bucket: string;

  createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; headers?: Record<string, string> }>;

  createMultipartUpload(input: {
    key: string;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<{ uploadId: string }>;

  createMultipartPartUrl(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    expiresInSeconds: number;
  }): Promise<{ url: string; headers?: Record<string, string> }>;

  completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: MultipartPart[];
  }): Promise<{ etag: string | null }>;

  abortMultipartUpload(input: { key: string; uploadId: string }): Promise<void>;

  headObject(key: string): Promise<HeadObjectResult>;

  createDownloadUrl(input: { key: string; expiresInSeconds: number }): Promise<{ url: string }>;

  deleteObject(key: string): Promise<void>;
}

export type S3CompatibleStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string | undefined;
};

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    "%" + character.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function isoAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const compact = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: compact, dateStamp: compact.slice(0, 8) };
}

function xmlText(body: string, tag: string): string | null {
  const match = body.match(new RegExp("<" + tag + ">([\\s\\S]*?)</" + tag + ">", "i"));
  return match?.[1]?.trim() ?? null;
}

export class S3CompatibleStorageAdapter implements StorageAdapter {
  readonly bucket: string;
  private readonly endpoint: URL;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly sessionToken?: string | undefined;

  constructor(config: S3CompatibleStorageConfig) {
    this.endpoint = new URL(config.endpoint.replace(/\/$/, "") + "/");
    this.region = config.region;
    this.bucket = config.bucket;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.sessionToken = config.sessionToken;
  }

  private objectUrl(key: string): URL {
    const encodedKey = key
      .split("/")
      .map((part) => awsEncode(part))
      .join("/");
    return new URL(awsEncode(this.bucket) + "/" + encodedKey, this.endpoint);
  }

  private signingKey(dateStamp: string): Buffer {
    const kDate = hmac("AWS4" + this.secretAccessKey, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, "s3");
    return hmac(kService, "aws4_request");
  }

  private canonicalQuery(params: URLSearchParams): string {
    return Array.from(params.entries())
      .sort(([aKey, aValue], [bKey, bValue]) => {
        const keyCompare = aKey.localeCompare(bKey);
        return keyCompare === 0 ? aValue.localeCompare(bValue) : keyCompare;
      })
      .map(([key, value]) => awsEncode(key) + "=" + awsEncode(value))
      .join("&");
  }

  private async signedFetch(input: {
    method: string;
    url: URL;
    body?: string | undefined;
    headers?: Record<string, string> | undefined;
  }): Promise<Response> {
    const now = new Date();
    const { amzDate, dateStamp } = isoAmzDate(now);
    const bodyHash = sha256(input.body ?? "");
    const headers = new Headers(input.headers);
    headers.set("host", input.url.host);
    headers.set("x-amz-content-sha256", bodyHash);
    headers.set("x-amz-date", amzDate);
    if (this.sessionToken) headers.set("x-amz-security-token", this.sessionToken);

    const signedHeaderNames = Array.from(headers.keys())
      .map((name) => name.toLowerCase())
      .sort();
    const canonicalHeaders =
      signedHeaderNames.map((name) => name + ":" + (headers.get(name) ?? "").trim() + "\n").join("");
    const signedHeaders = signedHeaderNames.join(";");
    const canonicalRequest = [
      input.method.toUpperCase(),
      input.url.pathname,
      this.canonicalQuery(input.url.searchParams),
      canonicalHeaders,
      signedHeaders,
      bodyHash,
    ].join("\n");
    const scope = dateStamp + "/" + this.region + "/s3/aws4_request";
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      sha256(canonicalRequest),
    ].join("\n");
    const signature = createHmac("sha256", this.signingKey(dateStamp))
      .update(stringToSign)
      .digest("hex");
    headers.set(
      "authorization",
      "AWS4-HMAC-SHA256 Credential=" +
        this.accessKeyId +
        "/" +
        scope +
        ", SignedHeaders=" +
        signedHeaders +
        ", Signature=" +
        signature,
    );
    headers.delete("host");

    return fetch(input.url, {
      method: input.method,
      headers,
      body: input.body,
    });
  }

  private presign(input: {
    method: string;
    key: string;
    expiresInSeconds: number;
    query?: Record<string, string> | undefined;
  }): URL {
    const now = new Date();
    const { amzDate, dateStamp } = isoAmzDate(now);
    const url = this.objectUrl(input.key);
    const scope = dateStamp + "/" + this.region + "/s3/aws4_request";
    const params = new URLSearchParams(input.query ?? {});
    params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
    params.set("X-Amz-Credential", this.accessKeyId + "/" + scope);
    params.set("X-Amz-Date", amzDate);
    params.set("X-Amz-Expires", String(Math.min(Math.max(input.expiresInSeconds, 1), 3600)));
    params.set("X-Amz-SignedHeaders", "host");
    if (this.sessionToken) params.set("X-Amz-Security-Token", this.sessionToken);

    const canonicalRequest = [
      input.method.toUpperCase(),
      url.pathname,
      this.canonicalQuery(params),
      "host:" + url.host + "\n",
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      sha256(canonicalRequest),
    ].join("\n");
    const signature = createHmac("sha256", this.signingKey(dateStamp))
      .update(stringToSign)
      .digest("hex");
    params.set("X-Amz-Signature", signature);
    url.search = this.canonicalQuery(params);
    return url;
  }

  async createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; headers?: Record<string, string> }> {
    const url = this.presign({
      method: "PUT",
      key: input.key,
      expiresInSeconds: input.expiresInSeconds,
    });
    return { url: url.toString(), headers: { "content-type": input.contentType } };
  }

  async createMultipartUpload(input: {
    key: string;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<{ uploadId: string }> {
    const url = this.objectUrl(input.key);
    url.searchParams.set("uploads", "");
    const headers: Record<string, string> = { "content-type": input.contentType };
    for (const [key, value] of Object.entries(input.metadata ?? {})) {
      headers["x-amz-meta-" + key.toLowerCase()] = value;
    }
    const response = await this.signedFetch({ method: "POST", url, headers });
    const body = await response.text();
    if (!response.ok) {
      throw new Error("Object storage multipart initiation failed with status " + response.status + ".");
    }
    const uploadId = xmlText(body, "UploadId");
    if (!uploadId) throw new Error("Object storage did not return a multipart upload ID.");
    return { uploadId };
  }

  async createMultipartPartUrl(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    expiresInSeconds: number;
  }): Promise<{ url: string; headers?: Record<string, string> }> {
    const url = this.presign({
      method: "PUT",
      key: input.key,
      expiresInSeconds: input.expiresInSeconds,
      query: {
        partNumber: String(input.partNumber),
        uploadId: input.uploadId,
      },
    });
    return { url: url.toString() };
  }

  async completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: MultipartPart[];
  }): Promise<{ etag: string | null }> {
    const url = this.objectUrl(input.key);
    url.searchParams.set("uploadId", input.uploadId);
    const body =
      "<CompleteMultipartUpload>" +
      input.parts
        .slice()
        .sort((a, b) => a.partNumber - b.partNumber)
        .map(
          (part) =>
            "<Part><PartNumber>" +
            part.partNumber +
            "</PartNumber><ETag>" +
            part.etag.replace(/&/g, "&amp;").replace(/</g, "&lt;") +
            "</ETag></Part>",
        )
        .join("") +
      "</CompleteMultipartUpload>";
    const response = await this.signedFetch({
      method: "POST",
      url,
      body,
      headers: { "content-type": "application/xml" },
    });
    const responseBody = await response.text();
    if (!response.ok || /<Error>/i.test(responseBody)) {
      throw new Error("Object storage multipart completion failed with status " + response.status + ".");
    }
    return { etag: xmlText(responseBody, "ETag") };
  }

  async abortMultipartUpload(input: { key: string; uploadId: string }): Promise<void> {
    const url = this.objectUrl(input.key);
    url.searchParams.set("uploadId", input.uploadId);
    const response = await this.signedFetch({ method: "DELETE", url });
    if (!response.ok && response.status !== 404) {
      throw new Error("Object storage multipart abort failed with status " + response.status + ".");
    }
  }

  async headObject(key: string): Promise<HeadObjectResult> {
    const url = this.objectUrl(key);
    const response = await this.signedFetch({ method: "HEAD", url });
    if (!response.ok) {
      throw new Error("Object storage HEAD failed with status " + response.status + ".");
    }
    const rawSize = Number(response.headers.get("content-length") ?? "0");
    return {
      size: Number.isFinite(rawSize) ? rawSize : 0,
      etag: response.headers.get("etag"),
      contentType: response.headers.get("content-type"),
      checksumSha256: response.headers.get("x-amz-checksum-sha256"),
    };
  }

  async createDownloadUrl(input: {
    key: string;
    expiresInSeconds: number;
  }): Promise<{ url: string }> {
    return {
      url: this.presign({
        method: "GET",
        key: input.key,
        expiresInSeconds: input.expiresInSeconds,
      }).toString(),
    };
  }

  async deleteObject(key: string): Promise<void> {
    const response = await this.signedFetch({ method: "DELETE", url: this.objectUrl(key) });
    if (!response.ok && response.status !== 404) {
      throw new Error("Object storage deletion failed with status " + response.status + ".");
    }
  }
}
