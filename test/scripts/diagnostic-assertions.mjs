import assert from "node:assert/strict";

export function assertNoTargetDiagnostics(diagnostics) {
  const empty = Array.isArray(diagnostics) && diagnostics.length === 0;
  const details = Array.isArray(diagnostics) ? diagnostics.slice(0, 4).map(diagnostic => {
    const code = typeof diagnostic?.code === "string" ? diagnostic.code.slice(0, 96) : "diagnostic";
    const message = typeof diagnostic?.message === "string" ? diagnostic.message.slice(0, 256) : "missing scalar message";
    return `${code}: ${message}`;
  }).join("\n") : "The diagnostic contract did not return an array.";
  assert.equal(empty, true, details || "The target must report no diagnostics.");
}
