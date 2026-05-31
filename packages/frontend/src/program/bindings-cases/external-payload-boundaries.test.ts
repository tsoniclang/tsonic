import { expect } from "chai";
import { describe, it } from "mocha";
import {
  extractRawExternalOwnerIdentity,
  extractRawExternalBindingsPayload,
  getExternalBindingPayload,
} from "../bindings.js";

describe("external binding payload boundaries", () => {
  it("preserves tsbindgen bindings manifests as the target payload", () => {
    const manifest = { schema: "tsonic.bindings", provider: { namespace: "System" }, targetSurface: { types: [
        {
          targetName: "System.String",
          ownerIdentity: "System.Private.CoreLib",
          kind: "Class",
          methods: [],
          properties: [],
          fields: [],
        },
      ], exports: {
        format: {
          kind: "method",
          targetName: "Format",
          ownerQualifiedName: "System.String",
          ownerIdentity: "System.Private.CoreLib",
        },
      } } } as const;

    const payload = getExternalBindingPayload(manifest);
    expect(payload).to.deep.equal({
      namespace: "System",
      types: manifest.targetSurface.types,
      exports: manifest.targetSurface.exports,
      ownerIdentities: undefined,
      targetRuntimeVersion: undefined,
    });
    expect(payload.exports?.format?.targetName).to.equal("Format");
  });

  it("extracts raw target payloads from parsed bindings content", () => {
    const parsed = { schema: "tsonic.bindings", provider: { namespace: "Acme.Core" }, targetSurface: { types: [
        {
          targetName: "Acme.Core.Widget",
          ownerIdentity: "Acme.Core",
        },
      ] } };

    const payload = extractRawExternalBindingsPayload(parsed);
    expect(payload).to.deep.equal({
      namespace: "Acme.Core",
      types: [
        {
          targetName: "Acme.Core.Widget",
          ownerIdentity: "Acme.Core",
        },
      ],
      exports: undefined,
      ownerIdentities: undefined,
      targetRuntimeVersion: undefined,
    });
  });

  it("extracts the first owner identity from whichever target payload shape is present", () => {
    expect(
      extractRawExternalOwnerIdentity({ schema: "tsonic.bindings", provider: { namespace: "System" }, targetSurface: { types: [
          {
            targetName: "System.String",
            ownerIdentity: "System.Private.CoreLib",
          },
        ] } })
    ).to.equal("System.Private.CoreLib");
  });
});
