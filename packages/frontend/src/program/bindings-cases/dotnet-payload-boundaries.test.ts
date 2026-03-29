import { expect } from "chai";
import { describe, it } from "mocha";
import {
  extractRawDotnetAssemblyName,
  extractRawDotnetBindingsPayload,
  getDotnetBindingPayload,
} from "../bindings.js";

describe("dotnet binding payload boundaries", () => {
  it("returns the dotnet payload for first-party v2 manifests", () => {
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
      dotnet: {
        types: [
          {
            clrName: "Acme.Core.Widget",
            assemblyName: "Acme.Core",
            kind: "Class",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
        exports: {
          loadWidget: {
            kind: "method",
            clrName: "loadWidget",
            declaringClrType: "Acme.Core.WidgetRuntime",
            declaringAssemblyName: "Acme.Core",
          },
        },
      },
    } as const;

    const payload = getDotnetBindingPayload(manifest);
    expect(payload).to.not.equal(undefined);
    expect(payload?.namespace).to.equal("Acme.Core");
    expect(payload?.types[0]?.clrName).to.equal("Acme.Core.Widget");
    expect(payload?.exports?.loadWidget?.declaringClrType).to.equal(
      "Acme.Core.WidgetRuntime"
    );
  });

  it("preserves tsbindgen bindings manifests as the dotnet payload", () => {
    const manifest = {
      namespace: "System",
      types: [
        {
          clrName: "System.String",
          assemblyName: "System.Private.CoreLib",
          kind: "Class",
          methods: [],
          properties: [],
          fields: [],
        },
      ],
      exports: {
        format: {
          kind: "method",
          clrName: "Format",
          declaringClrType: "System.String",
          declaringAssemblyName: "System.Private.CoreLib",
        },
      },
    } as const;

    const payload = getDotnetBindingPayload(manifest);
    expect(payload).to.equal(manifest);
    expect(payload?.exports?.format?.clrName).to.equal("Format");
  });

  it("extracts raw dotnet payloads from parsed bindings content", () => {
    const parsed = {
      namespace: "Acme.Core",
      producer: {
        tool: "tsonic",
        mode: "tsonic-firstparty",
      },
      semanticSurface: {
        types: [{ alias: "Widget" }],
      },
      dotnet: {
        types: [
          {
            clrName: "Acme.Core.Widget",
            assemblyName: "Acme.Core",
          },
        ],
      },
    };

    const payload = extractRawDotnetBindingsPayload(parsed);
    expect(payload).to.deep.equal({
      namespace: "Acme.Core",
      types: [
        {
          clrName: "Acme.Core.Widget",
          assemblyName: "Acme.Core",
        },
      ],
      exports: undefined,
    });
  });

  it("extracts the first assembly name from whichever dotnet payload shape is present", () => {
    expect(
      extractRawDotnetAssemblyName({
        namespace: "System",
        types: [
          { clrName: "System.String", assemblyName: "System.Private.CoreLib" },
        ],
      })
    ).to.equal("System.Private.CoreLib");

    expect(
      extractRawDotnetAssemblyName({
        namespace: "Acme.Core",
        dotnet: {
          types: [{ clrName: "Acme.Core.Widget", assemblyName: "Acme.Core" }],
        },
      })
    ).to.equal("Acme.Core");
  });
});
