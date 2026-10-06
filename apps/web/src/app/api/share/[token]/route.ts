const API_URL = process.env.NEXOSOPHY_API_URL ?? "http://127.0.0.1:4000";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const payload = await request.json().catch(() => ({}));

  const upstream = await fetch(
    new URL(`/v1/share/${encodeURIComponent(token)}/resolve`, API_URL),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}
