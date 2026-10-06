import { ShareLinkResolver } from "../../../components/share-link-resolver";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <section className="route-state">
      <div className="route-state__card route-state__card--wide">
        <p className="eyebrow">Secure share</p>
        <ShareLinkResolver token={token} />
      </div>
    </section>
  );
}
