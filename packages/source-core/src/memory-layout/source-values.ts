import { providerVirtualDeclarationFactKey, sourcePrimitiveFactKey } from "@tsonic/tsts";
import type { Node, ResolvedSourceCallInfo, SourcePrimitiveFact, Symbol } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../analysis/context.js";
import { readSourceFact } from "../analysis/source-call.js";
import { dataLayoutIdentityKey } from "./registrations.js";
import { tsonicDataLayoutFactKey } from "./facts.js";
import type { TsonicDataLayoutFact } from "./facts.js";
import type { MemorySourceAnalysis } from "./analysis-context.js";

export type SelectedMemoryValue = ResolvedSourceCallInfo["sourceArguments"][number];

export function immutableValueOrigin(
  expression: Node,
  context: TsonicSourceFileAnalysisContext,
): Node | undefined {
  let current: Node | undefined = expression;
  const seen = new Set<Node>();
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    if (context.ast.is.IsParenthesizedExpression(current)) {
      current = context.ast.as.AsParenthesizedExpression(current)?.Expression;
      continue;
    }
    if (context.ast.is.IsIdentifier(current)) {
      const resolved = selectedValueSymbol(current, context);
      const declaration = context.checker.getSymbolValueDeclaration(resolved);
      if (declaration !== undefined && context.ast.is.IsVariableDeclaration(declaration) &&
          context.ast.variableDeclarationKind(declaration) === "const") {
        const initializer = context.ast.as.AsVariableDeclaration(declaration)?.Initializer;
        if (initializer !== undefined) {
          current = initializer;
          continue;
        }
      }
    }
    return current;
  }
  return undefined;
}

export function selectedPrimitive(
  value: SelectedMemoryValue,
  context: TsonicSourceFileAnalysisContext,
  analysis: MemorySourceAnalysis,
): SourcePrimitiveFact | undefined {
  const source = selectedValueSource(value, context);
  if (source === undefined) return undefined;
  if (source.annotation !== undefined) return readSourceFact(context, source.annotation, sourcePrimitiveFactKey);
  const operation = analysis.rawOperation(source.expression, context);
  if (operation?.operation === "raw-to-address-integer") {
    return { kind: "native-uint", runtimeBase: "number", signed: false };
  }
  return readSourceFact(context, selectedCallReturnAnnotation(source.expression, context), sourcePrimitiveFactKey);
}

export function selectedValueAnnotation(value: SelectedMemoryValue, context: TsonicSourceFileAnalysisContext): Node | undefined {
  const source = selectedValueSource(value, context);
  return source?.annotation ?? (source === undefined ? undefined : selectedCallReturnAnnotation(source.expression, context));
}

function selectedCallReturnAnnotation(expression: Node, context: TsonicSourceFileAnalysisContext): Node | undefined {
  if (!context.ast.is.IsCallExpression(expression)) return undefined;
  const call = context.checker.getResolvedCallInfo(expression);
  return call === undefined ? undefined : context.ast.typeNode(context.checker.getSignatureDeclaration(call.selectedSignature));
}

function selectedValueSource(value: SelectedMemoryValue, context: TsonicSourceFileAnalysisContext): {
  readonly expression: Node;
  readonly annotation?: Node;
} | undefined {
  if (value.authoredTypeNode !== undefined) return { expression: value.expression, annotation: value.authoredTypeNode };
  let expression: Node | undefined = value.expression;
  const seen = new Set<Node>();
  while (expression !== undefined && !seen.has(expression)) {
    seen.add(expression);
    if (context.ast.is.IsParenthesizedExpression(expression)) {
      expression = context.ast.as.AsParenthesizedExpression(expression)?.Expression;
      continue;
    }
    const storage = context.checker.getResolvedStorageInfo(expression);
    const declaration = storage?.declaration;
    const annotation = context.ast.typeNode(declaration);
    if (annotation !== undefined) return { expression, annotation };
    if (declaration !== undefined && context.ast.is.IsVariableDeclaration(declaration) &&
        context.ast.variableDeclarationKind(declaration) === "const") {
      expression = context.ast.as.AsVariableDeclaration(declaration)?.Initializer;
      continue;
    }
    const authored = context.ast.typeNode(expression);
    return { expression, ...(authored === undefined ? {} : { annotation: authored }) };
  }
  return undefined;
}

