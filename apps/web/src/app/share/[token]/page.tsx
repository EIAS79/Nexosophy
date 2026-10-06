const API_URL = process.env.NEXOSOPHY_API_URL ?? "http://127.0.0.1:4000";

type ShareResolution = {
  workspaceId: string;
  resourceType: string;
  resourceId: string;
  allowDownload: boolean;
};

async function resolveShare(token: string, password?: string): Promise<ShareResolution | null> {
  const response = await fetch(new URL(`/v1/share/${encodeURIComponent(token)}/resolve`, API_URL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(password ? { password } : {}),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<ShareResolution>;
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ password?: string }>;
}) {
  const { token } = await params;
  const { password } = await searchParams;
  const resolved = await resolveShare(token, password);

  return (
    <section className="route-state">
      <div className="route-state__card route-state__card--wide">
        <p className="eyebrow">Secure share</p>
        <h1>{resolved ? "Shared resource" : "Unlock shared resource"}</h1>
        {resolved ? (
          <>
            <p>Resource type: {resolved.resourceType}</p>
            <p>Resource ID: {resolved.resourceId}</p>
            <p>Downloads: {resolved.allowDownload ? "allowed" : "disabled"}</p>
          </>
        ) : (
          <form method="get" className="settings-form">
            <label className="settings-control">
              Password
              <input name="password" type="password" autoComplete="current-password" />
            </label>
            <button className="nx-button" type="submit">Open share</button>
          </form>
        )}
      </div>
    </section>
  );
}
