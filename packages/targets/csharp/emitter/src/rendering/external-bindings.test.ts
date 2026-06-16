import { describe, it } from "mocha";
import { expect } from "chai";
import { resolve } from "node:path";
import type { LoweringTypeRefPlan } from "@tsonic/frontend";
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

  it("uses override metadata only through explicit external binding facts", () => {
    const root = resolve(
      "src/rendering/test-fixtures/external-bindings/explicit-source-name"
    );
    const bindingFile = resolve(root, "bindings.json");
    const index = createExternalBindingMetadataIndex([root]);
    const member = {
      declarationKind: "method",
      name: "Render",
      parameters: [{}],
      override: true,
      accessibilityExplicit: false,
    };
    const externalHeritage = {
      kind: "named",
      name: "ExternalSourceNamedBase",
      typeArguments: [],
      externalBinding: {
        bindingFile,
        sourceName: "ExternalSourceNamedBase",
      },
    } satisfies LoweringTypeRefPlan;
    const sourceQualifiedHeritage = {
      kind: "named",
      name: "SourceNamedBase",
      typeArguments: [],
      sourceQualifiedName: {
        namespace: "Provider.Runtime",
        name: "SourceNamedBase",
      },
    } satisfies LoweringTypeRefPlan;

    expect(index.resolveOverrideAccessibility([externalHeritage], member)).to.equal(
      "protected"
    );
    expect(
      index.resolveOverrideAccessibility([sourceQualifiedHeritage], member)
    ).to.equal(undefined);
  });
});