export function exactIntegerConstant(
  expression: Node,
  context: TsonicSourceFileAnalysisContext,
): { readonly value: bigint; readonly runtimeBase: "number" | "bigint" } | undefined {
  const visited = new Set<Node>();
  let current: Node | undefined = expression;
  let sign = 1n;
  let permitsBigInt = true;
  while (current !== undefined) {
    const origin = immutableValueOrigin(current, context);
    if (origin === undefined || visited.has(origin)) return undefined;
    visited.add(origin);
    if (context.ast.is.IsPrefixUnaryExpression(origin)) {
      const operator = context.ast.operatorKindName(origin);
      if (operator !== "KindMinusToken" && operator !== "KindPlusToken") return undefined;
      if (operator === "KindMinusToken") sign = -sign;
      else permitsBigInt = false;
      current = context.ast.as.AsPrefixUnaryExpression(origin)?.Operand;
      continue;
    }
    const constant = integerLeafConstant(origin, context);
    return constant === undefined || (!permitsBigInt && constant.runtimeBase === "bigint")
      ? undefined : { value: sign * constant.value, runtimeBase: constant.runtimeBase };
  }
  return undefined;
}

function integerLeafConstant(
  origin: Node,
  context: TsonicSourceFileAnalysisContext,
): { readonly value: bigint; readonly runtimeBase: "number" | "bigint" } | undefined {
  if (context.ast.is.IsNumericLiteral(origin)) {
    const value = Number(context.ast.text(origin).split("_").join(""));
    return Number.isSafeInteger(value) ? { value: BigInt(value), runtimeBase: "number" } : undefined;
  }
  if (context.ast.is.IsBigIntLiteral(origin)) {
    const text = context.ast.text(origin).split("_").join("");
    if (!/^(?:[0-9]+|0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+)n$/u.test(text)) return undefined;
    return { value: BigInt(text.slice(0, -1)), runtimeBase: "bigint" };
  }
  const constant = context.checker.getConstantValue(origin);
  return typeof constant === "number" && Number.isSafeInteger(constant)
    ? { value: BigInt(constant), runtimeBase: "number" } : undefined;
}

export function exactLayoutSize(expression: Node, context: TsonicSourceFileAnalysisContext): number | undefined {
  const constant = exactIntegerConstant(expression, context);
  return constant !== undefined && constant.value >= 0n && constant.value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(constant.value) : undefined;
}

export function selectedDataLayout(
  value: SelectedMemoryValue,
  context: TsonicSourceFileAnalysisContext,
  registrations: ReadonlyMap<string, TsonicDataLayoutFact>,
): TsonicDataLayoutFact | undefined {
  const origin = immutableValueOrigin(value.expression, context);
  if (origin === undefined) return undefined;
  const resolved = selectedValueSymbol(origin, context);
  const declaration = context.checker.getSymbolValueDeclaration(resolved);
  const provider = readSourceFact(context, declaration, providerVirtualDeclarationFactKey) ??
    readSourceFact(context, resolved, providerVirtualDeclarationFactKey);
  if (provider === undefined || provider.memberId !== undefined || provider.signatureId !== undefined) return undefined;
  const layout = registrations.get(dataLayoutIdentityKey(provider));
  if (layout === undefined) return undefined;
  context.facts.set(value.expression, tsonicDataLayoutFactKey, layout);
  context.facts.set(origin, tsonicDataLayoutFactKey, layout);
  return layout;
}

function selectedValueSymbol(expression: Node, context: TsonicSourceFileAnalysisContext): Symbol | undefined {
  const symbol = context.checker.getSymbolAtLocation(expression);
  if (symbol === undefined) return undefined;
  const isAlias = context.checker.getSymbolDeclarations(symbol).some((declaration) =>
    declaration !== undefined && (context.ast.is.IsImportSpecifier(declaration) ||
      context.ast.is.IsImportClause(declaration) || context.ast.is.IsNamespaceImport(declaration) ||
      context.ast.is.IsExportSpecifier(declaration)));
  return isAlias ? context.checker.getAliasedSymbol(symbol) : symbol;
}
