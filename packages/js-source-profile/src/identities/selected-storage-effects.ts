import type { Node } from "@tsonic/tsts";
import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import { createSourceCallableValueQuery } from "@tsonic/target-api/source";
import type { ResolvedSourceCallInfo, TargetSourceProgram } from "@tsonic/target-api/source";
import type { SourceStorageEffects } from "@tsonic/target-api/analysis";
import { jsSourceCallStorageEffect } from "./storage-effects.js";
import { jsSourceSemanticsIdentity } from "./source.js";

export interface JsSourceStorageOperationIdentity {
  readonly ownerName: string;
  readonly memberName: string;
  readonly declaration: Node;
}

const nativeOperationBindings = new Map([
  ["ObjectConstructor", "Object"],
  ["ErrorConstructor", "Error"],
  ["RangeErrorConstructor", "RangeError"],
  ["TypeErrorConstructor", "TypeError"],
  ["URIErrorConstructor", "URIError"],
]);

export function createJsSourceCallStorageEffects(
  source: TargetSourceProgram,
  identityFor: (node: Node, selected: ResolvedSourceCallInfo) => JsSourceStorageOperationIdentity | undefined,
): SourceStorageEffects {
  const selectValue = createSourceCallableValueQuery(source);
  return Object.freeze({
    call(node, selected) {
      if (selected.sourceSelectedSignatureKind !== "resolved") return undefined;
      const identity = identityFor(node, selected);
      const effect = jsSourceCallStorageEffect(identity, selected);
      const bindingName = identity === undefined ? undefined : nativeOperationBindings.get(identity.ownerName);
      if (effect === undefined || identity === undefined || bindingName === undefined) return undefined;
      const value = selectValue(selected.sourceCallee.expression);
      if (value === undefined) return undefined;
      const access = value.property ?? value.element;
      const binding = access === undefined ? value.selectedDeclaration : value.receiverDeclaration;
      const file = binding === undefined ? undefined : source.ast.getSourceFile(binding);
      if (binding === undefined || file === undefined || !source.ast.is.IsVariableDeclaration(binding) ||
        source.ast.as.AsVariableDeclaration(binding)?.Initializer !== undefined) return undefined;
      const operation = source.sourceFacts.getFact(identity.declaration, providerVirtualDeclarationFactKey);
      if (operation === undefined) {
        if (file !== source.ast.getSourceFile(identity.declaration) || source.ast.text(source.ast.name(binding)) !== bindingName)
          return undefined;
      } else {
        const global = source.sourceFacts.getFact(binding, providerVirtualDeclarationFactKey);
        if (global?.providerId !== jsSourceSemanticsIdentity.providerId || global.providerId !== operation.providerId ||
          global.providerVersion !== operation.providerVersion || global.providerModuleId !== operation.providerModuleId ||
          global.moduleSpecifier !== operation.moduleSpecifier || global.artifactFileName !== operation.artifactFileName ||
          global.exportName !== bindingName || global.memberName !== undefined || global.memberKey !== undefined ||
          global.memberId !== undefined || global.signatureId !== undefined) return undefined;
      }
      if (access !== undefined) {
        const symbol = access.selectedSymbol;
        const declarations = symbol === undefined ? [value.selectedDeclaration]
          : source.semantics.forNode(value.expression).declarations.symbolDeclarations(symbol);
        if (!declarations.includes(identity.declaration)) return undefined;
      } else if (identity.memberName !== "constructor" && identity.memberName !== "call") return undefined;
      return effect;
    },
  } satisfies SourceStorageEffects);
}
