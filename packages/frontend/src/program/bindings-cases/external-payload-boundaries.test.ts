import { expect } from "chai";
import { describe, it } from "mocha";
import {
  extractRawExternalOwnerIdentity,
  extractRawExternalBindingsPayload,
  getExternalBindingPayload,
} from "../bindings.js";

describe("external binding payload boundaries", () => {
  it("returns the target payload for first-party v2 manifests", () => {
    const manifest = {
      namespace: "Acme.Core",
      producer: {
        tool: "tsonic",
        mode: "tsonic-firstparty",
      },
      semanticSurface: {
        types: [{ alias: "Widget" }],
        exports: { loadWidget: { kind: "function" } },
      },
      targetSurface: {
        types: [
          {
            targetName: "Acme.Core.Widget",
            ownerIdentity: "Acme.Core",
            kind: "Class",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
        exports: {
          loadWidget: {
            kind: "method",
            targetName: "loadWidget",
            ownerQualifiedName: "Acme.Core.WidgetRuntime",
            ownerIdentity: "Acme.Core",
          },
        },
      },
    } as const;

    const payload = getExternalBindingPayload(manifest);
    expect(payload).to.not.equal(undefined);
    expect(payload?.namespace).to.equal("Acme.Core");
    expect(payload?.types[0]?.targetName).to.equal("Acme.Core.Widget");
    expect(payload?.exports?.loadWidget?.ownerQualifiedName).to.equal(
      "Acme.Core.WidgetRuntime"
    );
  });

  it("preserves tsbindgen bindings manifests as the target payload", () => {
    const manifest = {
      namespace: "System",
      types: [
        {
          targetName: "System.String",
          ownerIdentity: "System.Private.CoreLib",
          kind: "Class",
          methods: [],
          properties: [],
          fields: [],
        },
      ],
      exports: {
        format: {
          kind: "method",
          targetName: "Format",
          ownerQualifiedName: "System.String",
          ownerIdentity: "System.Private.CoreLib",
        },
      },
    } as const;

    const payload = getExternalBindingPayload(manifest);
    expect(payload).to.equal(manifest);
    expect(payload?.exports?.format?.targetName).to.equal("Format");
  });

  it("extracts raw target payloads from parsed bindings content", () => {
    const parsed = {
      namespace: "Acme.Core",
      producer: {
        tool: "tsonic",
        mode: "tsonic-firstparty",
      },
      semanticSurface: {
        types: [{ alias: "Widget" }],
      },
      targetSurface: {
        types: [
          {
            targetName: "Acme.Core.Widget",
            ownerIdentity: "Acme.Core",
          },
        ],
      },
    };

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
    });
  });

  it("extracts the first owner identity from whichever target payload shape is present", () => {
    expect(
      extractRawExternalOwnerIdentity({
        namespace: "System",
        types: [
          { targetName: "System.String", ownerIdentity: "System.Private.CoreLib" },
        ],
      })
    ).to.equal("System.Private.CoreLib");

    expect(
      extractRawExternalOwnerIdentity({
        namespace: "Acme.Core",
        targetSurface: {
          types: [{ targetName: "Acme.Core.Widget", ownerIdentity: "Acme.Core" }],
        },
      })
    ).to.equal("Acme.Core");
  });
});
