import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import { createSourceCallableValueQuery } from "../../../source-navigation/callable-values.js";
import type { ResolvedSourceCallInfo } from "../../../source-semantics/call-result-selection.js";
import type { SourceFileSemantics, TargetSourceProgram } from "../../../source-semantics/types.js";
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
  selectConstructor: (declaration: Node, context: SourceFileSemantics) =>
    Pick<SourceGlobalCallStorageEffect, "declaration" | "binding"> | undefined,
): SourceStorageEffects {
  const selectValue = createSourceCallableValueQuery(source);
  const matchesBinding = (binding: Node | undefined,
    operation: Pick<SourceGlobalCallStorageEffect, "declaration" | "binding">): boolean => {
    const file = binding === undefined ? undefined : source.ast.getSourceFile(binding);
    if (binding === undefined || file === undefined || !source.ast.is.IsVariableDeclaration(binding) ||
      source.ast.as.AsVariableDeclaration(binding)?.Initializer !== undefined ||
      source.navigation.declarationUseSummary(binding).bindingWritten) return false;
    const declaration = source.sourceFacts.getFact(operation.declaration, providerVirtualDeclarationFactKey);
    if (declaration === undefined) {
      const semantics = source.semantics.forNode(binding);
      const type = semantics.declarations.declaredValueType(binding);
      if (type === undefined) return false;
      if ([...semantics.types.callSignatures(type), ...semantics.types.constructSignatures(type)]
        .some(signature => semantics.declarations.signatureDeclaration(signature) === operation.declaration)) return true;
      return semantics.types.propertyInfos(type).some(property => [property.symbol, ...property.rootSymbols]
        .some(symbol => semantics.declarations.symbolDeclarations(symbol).includes(operation.declaration)));
    }
    const global = source.sourceFacts.getFact(binding, providerVirtualDeclarationFactKey);
    return global?.providerId === operation.binding.providerId && global.providerId === declaration.providerId &&
      global.providerVersion === declaration.providerVersion && global.providerModuleId === declaration.providerModuleId &&
      global.moduleSpecifier === declaration.moduleSpecifier && global.artifactFileName === declaration.artifactFileName &&
      global.exportName === operation.binding.name && global.memberName === undefined && global.memberKey === undefined &&
      global.memberId === undefined && global.signatureId === undefined;
  };
  return Object.freeze({
    nativeConstructorsFor(binding, context) {
      if (!source.semantics.includes(context.sourceFile) || !source.ast.is.IsVariableDeclaration(binding) ||
        source.ast.as.AsVariableDeclaration(binding)?.Initializer !== undefined ||
        source.navigation.declarationUseSummary(binding).bindingWritten) return undefined;
      const type = context.declarations.declaredValueType(binding);
      const signatures = type === undefined ? [] : context.types.constructSignatures(type);
      if (signatures.length === 0) return undefined;
      const declarations = new Set<Node>();
      for (const signature of signatures) {
        const declaration = context.declarations.signatureDeclaration(signature);
        if (declaration === undefined || !source.ast.is.IsConstructSignatureDeclaration(declaration)) return undefined;
        const operation = selectConstructor(declaration, context);
        if (operation?.declaration !== declaration || !matchesBinding(binding, operation)) return undefined;
        declarations.add(declaration);
      }
      return Object.freeze([...declarations]);
    },
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
      if (!matchesBinding(binding, operation)) return undefined;
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
