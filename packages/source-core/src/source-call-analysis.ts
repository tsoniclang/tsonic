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
import type {
  TsonicSourceFileAnalysisContext,
} from "./source-analysis-context.js";
import {
  forEachTsonicSourceFile,
} from "./source-analysis-context.js";

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
  context: TsonicSourceFileAnalysisContext,
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
  visitor: (
    call: SelectedProviderSourceCall,
    context: TsonicSourceFileAnalysisContext,
  ) => void,
): void {
  forEachTsonicSourceFile(context, (sourceContext): void => {
    visitPostOrder(sourceContext.sourceFile, sourceContext, (node): void => {
      if (!sourceContext.ast.is.IsCallExpression(node) && !sourceContext.ast.is.IsNewExpression(node)) {
        return;
      }
      const selection = sourceContext.checker.getResolvedCallInfo(node);
      if (selection?.outcome !== "applicable") {
        return;
      }
      const signatureDeclaration = sourceContext.checker.getSignatureDeclaration(selection.selectedSignature);
      const declaration = readSourceFact(
        sourceContext,
        signatureDeclaration,
        providerVirtualDeclarationFactKey,
      );
      if (declaration === undefined) {
        return;
      }
      visitor({ call: node, selection, declaration }, sourceContext);
    });
  });
}

function directImportedModuleSpecifier(
  selected: SelectedProviderSourceCall,
  context: TsonicSourceFileAnalysisContext,
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
  context: TsonicSourceFileAnalysisContext,
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
  context: TsonicSourceFileAnalysisContext,
): Node | undefined {
  let current = node;
  while (current !== undefined && context.ast.is.IsParenthesizedExpression(current)) {
    current = context.ast.as.AsParenthesizedExpression(current)?.Expression;
  }
  return current;
}

export function readSourceFact<TFact>(
  context: Pick<TsonicSourceFileAnalysisContext, "facts" | "factResolver">,
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
  context: Pick<TsonicSourceFileAnalysisContext, "ast">,
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
