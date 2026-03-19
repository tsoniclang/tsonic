import { writeFileSync } from "node:fs";
import {
  reattachBindingClrIdentities,
  serializeBindingsJsonSafe,
} from "../binding-semantics.js";
import type {
  FirstPartyBindingsExport,
  FirstPartyBindingsFile,
  FirstPartyBindingsType,
} from "../types.js";

export const writeBindingsManifest = (opts: {
  readonly bindingsPath: string;
  readonly namespace: string;
  readonly outputName: string;
  readonly typeBindings: readonly FirstPartyBindingsType[];
  readonly valueBindings: ReadonlyMap<string, FirstPartyBindingsExport>;
  readonly clrNamesByAlias: ReadonlyMap<string, string>;
}): void => {
  const normalizedTypeBindings = opts.typeBindings.map((typeBinding) => ({
    ...typeBinding,
    methods: typeBinding.methods.map((method) => ({
      ...method,
      semanticSignature: method.semanticSignature
        ? {
            ...method.semanticSignature,
            parameters: method.semanticSignature.parameters.map((parameter) => ({
              ...parameter,
              type:
                reattachBindingClrIdentities(
                  parameter.type,
                  opts.clrNamesByAlias
                ) ?? parameter.type,
            })),
            returnType: reattachBindingClrIdentities(
              method.semanticSignature.returnType,
              opts.clrNamesByAlias
            ),
          }
        : undefined,
    })),
    properties: typeBinding.properties.map((property) => ({
      ...property,
      semanticType: reattachBindingClrIdentities(
        property.semanticType,
        opts.clrNamesByAlias
      ),
    })),
    fields: typeBinding.fields.map((field) => ({
      ...field,
      semanticType: reattachBindingClrIdentities(
        field.semanticType,
        opts.clrNamesByAlias
      ),
    })),
  }));

  const normalizedValueBindings =
    opts.valueBindings.size > 0
      ? new Map(
          Array.from(opts.valueBindings.entries()).map(([exportName, binding]) => [
            exportName,
            {
              ...binding,
              semanticType: reattachBindingClrIdentities(
                binding.semanticType,
                opts.clrNamesByAlias
              ),
              semanticSignature: binding.semanticSignature
                ? {
                    ...binding.semanticSignature,
                    parameters: binding.semanticSignature.parameters.map(
                      (parameter) => ({
                        ...parameter,
                        type:
                          reattachBindingClrIdentities(
                            parameter.type,
                            opts.clrNamesByAlias
                          ) ?? parameter.type,
                      })
                    ),
                    returnType: reattachBindingClrIdentities(
                      binding.semanticSignature.returnType,
                      opts.clrNamesByAlias
                    ),
                  }
                : undefined,
            } satisfies FirstPartyBindingsExport,
          ])
        )
      : undefined;

  const bindings: FirstPartyBindingsFile = {
    namespace: opts.namespace,
    contributingAssemblies: [opts.outputName],
    types: normalizedTypeBindings.sort((left, right) =>
      left.clrName.localeCompare(right.clrName)
    ),
    exports:
      normalizedValueBindings && normalizedValueBindings.size > 0
        ? Object.fromEntries(
            Array.from(normalizedValueBindings.entries()).sort((left, right) =>
              left[0].localeCompare(right[0])
            )
          )
        : undefined,
    producer: {
      tool: "tsonic",
      mode: "aikya-firstparty",
    },
  };

  writeFileSync(
    opts.bindingsPath,
    JSON.stringify(serializeBindingsJsonSafe(bindings), null, 2) + "\n",
    "utf-8"
  );
};
