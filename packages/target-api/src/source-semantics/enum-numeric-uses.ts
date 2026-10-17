import type { CheckedSourceProgram, Node, Symbol, Type } from "@tsonic/tsts";
import { ContextFlagsSkipBindingPatterns } from "@tsonic/tsts";
import { isSourceCallableBodyBoundary } from "../source-navigation/callable-boundaries.js";
import { isTsonicSourceProfileDeclarationPath } from "../source-profile.js";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceEnumAdmissionIssue, SourceEnumConstantIndex } from "./enum-constants.js";

const equalityOperators = new Set(["KindEqualsEqualsToken", "KindExclamationEqualsToken",
  "KindEqualsEqualsEqualsToken", "KindExclamationEqualsEqualsToken"]);
const bitwiseOperators = new Set(["KindAmpersandToken", "KindBarToken", "KindCaretToken",
  "KindAmpersandEqualsToken", "KindBarEqualsToken", "KindCaretEqualsToken"]);
const numericOperators = new Set(["KindLessThanToken", "KindLessThanEqualsToken", "KindGreaterThanToken",
  "KindGreaterThanEqualsToken", "KindPlusToken", "KindMinusToken", "KindAsteriskToken", "KindSlashToken",
  "KindPercentToken", "KindAsteriskAsteriskToken", "KindPlusEqualsToken", "KindMinusEqualsToken",
  "KindAsteriskEqualsToken", "KindSlashEqualsToken", "KindPercentEqualsToken", "KindAsteriskAsteriskEqualsToken",
  "KindLessThanLessThanToken", "KindGreaterThanGreaterThanToken", "KindGreaterThanGreaterThanGreaterThanToken",
  "KindLessThanLessThanEqualsToken", "KindGreaterThanGreaterThanEqualsToken", "KindGreaterThanGreaterThanGreaterThanEqualsToken"]);
const numericUnaryOperators = new Set(["KindPlusToken", "KindMinusToken", "KindPlusPlusToken", "KindMinusMinusToken"]);
const logicalOperators = new Set(["KindAmpersandAmpersandToken", "KindBarBarToken", "KindQuestionQuestionToken"]);
const valueKinds = new Set(["KindIdentifier", "KindPropertyAccessExpression", "KindElementAccessExpression",
  "KindCallExpression", "KindNewExpression", "KindTaggedTemplateExpression", "KindAwaitExpression",
  "KindConditionalExpression", "KindBinaryExpression", "KindParenthesizedExpression", "KindAsExpression",
  "KindTypeAssertionExpression", "KindSatisfiesExpression", "KindNonNullExpression", "KindPrefixUnaryExpression"]);

type EnumValueDomain = {
  readonly possibleEnums: readonly Symbol[];
  readonly certainEnum?: Symbol;
};

const emptyDomain: EnumValueDomain = Object.freeze({ possibleEnums: Object.freeze([]) });

