import {
  providerVirtualDeclarationFactKey,
} from "@tsonic/tsts";
import type {
  ExtensionFactKey,
  ExtensionFactSubject,
  Node,
  ProviderVirtualDeclarationFact,
  ResolvedSourceCallInfo,
  SourceAnalysisContext,
} from "@tsonic/tsts";

export interface SelectedProviderSourceCall {
  readonly call: Node;
  readonly selection: ResolvedSourceCallInfo;
  readonly declaration: ProviderVirtualDeclarationFact;
}

export type ProviderSourceCallSelector =
  | {
      readonly kind: "export-signature";
      readonly providerId: string;
      readonly providerVersion: string;
      readonly providerModuleId: string;
      readonly exportId: string;
      readonly signatureId: string;
    }
  | {
      readonly kind: "member-signature";
      readonly providerId: string;
      readonly providerVersion: string;
      readonly providerModuleId: string;
      readonly exportId: string;
      readonly memberId: string;
      readonly memberStatic: boolean;
      readonly signatureId: string;
    };

export function selectedProviderCallMatches(
  selected: SelectedProviderSourceCall,
  selector: ProviderSourceCallSelector,
  context: SourceAnalysisContext,
): boolean {
  const declaration = selected.declaration;
  if (
    declaration.providerId !== selector.providerId ||
    declaration.providerVersion !== selector.providerVersion ||
    declaration.providerModuleId !== selector.providerModuleId ||
    declaration.exportId !== selector.exportId ||
    declaration.signatureId !== selector.signatureId
  ) {
    return false;
  }
  if (selector.kind === "export-signature") {
    return declaration.memberId === undefined &&
      declaration.memberStatic === undefined &&
      directImportedModuleSpecifier(selected, context) === declaration.moduleSpecifier;
  }
  return declaration.memberId === selector.memberId &&
    declaration.memberStatic === selector.memberStatic;
}

export function forEachSelectedProviderSourceCall(
  context: SourceAnalysisContext,
  visitor: (call: SelectedProviderSourceCall) => void,
): void {
  for (const sourceFile of context.sourceFiles) {
    if (sourceFile === undefined || context.ast.getFileName(sourceFile).endsWith(".d.ts")) {
      continue;
    }
    visitPostOrder(sourceFile, context, (node): void => {
      if (!context.ast.is.IsCallExpression(node) && !context.ast.is.IsNewExpression(node)) {
        return;
      }
      const selection = context.checker.getResolvedCallInfo(node);
      if (selection?.outcome !== "applicable") {
        return;
      }
      const signatureDeclaration = context.checker.getSignatureDeclaration(selection.selectedSignature);
      const declaration = readSourceFact(
        context,
        signatureDeclaration,
        providerVirtualDeclarationFactKey,
      );
      if (declaration === undefined) {
        return;
      }
      visitor({ call: node, selection, declaration });
    });
  }
}

function directImportedModuleSpecifier(
  selected: SelectedProviderSourceCall,
  context: SourceAnalysisContext,
): string | undefined {
  const callee = unwrapParenthesizedExpression(
    selected.selection.sourceCallee.expression,
    context,
  );
  if (callee === undefined) {
    return undefined;
  }
  const binding = context.ast.is.IsPropertyAccessExpression(callee)
    ? context.ast.as.AsPropertyAccessExpression(callee)?.Expression
    : callee;
  const symbol = context.checker.getSymbolAtLocation(binding);
  for (const declaration of context.checker.getSymbolDeclarations(symbol)) {
    const importDeclaration = enclosingImportDeclaration(declaration, context);
    if (importDeclaration === undefined) {
      continue;
    }
    const moduleSpecifier =
      context.ast.as.AsImportDeclaration(importDeclaration)?.ModuleSpecifier;
    if (moduleSpecifier !== undefined) {
      return context.ast.text(moduleSpecifier);
    }
  }
  return undefined;
}

function enclosingImportDeclaration(
  node: Node | undefined,
  context: SourceAnalysisContext,
): Node | undefined {
  let current = node;
  while (current !== undefined) {
    if (context.ast.is.IsImportDeclaration(current)) {
      return current;
    }
    current = context.ast.parent(current);
  }
  return undefined;
}

function unwrapParenthesizedExpression(
  node: Node | undefined,
  context: SourceAnalysisContext,
): Node | undefined {
  let current = node;
  while (current !== undefined && context.ast.is.IsParenthesizedExpression(current)) {
    current = context.ast.as.AsParenthesizedExpression(current)?.Expression;
  }
  return current;
}

export function readSourceFact<TFact>(
  context: SourceAnalysisContext,
  subject: ExtensionFactSubject | undefined,
  key: ExtensionFactKey<TFact>,
): TFact | undefined {
  if (subject === undefined) {
    return undefined;
  }
  return context.facts.get(subject, key) ??
    context.factResolver.resolve(subject, key);
}

export function visitPostOrder(
  node: Node | undefined,
  context: Pick<SourceAnalysisContext, "ast">,
  visitor: (node: Node) => void,
  seen: Set<Node> = new Set(),
): void {
  if (node === undefined || seen.has(node)) {
    return;
  }
  seen.add(node);
  for (const child of context.ast.children(node)) {
    visitPostOrder(child ?? undefined, context, visitor, seen);
  }
  visitor(node);
}
