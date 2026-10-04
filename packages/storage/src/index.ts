export type StorageObjectRef = {
  bucket: string;
  key: string;
  etag?: string;
  size?: number;
};

export interface StorageAdapter {
  createUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; headers?: Record<string, string> }>;

  createDownloadUrl(input: { key: string; expiresInSeconds: number }): Promise<{ url: string }>;

  deleteObject(key: string): Promise<void>;
}
