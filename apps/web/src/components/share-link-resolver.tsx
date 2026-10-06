"use client";

import { useEffect, useState } from "react";

type ShareResolution = {
  workspaceId: string;
  resourceType: string;
  resourceId: string;
  allowDownload: boolean;
};

async function resolve(token: string, password?: string): Promise<ShareResolution | null> {
  const response = await fetch(`/api/share/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(password ? { password } : {}),
  });
  if (!response.ok) return null;
  return response.json() as Promise<ShareResolution>;
}

export function ShareLinkResolver({ token }: { token: string }) {
  const [resolution, setResolution] = useState<ShareResolution | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void resolve(token).then((result) => {
      if (!active) return;
      if (result) setResolution(result);
      else setLocked(true);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [token]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const result = await resolve(token, password);
    if (result) {
      setResolution(result);
      setLocked(false);
    } else {
      setError("This share link is unavailable or the password is incorrect.");
    }
    setLoading(false);
  }

  if (loading && !locked && !resolution) {
    return <p>Resolving secure share…</p>;
  }

  if (resolution) {
    return (
      <>
        <h1>Shared resource</h1>
        <p>Resource type: {resolution.resourceType}</p>
        <p>Resource ID: {resolution.resourceId}</p>
        <p>Downloads: {resolution.allowDownload ? "allowed" : "disabled"}</p>
      </>
    );
  }

  return (
    <>
      <h1>Unlock shared resource</h1>
      <form className="settings-form" onSubmit={submit}>
        <label className="settings-control">
          Password
          <input name="password" type="password" autoComplete="current-password" />
        </label>
        <button className="nx-button" type="submit" disabled={loading}>
          {loading ? "Checking…" : "Open share"}
        </button>
        {error && <p className="form-status form-status--error">{error}</p>}
      </form>
    </>
  );
}
