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
      .map(signature => checker.getSignatureDeclaration(signature)).filter(libraryDeclaration);
    const enumTypes = new WeakMap<Type, EnumValueDomain>();
    const expressionTypes = new WeakMap<Node, Type | null>();
    const enumValues = new WeakMap<Node, EnumValueDomain>();
    const pending: Node[] = [file];
    let rejectedRoot: Node | undefined;
    while (pending.length !== 0) {
      const node = pending.pop()!;
      if (rejectedRoot !== undefined) {
        let ancestor: Node | undefined = node;
        while (ancestor !== undefined && ancestor !== rejectedRoot) ancestor = ast.parent(ancestor);
        if (ancestor === rejectedRoot) continue;
        rejectedRoot = undefined;
      }
      if (ast.is.IsEnumDeclaration(node) || ast.is.IsComputedPropertyName(node) || ast.is.IsInterfaceDeclaration(node) ||
        ast.is.IsTypeAliasDeclaration(node) || ast.is.IsTypeQueryNode(node) || ast.is.IsTypeReferenceNode(node) ||
        ast.is.IsTypeParameterDeclaration(node)) continue;
      const selected = valueKinds.has(ast.kindName(node)) && isValueUse(node) ? enumValue(node) : emptyDomain;
      const refusal = selected.possibleEnums.length === 0 ? undefined : refusedUse(node, selected);
      if (refusal !== undefined) {
        rejectedRoot = refusal.root;
        issues.push(Object.freeze({ code: "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", category: "error",
          source: "tsonic", sourceNode: refusal.root,
          message: refusal.stringProjection
            ? `Enum value '${checker.getSymbolName(selected.possibleEnums[0])}' is converted to a string; enum-to-string conversion is not supported yet.`
            : `Enum value '${checker.getSymbolName(selected.possibleEnums[0])}' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.` }));
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

    function libraryDeclaration(declaration: Node | undefined): declaration is Node {
      return declaration !== undefined && (checker.isDefaultLibraryDeclaration(declaration) ||
        isTsonicSourceProfileDeclarationPath(ast.getFileName(ast.getSourceFile(declaration)), "js"));
    }

    function isValueUse(expression: Node): boolean {
      const parent = ast.parent(expression);
      return parent !== undefined && (ast.name(parent) !== expression || ast.is.IsShorthandPropertyAssignment(parent));
    }

    function admitsDestination(destination: Type | undefined, value: EnumValueDomain): boolean {
      if (destination === undefined) return false;
      const selected = enumDomain(destination);
      return value.possibleEnums.every(symbol => selected.possibleEnums.includes(symbol));
    }

    function refusedUse(expression: Node, value: EnumValueDomain): { readonly root: Node; readonly stringProjection: boolean } | undefined {
      const parent = ast.parent(expression)!;
      const operator = ast.operatorKindName(parent);
      const conditional = ast.is.IsConditionalExpression(parent) ? ast.as.AsConditionalExpression(parent) : undefined;
      if (ast.is.IsParenthesizedExpression(parent) || ast.is.IsNonNullExpression(parent) ||
        ast.is.IsSatisfiesExpression(parent) || conditional !== undefined &&
          (conditional.WhenTrue === expression || conditional.WhenFalse === expression) ||
        ast.is.IsBinaryExpression(parent) && (logicalOperators.has(operator!) || operator === "KindCommaToken")) return undefined;
      if (ast.is.IsPrefixUnaryExpression(parent) && operator === "KindTildeToken" && value.certainEnum !== undefined) return undefined;
      if (ast.is.IsBinaryExpression(parent)) {
        const binary = ast.as.AsBinaryExpression(parent)!;
        if (equalityOperators.has(operator!) || bitwiseOperators.has(operator!)) {
          if (binary.Left !== undefined && binary.Right !== undefined && identicalEnum(enumValue(binary.Left), enumValue(binary.Right))) return undefined;
        }
        if (operator === "KindEqualsToken" && (binary.Left === expression || admitsDestination(checkedType(binary.Left!), value))) return undefined;
      }
      if (ast.is.IsSwitchStatement(parent)) {
        const block = ast.as.AsSwitchStatement(parent)?.CaseBlock;
        const clauses = block === undefined ? [] : ast.as.AsCaseBlock(block)?.Clauses?.Nodes ?? [];
        if (value.certainEnum !== undefined && clauses.every(clause => clause !== undefined &&
          (!ast.is.IsCaseClause(clause) || identicalEnum(value, enumValue(ast.as.AsCaseOrDefaultClause(clause)!.Expression!))))) return undefined;
      }
      if (ast.is.IsCaseClause(parent)) {
        const block = ast.parent(parent);
        const statement = block === undefined ? undefined : ast.parent(block);
        const subject = statement !== undefined && ast.is.IsSwitchStatement(statement) ? ast.as.AsSwitchStatement(statement)?.Expression : undefined;
        if (subject !== undefined && identicalEnum(enumValue(subject), value)) return undefined;
      }
      if (ast.is.IsElementAccessExpression(parent)) {
        const access = checker.getResolvedElementAccessInfo(parent);
        if (access !== undefined && access.argument.expression === expression) {
          if (access.selectedElementIndex !== undefined) return undefined;
          const selection = types.selectIndexedAccess(access.receiver.type, access.argument.type);
          if (selection?.kind === "resolved" && selection.members.length === 1 && selection.members[0]?.kind === "property") return undefined;
          return { root: parent, stringProjection: selection?.kind === "resolved" && selection.members.some(member =>
            member.kind === "index" && member.index.keyType !== undefined && types.isStringLike(member.index.keyType)) };
        }
      }
      if (ast.is.IsVariableDeclaration(parent) && ast.as.AsVariableDeclaration(parent)?.Initializer === expression &&
        ast.typeNode(parent) === undefined && ast.is.IsIdentifier(ast.name(parent)) &&
        !navigation.declarationUseSummary(parent).bindingWritten) return undefined;
      const destination = destinationType(expression, parent);
      if (admitsDestination(destination, value)) return undefined;
      const callParent = ast.parent(parent);
      const root = (ast.is.IsPropertyAccessExpression(parent) || ast.is.IsElementAccessExpression(parent)) &&
        callParent !== undefined && ast.is.IsCallExpression(callParent) && ast.as.AsCallExpression(callParent)?.Expression === parent
        ? callParent : ast.is.IsTemplateSpan(parent) && callParent !== undefined ? callParent : parent;
      return { root, stringProjection: isStringProjection(expression, parent) };
    }

    function isStringProjection(expression: Node, parent: Node): boolean {
      if (ast.is.IsTemplateSpan(parent)) return true;
      if (ast.is.IsBinaryExpression(parent) && (ast.operatorKindName(parent) === "KindPlusToken" || ast.operatorKindName(parent) === "KindPlusEqualsToken")) {
        const binary = ast.as.AsBinaryExpression(parent)!;
        return types.isStringLike(checkedType(binary.Left!)) || types.isStringLike(checkedType(binary.Right!));
      }
      if (ast.is.IsCallExpression(parent)) {
        const call = checker.getResolvedCallInfo(parent);
        const declaration = checker.getSignatureDeclaration(call?.selectedSignature);
        return declaration !== undefined && stringCalls.includes(declaration);
      }
      const access = ast.is.IsPropertyAccessExpression(parent) ? checker.getResolvedPropertyAccessInfo(parent)
        : ast.is.IsElementAccessExpression(parent) ? checker.getResolvedElementAccessInfo(parent) : undefined;
      return access !== undefined && access.receiver.expression === expression && libraryDeclaration(access.selectedDeclaration) &&
        checker.getCallSignaturesOfType(checkedType(parent)).some(signature => types.isStringLike(checker.getReturnTypeOfSignature(signature)));
    }

    function destinationType(expression: Node, parent: Node): Type | undefined {
      const contextual = checker.getContextualType(expression, ContextFlagsSkipBindingPatterns);
      if (contextual !== undefined) return contextual;
      if (ast.is.IsVariableDeclaration(parent) || ast.is.IsPropertyDeclaration(parent) ||
        ast.is.IsParameterDeclaration(parent) || ast.is.IsBindingElement(parent)) return checkedType(parent);
      if (ast.is.IsPropertyAssignment(parent) || ast.is.IsShorthandPropertyAssignment(parent)) {
        return checker.getResolvedObjectLiteralElementInfo(parent)?.sourceSelectedType;
      }
      if (ast.is.IsArrayLiteralExpression(parent)) {
        const container = checkedType(parent);
        if (container === undefined) return undefined;
        if (types.isTuple(container)) {
          const elements = ast.elements(parent);
          const actual = types.getTupleElementTypes(container);
          const index = elements.indexOf(expression);
          return index >= 0 && elements.length === actual.length &&
            elements.every(element => element !== undefined && !ast.is.IsSpreadElement(element)) ? actual[index] : undefined;
        }
        return types.isArrayLike(container) ? types.getTypeArguments(container)[0] : undefined;
      }
      if (ast.is.IsReturnStatement(parent) || ast.is.IsArrowFunction(parent)) {
        let callable: Node | undefined = parent;
        while (callable !== undefined && !isSourceCallableBodyBoundary(ast, callable)) callable = ast.parent(callable);
        return callable === undefined ? undefined : types.getDeclarationSignatureInfo(callable)?.returnType;
      }
      if (ast.is.IsAsExpression(parent) || ast.is.IsTypeAssertion(parent)) return checkedType(parent);
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
          : ast.is.IsAsExpression(current.node) ? ast.as.AsAsExpression(current.node)?.Expression
          : ast.is.IsTypeAssertion(current.node) ? ast.as.AsTypeAssertion(current.node)?.Expression
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

  }
  return Object.freeze(issues);
}
