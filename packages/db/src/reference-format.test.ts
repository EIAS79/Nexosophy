import { describe, expect, it } from "vitest";
import { parseBibTeX, parseRIS, toRIS } from "./reference-format.js";

describe("reference formats — Phase 15", () => {
  it("imports author and DOI fields from BibTeX", () => {
    const items = parseBibTeX("@article{smith2026,\n title={Example title},\n author={Smith, Ada and Doe, Jane},\n year={2026},\n doi={10.1000/example}\n}");
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Example title");
    expect(items[0]?.authors).toHaveLength(2);
    expect(items[0]?.identifiers).toContainEqual({ type: "doi", value: "10.1000/example" });
  });
  it("imports RIS metadata and handles multi-author records", () => {
    const items = parseRIS("TY  - JOUR\nTI  - Test citation\nAU  - Smith, Ada\nAU  - Doe, Jane\nPY  - 2026\nDO  - 10.1000/demo\nER  -");
    expect(items[0]).toMatchObject({ title: "Test citation", year: 2026 });
    expect(items[0]?.authors).toHaveLength(2);
    expect(toRIS(items)).toContain("DO  - 10.1000/demo");
  });
});
