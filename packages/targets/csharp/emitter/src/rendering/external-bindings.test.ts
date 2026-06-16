import { describe, it } from "mocha";
import { expect } from "chai";
import { resolve } from "node:path";
import { createExternalBindingMetadataIndex } from "./external-bindings.js";

describe("C# external binding metadata", () => {
  it("uses explicit source names instead of deriving them from target names", () => {
    const root = resolve(
      "src/rendering/test-fixtures/external-bindings/explicit-source-name"
    );
    const bindingFile = resolve(root, "bindings.json");
    const index = createExternalBindingMetadataIndex([root]);

    expect(
      index.resolveTargetName({ bindingFile, sourceName: "PublicWidget_1" })
    ).to.equal("Provider.Runtime.InternalThing`1");
    expect(
      index.resolveTargetName({
        bindingFile,
        sourceName: "PublicWidget_1$instance",
      })
    ).to.equal("Provider.Runtime.InternalThing`1");
    expect(
      index.resolveTargetName({ bindingFile, sourceName: "InternalThing_1" })
    ).to.equal(undefined);
  });
});
