import { nexosophyApi } from "../../../../../../../lib/api-server";

type ReferenceAuthor = {
  literal?: string | null;
  family?: string | null;
  given?: string | null;
};

type ReferenceIdentifier = {
  type: string;
  value: string;
};

type ReferenceAttachment = {
  asset_id: string;
  original_filename: string;
};

type ReferenceAnnotation = {
  id: string;
  quote?: string | null;
  comment: string;
  page_locator?: string | null;
};

type ReferenceDetail = {
  type: string;
  title: string;
  authors: ReferenceAuthor[];
  year?: number | null;
  containerTitle?: string | null;
  identifiers: ReferenceIdentifier[];
  url?: string | null;
  abstract?: string | null;
  attachments: ReferenceAttachment[];
  annotations: ReferenceAnnotation[];
};

export default async function Page({
  params,
}: {
  params: Promise<{ workspaceId: string; referenceId: string }>;
}) {
  const { workspaceId, referenceId } = await params;
  const reference = await nexosophyApi<ReferenceDetail>(
    `/v1/workspaces/${workspaceId}/references/${referenceId}`,
  );

  return (
    <section className="workspace-page">
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">{reference.type}</p>
          <h1>{reference.title}</h1>
          <p>
            {reference.authors
              .map(
                (author) =>
                  author.literal ?? [author.family, author.given].filter(Boolean).join(", "),
              )
              .join("; ")}{" "}
            {reference.year ? `· ${reference.year}` : ""}
          </p>
        </div>
      </header>
      <div className="dashboard-grid">
        <section className="dashboard-card">
          <h2>Metadata</h2>
          <p>{reference.containerTitle ?? ""}</p>
          <p>
            {reference.identifiers
              .map((identifier) => `${identifier.type.toUpperCase()}: ${identifier.value}`)
              .join(" · ")}
          </p>
          {reference.url ? <a href={reference.url}>Source URL</a> : null}
          <p>{reference.abstract ?? ""}</p>
        </section>
        <section className="dashboard-card">
          <h2>Attachments</h2>
          {reference.attachments.map((attachment) => (
            <p key={attachment.asset_id}>{attachment.original_filename}</p>
          ))}
        </section>
        <section className="dashboard-card">
          <h2>Annotations</h2>
          {reference.annotations.map((annotation) => (
            <article key={annotation.id}>
              <blockquote>{annotation.quote ?? ""}</blockquote>
              <p>{annotation.comment}</p>
              <small>{annotation.page_locator ?? ""}</small>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}
