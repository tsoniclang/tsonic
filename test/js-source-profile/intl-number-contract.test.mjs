import assert from "node:assert/strict";
import test from "node:test";
import { checkCsharpSource, assertCsharpCheckingSucceeded } from "../../../tsonic-csharp/test/helpers/direct-csharp-session.mjs";

test("shared Intl declarations admit exact bigint inputs and normalized optional results", () => {
  const checked = checkCsharpSource({ surface: "js", sourceText: `
    import type { int64, uint64 } from "@tsonic/core/types.js";
    export function inspect(signed: int64, unsigned: uint64): string {
      const formatter = new Intl.NumberFormat("en", { maximumSignificantDigits: 3 });
      const resolved = formatter.resolvedOptions();
      const minimum: number | undefined = resolved.minimumFractionDigits;
      const maximum: number | undefined = resolved.maximumFractionDigits;
      const grouping: false | "auto" | "always" | "min2" = resolved.useGrouping;
      const compact = new Intl.NumberFormat("en", { notation: "compact", compactDisplay: "long", useGrouping: "min2" });
      formatter.formatToParts(unsigned);
      signed.toLocaleString("en");
      return formatter.format(unsigned);
    }
  ` });
  assertCsharpCheckingSucceeded(checked);
});

test("the shared Intl contract rejects false mandatory-digit and boolean-only result assumptions", () => {
  for (const expression of [
    "const value: number = result.minimumFractionDigits;",
    "const value: number = result.maximumFractionDigits;",
    "const value: boolean = result.useGrouping;",
    'new Intl.NumberFormat("en", { useGrouping: "invalid" });',
  ]) {
    const checked = checkCsharpSource({ surface: "js", sourceText: `
      const result = new Intl.NumberFormat("en").resolvedOptions();
      ${expression}
    ` });
    assert.notEqual(checked.sourceDiagnosticsText, "");
    assert.deepEqual(checked.extensionDiagnostics, []);
  }
});
