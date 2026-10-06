"use client";

export function BearerLinkResult({
  state,
}: {
  state: { status: "idle" | "success" | "error"; path?: string; message?: string };
}) {
  if (state.status === "idle") return null;

  if (state.status === "error") {
    return <p className="form-status form-status--error">{state.message}</p>;
  }

  const value =
    state.path && typeof window !== "undefined"
      ? new URL(state.path, window.location.origin).toString()
      : state.path ?? "";

  return (
    <div className="workspace-link-result" role="status">
      <p className="form-status form-status--success">{state.message}</p>
      <label className="settings-control">
        One-time link
        <input value={value} readOnly onFocus={(event) => event.currentTarget.select()} />
      </label>
    </div>
  );
}
