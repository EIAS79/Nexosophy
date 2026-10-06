import { acceptOwnershipTransferAction } from "../../../lib/workspace-actions";

export default async function OwnershipTransferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const accept = acceptOwnershipTransferAction.bind(null, token);

  return (
    <section className="route-state">
      <div className="route-state__card">
        <p className="eyebrow">Ownership transfer</p>
        <h1>Accept ownership</h1>
        <p>The transfer is transactional and cannot produce two workspace owners.</p>
        <form action={accept}>
          <button className="nx-button" type="submit">Accept ownership</button>
        </form>
      </div>
    </section>
  );
}
