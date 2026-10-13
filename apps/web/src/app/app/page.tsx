import { cookies } from "next/headers";

import { nexosophyApi } from "../../lib/api-server";

type WorkspaceSummary = {
  id: string;
  name: string;
  type: string;
  role: string;
};

type RecentItem = {
  id: string;
  name: string;
  kind: string;
  updatedAt: string | Date;
};

export default async function AppHomePage() {
  const result = await nexosophyApi<{ workspaces: WorkspaceSummary[] }>("/v1/workspaces");
  const workspaces = result.workspaces;
  const jar = await cookies();
  const selectedId = jar.get("nx_workspace")?.value;
  const workspace = workspaces.find((item) => item.id === selectedId) ?? workspaces[0];

  const [recent, favorites] = workspace
    ? await Promise.all([
        nexosophyApi<{ items: RecentItem[] }>(
          `/v1/workspaces/${workspace.id}/recent`,
        ),
        nexosophyApi<{ items: RecentItem[] }>(
          `/v1/workspaces/${workspace.id}/favorites`,
        ),
      ])
    : [{ items: [] as RecentItem[] }, { items: [] as RecentItem[] }];

  const nodeLink = (item: RecentItem) =>
    `/app/workspaces/${workspace?.id}/node/${item.id}`;

  return (
    <>
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">Workspace overview</p>
          <h1>Your knowledge, in context.</h1>
          <p>
            {workspace
              ? `Continue your work in ${workspace.name}, or choose another workspace.`
              : "Create your first workspace to begin organizing your knowledge."}
          </p>
        </div>
        <a className="nx-button" href={workspace ? `/app/workspaces/${workspace.id}/files` : "/app/workspaces"}>
          {workspace ? "Open files" : "Create workspace"}
        </a>
      </header>

      <section className="dashboard-grid" aria-label="Dashboard">
        <article className="dashboard-card dashboard-card--wide">
          <h2>Continue working</h2>
          {recent.items.length > 0 ? (
            <ul>
              {recent.items.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <a href={nodeLink(item)}>{item.name}</a>
                  <small> · {item.kind}</small>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <div>
                <strong>No recent documents yet.</strong>
                <p>Documents you open will appear here automatically.</p>
              </div>
            </div>
          )}
        </article>

        <article className="dashboard-card">
          <h2>Workspaces</h2>
          {workspaces.length > 0 ? (
            <ul>
              {workspaces.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <a href={`/app/workspaces/${item.id}`}>{item.name}</a>
                  <small> · {item.role}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>You have no accessible workspaces yet.</p>
          )}
          <a href="/app/workspaces">Manage workspaces</a>
        </article>

        <article className="dashboard-card">
          <h2>Quick access</h2>
          <p>Create and organize files, notes, and research in your selected workspace.</p>
          {workspace ? (
            <a href={`/app/workspaces/${workspace.id}/files`}>Open content explorer</a>
          ) : (
            <a href="/app/workspaces">Set up a workspace</a>
          )}
        </article>

        <article className="dashboard-card">
          <h2>Favorites</h2>
          {favorites.items.length > 0 ? (
            <ul>
              {favorites.items.slice(0, 5).map((item) => (
                <li key={item.id}><a href={nodeLink(item)}>{item.name}</a></li>
              ))}
            </ul>
          ) : (
            <p>Pin important files to find them here.</p>
          )}
        </article>

        <article className="dashboard-card">
          <h2>Find and recover</h2>
          <p>Search your workspace or recover a previously deleted file.</p>
          {workspace ? (
            <p>
              <a href={`/app/workspaces/${workspace.id}/search`}>Search content</a>{" "}
              <a href={`/app/workspaces/${workspace.id}/trash`}>Open trash</a>
            </p>
          ) : (
            <a href="/app/workspaces">View workspaces</a>
          )}
        </article>
      </section>
    </>
  );
}
