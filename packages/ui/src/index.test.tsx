import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button, DataTable, Field, Tabs, Tree } from "./index.js";

describe("UI semantic foundation", () => {
  it("renders an actual button with a predictable type", () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(html).toContain("<button");
    expect(html).toContain('type="button"');
    expect(html).toContain("Save");
  });

  it("associates field label, hint and error semantics", () => {
    const html = renderToStaticMarkup(
      <Field label="Workspace name" hint="Visible to members" error="Required" />,
    );

    expect(html).toContain("<label");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
  });

  it("renders keyboard-oriented tab semantics", () => {
    const html = renderToStaticMarkup(
      <Tabs
        ariaLabel="Document views"
        items={[
          { id: "document", label: "Document", content: "Document content" },
          { id: "activity", label: "Activity", content: "Activity content" },
        ]}
      />,
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-selected="true"');
  });

  it("renders a roving-focus tree foundation", () => {
    const html = renderToStaticMarkup(
      <Tree
        label="Workspace"
        defaultExpanded={["root"]}
        nodes={[
          {
            id: "root",
            label: "Root",
            children: [{ id: "notes", label: "Notes", href: "/notes" }],
          },
        ]}
      />,
    );

    expect(html).toContain('role="tree"');
    expect(html).toContain('role="treeitem"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-expanded="true"');
  });

  it("renders a captioned semantic table", () => {
    const html = renderToStaticMarkup(
      <DataTable
        caption="Members"
        rows={[{ id: "1", name: "Ada" }]}
        getRowKey={(row) => row.id}
        columns={[{ id: "name", header: "Name", cell: (row) => row.name }]}
      />,
    );

    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toContain('scope="col"');
  });
});
