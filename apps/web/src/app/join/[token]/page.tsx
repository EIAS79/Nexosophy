import { acceptWorkspaceInvitationAction } from "../../../lib/workspace-actions";

export default async function JoinWorkspacePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const accept = acceptWorkspaceInvitationAction.bind(null, token);

  return (
    <section className="route-state">
      <div className="route-state__card">
        <p className="eyebrow">Workspace invitation</p>
        <h1>Join workspace</h1>
        <p>This invitation is single-use, bound to the intended account email, and may expire or be revoked.</p>
        <form action={accept}>
          <button className="nx-button" type="submit">Accept invitation</button>
        </form>
      </div>
    </section>
  );
}