export function analyzeSourceEnumNumericUses(
  source: CheckedSourceProgram,
  navigation: Pick<SourceProgramNavigation, "declarationSymbol" | "sourceFiles" | "sourceReferenceFor" | "declarationUseSummary">,
  enumConstants: Pick<SourceEnumConstantIndex, "get" | "integerWidth">,
): readonly SourceEnumAdmissionIssue[] {
  const { ast } = source;
  const issues: SourceEnumAdmissionIssue[] = [];
  for (const file of navigation.sourceFiles) {
    const { checker, typeShape: types } = source.getSourceFileQueries(file);
    const stringSymbol = checker.getGlobalValueSymbol("String");
    const stringType = stringSymbol === undefined ? undefined : checker.getTypeOfSymbol(stringSymbol);
    const stringCalls = stringType === undefined ? [] : checker.getCallSignaturesOfType(stringType)
      .map(signature => checker.getSignatureDeclaration(signature))
      .filter(declaration => declaration !== undefined && (checker.isDefaultLibraryDeclaration(declaration) ||
        isTsonicSourceProfileDeclarationPath(ast.getFileName(ast.getSourceFile(declaration)), "js")));
    const enumTypes = new WeakMap<Type, EnumValueDomain>();
    const expressionTypes = new WeakMap<Node, Type | null>();
    const enumValues = new WeakMap<Node, EnumValueDomain>();
    const pending: Node[] = [file];
    while (pending.length !== 0) {
      const node = pending.pop()!;
      if (ast.is.IsEnumDeclaration(node) || ast.is.IsComputedPropertyName(node)) continue;
      const stringUse = rejectedStringUse(node);
      const selected = stringUse ?? rejectedOperation(node) ?? rejectedContext(node);
      if (selected !== undefined) {
        issues.push(Object.freeze({ code: "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", category: "error",
          source: "tsonic", sourceNode: node,
          message: stringUse === undefined
            ? `Enum value '${checker.getSymbolName(selected)}' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.`
            : `Enum value '${checker.getSymbolName(selected)}' is converted to a string; enum-to-string conversion is not supported yet.` }));
        continue;
      }
      const children: Node[] = [];
      ast.forEachChild(node, child => { if (child !== undefined) children.push(child); });
      for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
    }

    function checkedType(node: Node): Type | undefined {
      const existing = expressionTypes.get(node);
      if (existing !== undefined) return existing ?? undefined;
      const selected = checker.getTypeAtLocation(node);
      expressionTypes.set(node, selected ?? null);
      return selected;
    }

    function enumDomain(type: Type | undefined): EnumValueDomain {
      if (type === undefined) return emptyDomain;
      const existing = enumTypes.get(type);
      if (existing !== undefined) return existing;
      const active = new Set<Type>();
      const remaining: { readonly type: Type; readonly parts?: readonly Type[] }[] = [{ type }];
      while (remaining.length !== 0) {
        const current = remaining.pop()!;
        if (enumTypes.has(current.type)) continue;
        if (current.parts !== undefined) {
          enumTypes.set(current.type, joinDomains(current.parts
            .filter(part => !types.isNullish(part) && !types.isNever(part))
            .map(part => enumTypes.get(part)!), types.isIntersection(current.type)));
          active.delete(current.type);
          continue;
        }
        if (active.has(current.type)) {
          enumTypes.set(current.type, emptyDomain);
          continue;
        }
        active.add(current.type);
        if (types.isUnion(current.type) || types.isIntersection(current.type)) {
          const parts = types.getUnionOrIntersectionTypes(current.type).map(part => {
            if (part === undefined) throw new Error("A completed enum-use type requires every checked constituent.");
            return part;
          });
          remaining.push({ type: current.type, parts });
          for (const part of parts) remaining.push({ type: part });
          continue;
        }
        const symbols = new Set<Symbol>();
        const symbol = types.isNumberLike(current.type) || types.isStringLike(current.type)
          ? checker.getTypeSymbol(current.type) : undefined;
        for (const declaration of symbol === undefined ? [] : checker.getSymbolDeclarations(symbol)) {
          if (declaration === undefined) throw new Error("A checked enum type requires exact declaration identities.");
          const owner = ast.is.IsEnumDeclaration(declaration) ? declaration
            : ast.is.IsEnumMember(declaration) ? ast.parent(declaration) : undefined;
          if (owner === undefined || !ast.is.IsEnumDeclaration(owner)) continue;
          const width = enumConstants.integerWidth(owner);
          if (width?.kind === "rejected" && width.admissionIssue !== undefined) continue;
          const selected = navigation.declarationSymbol(owner, file);
          if (selected === undefined) throw new Error("A checked enum use requires its exact enum declaration symbol.");
          symbols.add(selected);
        }
        const possibleEnums = Object.freeze([...symbols]);
        enumTypes.set(current.type, possibleEnums.length === 0 ? emptyDomain : Object.freeze({ possibleEnums,
          ...(possibleEnums.length === 1 ? { certainEnum: possibleEnums[0]! } : {}) }));
        active.delete(current.type);
      }
      return enumTypes.get(type)!;
    }

    function joinDomains(domains: readonly EnumValueDomain[], intersection = false): EnumValueDomain {
      const possibleEnums = Object.freeze([...new Set(domains.flatMap(domain => domain.possibleEnums))]);
      if (possibleEnums.length === 0) return emptyDomain;
      const certain = intersection ? domains.find(domain => domain.certainEnum !== undefined)?.certainEnum
        : domains[0]?.certainEnum;
      const agrees = certain !== undefined && (intersection ? possibleEnums.every(symbol => symbol === certain)
        : domains.every(domain => domain.certainEnum === certain));
      return Object.freeze({ possibleEnums, ...(agrees ? { certainEnum: certain } : {}) });
    }

    function identicalEnum(left: EnumValueDomain, right: EnumValueDomain): boolean {
      return left.certainEnum !== undefined && left.certainEnum === right.certainEnum;
    }

    function rejectedStringUse(node: Node): Symbol | undefined {
      if (ast.is.IsTemplateExpression(node)) {
        for (const span of ast.as.AsTemplateExpression(node)?.TemplateSpans?.Nodes ?? []) {
          if (span === undefined) throw new Error("A checked enum template requires each actual interpolation.");
          const expression = ast.as.AsTemplateSpan(span)?.Expression;
          if (expression === undefined) throw new Error("A checked enum template requires its actual value expression.");
          const selected = enumValue(expression).possibleEnums[0];
          if (selected !== undefined) return selected;
        }
      }
      if (ast.is.IsBinaryExpression(node) && (ast.operatorKindName(node) === "KindPlusToken" || ast.operatorKindName(node) === "KindPlusEqualsToken")) {
        const binary = ast.as.AsBinaryExpression(node)!;
        if (binary.Left === undefined || binary.Right === undefined) throw new Error("A checked string conversion requires both actual operands.");
        const leftType = checkedType(binary.Left);
        const rightType = checkedType(binary.Right);
        if (leftType !== undefined && types.isStringLike(leftType) || rightType !== undefined && types.isStringLike(rightType)) {
          return enumValue(binary.Left).possibleEnums[0] ?? enumValue(binary.Right).possibleEnums[0];
        }
      }
      if (!ast.is.IsCallExpression(node)) return undefined;
      const call = checker.getResolvedCallInfo(node);
      if (call === undefined) return undefined;
      const declaration = checker.getSignatureDeclaration(call.selectedSignature);
      if (declaration !== undefined && stringCalls.includes(declaration)) {
        for (const argument of call.sourceArguments) {
          const selected = enumValue(argument.expression).possibleEnums[0];
          if (selected !== undefined) return selected;
        }
      }
      const member = call.sourceCalleeAccess?.selectedSymbol;
      return member !== undefined && checker.getSymbolName(member) === "toString" && call.sourceReceiver !== undefined
        ? enumValue(call.sourceReceiver.expression).possibleEnums[0] : undefined;
    }

    function rejectedOperation(node: Node): Symbol | undefined {
      if (ast.is.IsCaseClause(node)) {
        const block = ast.parent(node);
        const statement = block === undefined ? undefined : ast.parent(block);
        const subject = statement !== undefined && ast.is.IsSwitchStatement(statement)
          ? ast.as.AsSwitchStatement(statement)?.Expression : undefined;
        const value = ast.as.AsCaseOrDefaultClause(node)?.Expression;
        if (subject === undefined || value === undefined) throw new Error("A checked enum case requires its actual switch and case expressions.");
        const left = enumValue(subject);
        const right = enumValue(value);
        return identicalEnum(left, right) ? undefined : left.possibleEnums[0] ?? right.possibleEnums[0];
      }
      if (ast.is.IsElementAccessExpression(node)) {
        const access = checker.getResolvedElementAccessInfo(node);
        if (access !== undefined) {
          const indexes = types.isArrayLike(access.receiver.type) ? undefined
            : types.selectIndexedAccess(access.receiver.type, access.argument.type);
          if (types.isArrayLike(access.receiver.type) || indexes?.kind === "resolved" && indexes.members.length !== 0 &&
            indexes.members.every(member => member.kind === "index" && member.index.keyType !== undefined && numericDestination(member.index.keyType))) {
            return enumValue(access.argument.expression).possibleEnums[0];
          }
        }
      }
      if (ast.is.IsAsExpression(node) || ast.is.IsTypeAssertion(node)) {
        const value = ast.is.IsAsExpression(node) ? ast.as.AsAsExpression(node)?.Expression
          : ast.as.AsTypeAssertion(node)?.Expression;
        const destination = checkedType(node);
        if (value === undefined) throw new Error("A checked enum assertion requires its actual operand.");
        return destination !== undefined && numericDestination(destination) ? enumValue(value).possibleEnums[0] : undefined;
      }
      const operator = ast.operatorKindName(node);
      if (operator === undefined) return undefined;
      if (ast.is.IsBinaryExpression(node) &&
        (equalityOperators.has(operator) || bitwiseOperators.has(operator) || numericOperators.has(operator))) {
        const expression = ast.as.AsBinaryExpression(node)!;
        if (expression.Left === undefined || expression.Right === undefined)
          throw new Error("A checked enum binary use requires both actual operands.");
        const left = enumValue(expression.Left);
        const right = enumValue(expression.Right);
        return identicalEnum(left, right) && (equalityOperators.has(operator) || bitwiseOperators.has(operator))
          ? undefined : left.possibleEnums[0] ?? right.possibleEnums[0];
      }
      if ((ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) && numericUnaryOperators.has(operator)) {
        const operand = ast.is.IsPrefixUnaryExpression(node) ? ast.as.AsPrefixUnaryExpression(node)?.Operand
          : ast.as.AsPostfixUnaryExpression(node)?.Operand;
        if (operand === undefined) throw new Error("A checked enum unary use requires its actual operand.");
        return enumValue(operand).possibleEnums[0];
      }
      return undefined;
    }

    function rejectedContext(node: Node): Symbol | undefined {
      if (!valueKinds.has(ast.kindName(node))) return undefined;
      const parent = ast.parent(node);
      if (parent !== undefined && (ast.is.IsAsExpression(parent) || ast.is.IsTypeAssertion(parent) ||
        ast.is.IsSatisfiesExpression(parent) || ast.is.IsParenthesizedExpression(parent) ||
        ast.is.IsNonNullExpression(parent) || ast.is.IsConditionalExpression(parent) ||
        ast.is.IsBinaryExpression(parent) && (logicalOperators.has(ast.operatorKindName(parent)!) ||
          ast.operatorKindName(parent) === "KindCommaToken"))) return undefined;
      const selected = enumValue(node);
      if (selected.possibleEnums.length === 0) return undefined;
      const contextual = checker.getContextualType(node, ContextFlagsSkipBindingPatterns);
      if (contextual !== undefined) return numericDestination(contextual) ? selected.possibleEnums[0] : undefined;
      if (parent === undefined) return undefined;
      const stored = ast.is.IsPropertyAssignment(parent) && ast.as.AsPropertyAssignment(parent)?.Initializer === node ||
        ast.is.IsShorthandPropertyAssignment(parent) && ast.name(parent) === node || ast.is.IsArrayLiteralExpression(parent);
      if (stored) {
        const resultType = checkedType(node);
        return resultType !== undefined && numericDestination(resultType) ? selected.possibleEnums[0] : undefined;
      }
      if (ast.is.IsReturnStatement(parent) || ast.is.IsArrowFunction(parent)) {
        let callable: Node | undefined = parent;
        while (callable !== undefined && !isSourceCallableBodyBoundary(ast, callable)) callable = ast.parent(callable);
        const destination = callable === undefined ? undefined : types.getDeclarationSignatureInfo(callable)?.returnType;
        return destination !== undefined && numericDestination(destination) ? selected.possibleEnums[0] : undefined;
      }
      return undefined;
    }

    function enumValue(expression: Node): EnumValueDomain {
      const pendingValues: { readonly node: Node; readonly children?: readonly Node[] }[] = [{ node: expression }];
      const active = new Set<Node>();
      while (pendingValues.length !== 0) {
        const current = pendingValues.pop()!;
        if (enumValues.has(current.node)) continue;
        if (current.children !== undefined) {
          const domains = current.children.filter(child => {
            const type = checkedType(child);
            return type === undefined || !types.isNullish(type) && !types.isNever(type);
          }).map(child => enumValues.get(child)!);
          enumValues.set(current.node, joinDomains(domains));
          active.delete(current.node);
          continue;
        }
        if (active.has(current.node)) {
          enumValues.set(current.node, emptyDomain);
          continue;
        }
        active.add(current.node);
        const type = checkedType(current.node);
        const selected = enumDomain(type);
        if (selected.possibleEnums.length !== 0) {
          enumValues.set(current.node, selected);
          active.delete(current.node);
          continue;
        }
        const operator = ast.operatorKindName(current.node);
        const declaration = ast.is.IsIdentifier(current.node) ? navigation.sourceReferenceFor(current.node)?.declaration : undefined;
        const initializer = declaration !== undefined && ast.is.IsVariableDeclaration(declaration) &&
          ast.typeNode(declaration) === undefined && (ast.variableDeclarationKind(declaration) === "const" ||
            !navigation.declarationUseSummary(declaration).bindingWritten)
          ? ast.as.AsVariableDeclaration(declaration)?.Initializer : undefined;
        const inner = ast.is.IsParenthesizedExpression(current.node) ? ast.as.AsParenthesizedExpression(current.node)?.Expression
          : ast.is.IsNonNullExpression(current.node) ? ast.as.AsNonNullExpression(current.node)?.Expression
          : ast.is.IsSatisfiesExpression(current.node) ? ast.as.AsSatisfiesExpression(current.node)?.Expression
          : ast.is.IsPrefixUnaryExpression(current.node) && operator === "KindTildeToken"
            ? ast.as.AsPrefixUnaryExpression(current.node)?.Operand : initializer;
        const binary = ast.is.IsBinaryExpression(current.node) && operator !== undefined &&
          (bitwiseOperators.has(operator) || logicalOperators.has(operator) || operator === "KindCommaToken")
          ? ast.as.AsBinaryExpression(current.node) : undefined;
        const conditional = ast.is.IsConditionalExpression(current.node) ? ast.as.AsConditionalExpression(current.node) : undefined;
        const excludedLogical = binary !== undefined && operator !== undefined && logicalOperators.has(operator) &&
          type !== undefined && excludesEnum(type);
        const children = inner !== undefined ? [inner]
          : excludedLogical ? undefined
          : conditional?.WhenTrue !== undefined && conditional.WhenFalse !== undefined ? [conditional.WhenTrue, conditional.WhenFalse]
          : binary?.Right !== undefined && operator === "KindCommaToken" ? [binary.Right]
          : binary?.Left !== undefined && binary.Right !== undefined ? [binary.Left, binary.Right] : undefined;
        if (children === undefined) {
          enumValues.set(current.node, emptyDomain);
          active.delete(current.node);
          continue;
        }
        pendingValues.push({ node: current.node, children });
        for (const child of children) pendingValues.push({ node: child });
      }
      return enumValues.get(expression)!;
    }

    function excludesEnum(type: Type): boolean {
      if (enumDomain(type).possibleEnums.length !== 0 || types.isAny(type) || types.isUnknown(type) ||
        types.couldContainTypeVariables(type)) return false;
      if (types.isUnion(type) || types.isIntersection(type)) {
        const parts = types.getUnionOrIntersectionTypes(type);
        return parts.length !== 0 && parts.every(part => part !== undefined && excludesEnum(part));
      }
      return !types.isNumberLike(type);
    }

    function numericDestination(type: Type): boolean {
      if (enumDomain(type).possibleEnums.length !== 0) return false;
      if (types.isNumberLike(type)) return true;
      if (!types.isUnion(type) && !types.isIntersection(type)) return false;
      const parts = types.getUnionOrIntersectionTypes(type);
      return parts.length > 0 && (types.isIntersection(type) ? parts.some(part => part !== undefined && numericDestination(part))
        : parts.every(part => part !== undefined && (types.isNullish(part) || numericDestination(part))));
    }
  }
  return Object.freeze(issues);
}
