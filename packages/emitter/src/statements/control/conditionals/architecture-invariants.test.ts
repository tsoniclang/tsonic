import { expect } from "chai";
import { describe, it } from "mocha";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const conditionalsRoot = join(
  process.cwd(),
  "src",
  "statements",
  "control",
  "conditionals"
);

describe("conditional emission architecture invariants", () => {
  it("dispatches if-statement guard emission from authoritative branch plans", () => {
    const ifEmitter = readFileSync(
      join(conditionalsRoot, "if-emitter.ts"),
      "utf8"
    );
    const fallbackRegion = ifEmitter.slice(ifEmitter.indexOf("const [condAst"));

    expect(ifEmitter).to.include("stmt.thenPlan.guardShape.kind");
    expect(ifEmitter).to.not.include("stmt.thenNarrowings");
    expect(ifEmitter).to.not.include("stmt.elseNarrowings");
    expect(fallbackRegion).to.not.include(
      "tryEmitPropertyTruthinessGuard(stmt, context);\n    if"
    );
    expect(fallbackRegion).to.not.include(
      "tryEmitDiscriminantEqualityGuard(stmt, context);\n    if"
    );
    expect(fallbackRegion).to.not.include(
      "tryEmitArrayIsArrayGuard(stmt, context);\n    if"
    );
    expect(fallbackRegion).to.not.include(
      "tryEmitTypeofGuard(stmt, context);\n    if"
    );
  });
});
