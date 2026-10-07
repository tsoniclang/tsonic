import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import { createSourceCallableValueQuery } from "../../source-navigation/callable-values.js";
import type { ResolvedSourceCallInfo, TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceStorageCallEffect, SourceStorageEffects } from "./types.js";

export interface SourceGlobalCallStorageEffect {
  readonly declaration: Node;
  readonly binding: { readonly name: string; readonly providerId: string };
  readonly form: "member" | "value";
  readonly effect: SourceStorageCallEffect;
}

export function createSourceGlobalCallStorageEffects(
  source: TargetSourceProgram,
  select: (node: Node, call: ResolvedSourceCallInfo) => SourceGlobalCallStorageEffect | undefined,
): SourceStorageEffects {
  const selectValue = createSourceCallableValueQuery(source);
  return Object.freeze({
    call(node, call) {
      if (call.sourceSelectedSignatureKind !== "resolved") return undefined;
      const operation = select(node, call);
      if (operation === undefined) return undefined;
      if (source.semantics.forNode(node).declarations.signatureDeclaration(call.selectedSignature) !== operation.declaration)
        return undefined;
      const value = selectValue(call.sourceCallee.expression);
      if (value === undefined) return undefined;
      const access = value.property ?? value.element;
      if ((access === undefined) !== (operation.form === "value")) return undefined;
      const binding = access === undefined ? value.selectedDeclaration : value.receiverDeclaration;
      const file = binding === undefined ? undefined : source.ast.getSourceFile(binding);
      if (binding === undefined || file === undefined || !source.ast.is.IsVariableDeclaration(binding) ||
        source.ast.as.AsVariableDeclaration(binding)?.Initializer !== undefined) return undefined;
      const declaration = source.sourceFacts.getFact(operation.declaration, providerVirtualDeclarationFactKey);
      if (declaration === undefined) {
        if (file !== source.ast.getSourceFile(operation.declaration) ||
          source.ast.text(source.ast.name(binding)) !== operation.binding.name) return undefined;
      } else {
        const global = source.sourceFacts.getFact(binding, providerVirtualDeclarationFactKey);
        if (global?.providerId !== operation.binding.providerId || global.providerId !== declaration.providerId ||
          global.providerVersion !== declaration.providerVersion || global.providerModuleId !== declaration.providerModuleId ||
          global.moduleSpecifier !== declaration.moduleSpecifier || global.artifactFileName !== declaration.artifactFileName ||
          global.exportName !== operation.binding.name || global.memberName !== undefined || global.memberKey !== undefined ||
          global.memberId !== undefined || global.signatureId !== undefined) return undefined;
      }
      if (access !== undefined) {
        const symbol = access.selectedSymbol;
        const declarations = symbol === undefined ? [value.selectedDeclaration]
          : source.semantics.forNode(value.expression).declarations.symbolDeclarations(symbol);
        if (!declarations.includes(operation.declaration)) return undefined;
      }
      return operation.effect;
    },
  } satisfies SourceStorageEffects);
}
