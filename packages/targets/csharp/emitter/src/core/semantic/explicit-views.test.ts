import { strict as assert } from "node:assert";
import {
  buildViewPropertyName,
  generateGenericInterfaceCast,
  generateInterfaceCast,
  isExplicitViewProperty,
} from "./explicit-views.js";

describe("explicit interface views", () => {
  it("detects synthetic view properties", () => {
    assert.equal(isExplicitViewProperty("As_ICollection"), true);
    assert.equal(isExplicitViewProperty("Length"), false);
  });

  it("builds synthetic view names", () => {
    assert.equal(buildViewPropertyName("IEnumerable_1"), "As_IEnumerable_1");
  });

  it("generates target interface casts", () => {
    assert.equal(
      generateInterfaceCast("list", "System.Collections.ICollection"),
      "((ICollection)list)"
    );
    assert.equal(
      generateGenericInterfaceCast("list", "System.Collections.Generic.IList`1", [
        "string",
      ]),
      "((IList<string>)list)"
    );
  });
});
