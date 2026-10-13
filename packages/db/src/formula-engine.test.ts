import { describe, expect, it } from "vitest";
import { assertNoFormulaCycles, evaluateFormula, formulaDependencies } from "./formula-engine.js";

describe("structured formula engine — Phase 13", () => {
  it("evaluates arithmetic, references and aggregation deterministically", () => {
    expect(evaluateFormula("={a}*2+SUM({b},3)", { a: 4, b: 5 })).toBe(16);
    expect(evaluateFormula("AVG(2,4,6)", {})).toBe(4);
    expect(evaluateFormula("=1/0", {})).toBeNull();
  });
  it("rejects unsupported expressions and invalid numeric references", () => {
    expect(() => evaluateFormula("EVAL(1)", {})).toThrow("FORMULA_FUNCTION_UNSUPPORTED");
    expect(() => evaluateFormula("2 * {name}", { name: "not-a-number" })).toThrow("FORMULA_VALUE_NOT_NUMERIC");
  });
  it("extracts unique dependencies and detects formula cycles", () => {
    expect(formulaDependencies("SUM({a},{b},{a})")).toEqual(["a", "b"]);
    expect(() => assertNoFormulaCycles([
      { key: "a", formula: "={b}+1" },
      { key: "b", formula: "={a}+1" },
    ])).toThrow("FORMULA_CYCLE");
    expect(() => assertNoFormulaCycles([
      { key: "a", formula: "1" },
      { key: "b", formula: "={a}+1" },
    ])).not.toThrow();
  });
});
