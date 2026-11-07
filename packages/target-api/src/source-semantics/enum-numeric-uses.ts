import { AsCaseBlock } from "../source-navigation/checked-casts.js";
import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import { isSourceCallableBodyBoundary } from "../source-navigation/callable-boundaries.js";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceValueFacts } from "../public/source/facts.js";
import type { SourceTypeDescriptor } from "./local-type-flow/types.js";
import { sourceTypeDescriptorStructure } from "./local-type-flow/terms.js";
import type { SourceEnumAdmissionIssue, SourceEnumConstantIndex } from "./enum-model.js";

// Enum use admission over the Host value model (R3: every type answer is a Host descriptor; no checked type, no
// checker contextual type). An enum value may be compared, combined bitwise, switched on and stored only within its
// own enum; any other use of its number or string value is refused (TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED).

const equalityOperators = new Set(["KindEqualsEqualsToken", "KindExclamationEqualsToken",
  "KindEqualsEqualsEqualsToken", "KindExclamationEqualsEqualsToken"]);
const bitwiseOperators = new Set(["KindAmpersandToken", "KindBarToken", "KindCaretToken",
  "KindAmpersandEqualsToken", "KindBarEqualsToken", "KindCaretEqualsToken"]);
const logicalOperators = new Set(["KindAmpersandAmpersandToken", "KindBarBarToken", "KindQuestionQuestionToken"]);
const valueKinds = new Set(["KindIdentifier", "KindPropertyAccessExpression", "KindElementAccessExpression",
  "KindCallExpression", "KindNewExpression", "KindTaggedTemplateExpression", "KindAwaitExpression",
  "KindConditionalExpression", "KindBinaryExpression", "KindParenthesizedExpression", "KindAsExpression",
  "KindTypeAssertionExpression", "KindSatisfiesExpression", "KindNonNullExpression", "KindPrefixUnaryExpression"]);

/** The enums a value may belong to (enum declaration Nodes), and the one enum it certainly belongs to. */
type EnumValueDomain = {
  readonly possibleEnums: readonly Node[];
  readonly certainEnum?: Node;
};

type EnumValueStep = "initializer" | "alias" | "typed";
type EnumValueInput = { readonly node: Node; readonly step: EnumValueStep };

const emptyDomain: EnumValueDomain = Object.freeze({ possibleEnums: Object.freeze([]) });

export interface SourceEnumNumericUseContext {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly navigation: Pick<SourceProgramNavigation, "sourceReferenceFor" | "declarationUseSummary" |
    "expressionResultDisposition" | "memberAccess">;
  readonly values: Pick<SourceValueFacts, "type" | "contextual" | "slot" | "callableReturn" | "elementAccess" | "has">;
}

export function analyzeSourceEnumNumericUses(
  context: SourceEnumNumericUseContext,
  enumConstants: Pick<SourceEnumConstantIndex, "integerWidth">,
): readonly SourceEnumAdmissionIssue[] {
  const { ast, navigation, values } = context;
  const issues: SourceEnumAdmissionIssue[] = [];
  const domains = new WeakMap<SourceTypeDescriptor, EnumValueDomain>();
  const enumValues = {
    initializer: new WeakMap<Node, EnumValueDomain>(),
    alias: new WeakMap<Node, EnumValueDomain>(),
    typed: new WeakMap<Node, EnumValueDomain>(),
  };
  for (const file of context.sourceFiles) {
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
        const name = enumName(selected.possibleEnums[0]!);
        issues.push(Object.freeze({ code: "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED", category: "error",
          source: "tsonic", sourceNode: refusal.root,
          message: refusal.stringProjection
            ? `Enum value '${name}' is converted to a string; enum-to-string conversion is not supported yet.`
            : `Enum value '${name}' is used as a number; enum-numeric operations are not supported yet. Use equality or bitwise operations within the same enum instead.` }));
        continue;
      }
      const children: Node[] = [];
      ast.forEachChild(node, child => { if (child !== undefined) children.push(child); });
      for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
    }
  }
  return Object.freeze(issues);

  function enumName(declaration: Node): string {
    const name = ast.name(declaration);
    return name === undefined ? "<anonymous>" : ast.text(name);
  }

  /** The Host descriptor of a value node; undefined when the node is not a value node or the Host refused it. */
  function valueType(node: Node): SourceTypeDescriptor | undefined {
    if (!values.has(node)) return undefined;
    const outcome = values.type(node);
    return outcome.kind === "refused" ? undefined : outcome.type;
  }

  /** The arms of a descriptor: union members and optional values flattened; absence and never arms dropped. */
  function presentArms(type: SourceTypeDescriptor): readonly SourceTypeDescriptor[] {
    if (type.kind === "declared" && armEnum(type) !== undefined) return [type];
    const structure = sourceTypeDescriptorStructure(type);
    if (structure.kind === "union") return structure.types.flatMap(presentArms);
    if (structure.kind === "optional") return presentArms(structure.value);
    return structure.kind === "intrinsic" && (structure.intrinsic === "absence" || structure.intrinsic === "never") ? [] : [structure];
  }

  /** The enum declaration a descriptor arm names (an enum type or one of its member literal types), if any. */
  function armEnum(arm: SourceTypeDescriptor): Node | undefined {
    if (arm.kind !== "declared") return undefined;
    const owner = ast.is.IsEnumDeclaration(arm.declaration) ? arm.declaration
      : ast.is.IsEnumMember(arm.declaration) ? ast.parent(arm.declaration) : undefined;
    if (owner === undefined || !ast.is.IsEnumDeclaration(owner)) return undefined;
    const width = enumConstants.integerWidth(owner);
    return width?.kind === "rejected" && width.admissionIssue !== undefined ? undefined : owner;
  }

  function enumDomain(type: SourceTypeDescriptor | undefined): EnumValueDomain {
    if (type === undefined) return emptyDomain;
    const existing = domains.get(type);
    if (existing !== undefined) return existing;
    const enums = presentArms(type).map(armEnum);
    const possibleEnums = Object.freeze([...new Set(enums.filter((entry): entry is Node => entry !== undefined))]);
    const selected = possibleEnums.length === 0 ? emptyDomain : Object.freeze({ possibleEnums,
      ...(possibleEnums.length === 1 && enums.every(entry => entry === possibleEnums[0]) ? { certainEnum: possibleEnums[0]! } : {}) });
    domains.set(type, selected);
    return selected;
  }

  function joinDomains(selected: readonly EnumValueDomain[]): EnumValueDomain {
    const possibleEnums = Object.freeze([...new Set(selected.flatMap(domain => domain.possibleEnums))]);
    if (possibleEnums.length === 0) return emptyDomain;
    const certain = selected[0]?.certainEnum;
    const agrees = certain !== undefined && selected.every(domain => domain.certainEnum === certain);
    return Object.freeze({ possibleEnums, ...(agrees ? { certainEnum: certain } : {}) });
  }

  function identicalEnum(left: EnumValueDomain, right: EnumValueDomain): boolean {
    return left.certainEnum !== undefined && left.certainEnum === right.certainEnum;
  }

  /** A library declaration: declared in a declaration file (the default library or a source profile). */
  function libraryDeclaration(declaration: Node | undefined): declaration is Node {
    const file = declaration === undefined ? undefined : ast.getSourceFile(declaration);
    return file !== undefined && ast.isDeclarationFile(file);
  }

  function isValueUse(expression: Node): boolean {
    const parent = ast.parent(expression);
    return parent !== undefined && (ast.name(parent) !== expression || ast.is.IsShorthandPropertyAssignment(parent));
  }

  function admitsDestination(destination: SourceTypeDescriptor | undefined, value: EnumValueDomain): boolean {
    if (destination === undefined) return false;
    const selected = enumDomain(destination);
    return value.possibleEnums.every(declaration => selected.possibleEnums.includes(declaration));
  }

  function refusedUse(expression: Node, value: EnumValueDomain): { readonly root: Node; readonly stringProjection: boolean } | undefined {
    const parent = ast.parent(expression)!;
    const resultUse = navigation.expressionResultDisposition(expression);
    if (resultUse.kind === "discarded" && resultUse.use === parent) return undefined;
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
        if (equalityOperators.has(operator!) && (absenceType(binary.Left!) || absenceType(binary.Right!))) return undefined;
      }
      if (operator === "KindEqualsToken" && (binary.Left === expression || admitsDestination(valueType(binary.Left!), value))) return undefined;
    }
    if (ast.is.IsSwitchStatement(parent)) {
      const block = ast.as.AsSwitchStatement(parent)?.CaseBlock;
      const clauses = block === undefined ? [] : AsCaseBlock(ast, block)?.Clauses?.Nodes ?? [];
      if (value.certainEnum !== undefined && clauses.every(clause => clause !== undefined &&
        (!ast.is.IsCaseClause(clause) || identicalEnum(value, enumValue(ast.as.AsCaseOrDefaultClause(clause)!.Expression!))))) return undefined;
    }
    if (ast.is.IsCaseClause(parent)) {
      const block = ast.parent(parent);
      const statement = block === undefined ? undefined : ast.parent(block);
      const subject = statement !== undefined && ast.is.IsSwitchStatement(statement) ? ast.as.AsSwitchStatement(statement)?.Expression : undefined;
      if (subject !== undefined && identicalEnum(enumValue(subject), value)) return undefined;
    }
    if (ast.is.IsElementAccessExpression(parent) && ast.as.AsElementAccessExpression(parent)?.ArgumentExpression === expression) {
      const access = values.elementAccess(parent);
      if (access.selected.kind === "tuple" || access.selected.kind === "member") return undefined;
      return { root: parent, stringProjection: access.selected.kind === "index-signature" &&
        stringIndexSignature(access.selected.declaration) };
    }
    if (ast.is.IsVariableDeclaration(parent) && ast.as.AsVariableDeclaration(parent)?.Initializer === expression &&
      ast.typeNode(parent) === undefined && ast.is.IsIdentifier(ast.name(parent)) &&
      !navigation.declarationUseSummary(parent).bindingWritten) return undefined;
    if (admitsDestination(destinationType(expression, parent), value)) return undefined;
    const callParent = ast.parent(parent);
    const root = (ast.is.IsPropertyAccessExpression(parent) || ast.is.IsElementAccessExpression(parent)) &&
      callParent !== undefined && ast.is.IsCallExpression(callParent) && ast.as.AsCallExpression(callParent)?.Expression === parent
      ? callParent : ast.is.IsTemplateSpan(parent) && callParent !== undefined ? callParent : parent;
    return { root, stringProjection: isStringProjection(expression, parent) };
  }

  function stringIndexSignature(declaration: Node): boolean {
    let key: Node | undefined;
    ast.forEachChild(declaration, child => {
      if (key === undefined && child !== undefined && ast.is.IsParameterDeclaration(child)) key = ast.typeNode(child);
    });
    return key !== undefined && ast.kindName(key) === "KindStringKeyword";
  }

  /** Every present arm of the operand's Host descriptor is absence (null/undefined). */
  function absenceType(node: Node): boolean {
    const type = valueType(node);
    if (type === undefined) return false;
    const structure = sourceTypeDescriptorStructure(type);
    if (structure.kind === "intrinsic") return structure.intrinsic === "absence";
    if (structure.kind !== "union") return false;
    return structure.types.length !== 0 && structure.types.every(part => {
      const arm = sourceTypeDescriptorStructure(part);
      return arm.kind === "intrinsic" && arm.intrinsic === "absence";
    });
  }

  function isStringType(type: SourceTypeDescriptor | undefined): boolean {
    return type !== undefined && sourceTypeDescriptorStructure(type).kind === "string";
  }

  function isStringProjection(expression: Node, parent: Node): boolean {
    if (ast.is.IsTemplateSpan(parent)) return true;
    if (ast.is.IsBinaryExpression(parent) && (ast.operatorKindName(parent) === "KindPlusToken" || ast.operatorKindName(parent) === "KindPlusEqualsToken")) {
      const binary = ast.as.AsBinaryExpression(parent)!;
      return isStringType(valueType(binary.Left!)) || isStringType(valueType(binary.Right!));
    }
    if (ast.is.IsCallExpression(parent)) {
      // `String(value)`: the callee is the library `String` value.
      const callee = ast.as.AsCallExpression(parent)?.Expression;
      const declaration = callee !== undefined && ast.is.IsIdentifier(callee) && ast.text(callee) === "String"
        ? navigation.sourceReferenceFor(callee)?.declaration : undefined;
      return libraryDeclaration(declaration);
    }
    if (!ast.is.IsPropertyAccessExpression(parent) && !ast.is.IsElementAccessExpression(parent)) return false;
    const access = navigation.memberAccess(parent);
    if (access === undefined || access.receiver !== expression || !libraryDeclaration(access.declaration)) return false;
    const member = valueType(parent);
    const structure = member === undefined ? undefined : sourceTypeDescriptorStructure(member);
    const calls = structure?.kind === "callable" || structure?.kind === "shape" ? structure.calls : [];
    return calls.some(signature => isStringType(signature.result));
  }

  function slotType(node: Node): SourceTypeDescriptor | undefined {
    const outcome = values.slot(node);
    return outcome.kind === "slot" ? outcome.type : undefined;
  }

  function destinationType(expression: Node, parent: Node): SourceTypeDescriptor | undefined {
    if (ast.is.IsAsExpression(parent) || ast.is.IsTypeAssertion(parent)) return valueType(parent);
    const contextual = values.contextual(expression);
    if (contextual !== undefined) return contextual.kind === "refused" ? undefined : contextual.type;
    if (ast.is.IsVariableDeclaration(parent) || ast.is.IsPropertyDeclaration(parent) ||
      ast.is.IsParameterDeclaration(parent) || ast.is.IsBindingElement(parent)) return slotType(parent);
    if (ast.is.IsReturnStatement(parent) || ast.is.IsArrowFunction(parent)) {
      let callable: Node | undefined = parent;
      while (callable !== undefined && !isSourceCallableBodyBoundary(ast, callable)) callable = ast.parent(callable);
      if (callable === undefined) return undefined;
      const outcome = values.callableReturn(callable);
      return outcome.kind === "refused" ? undefined : outcome.type;
    }
    return undefined;
  }

  function enumValue(expression: Node): EnumValueDomain {
    const pendingValues: (EnumValueInput & { readonly children?: readonly EnumValueInput[] })[] = [
      { node: expression, step: "initializer" },
    ];
    const active = { initializer: new Set<Node>(), alias: new Set<Node>(), typed: new Set<Node>() };
    while (pendingValues.length !== 0) {
      const current = pendingValues.pop()!;
      const selectedValues = enumValues[current.step];
      const activeValues = active[current.step];
      if (selectedValues.has(current.node)) continue;
      if (current.children !== undefined) {
        const childDomains = current.children.filter(child => {
          const type = valueType(child.node);
          return type === undefined || presentArms(type).length !== 0;
        }).map(child => enumValues[child.step].get(child.node)!);
        selectedValues.set(current.node, joinDomains(childDomains));
        activeValues.delete(current.node);
        continue;
      }
      if (activeValues.has(current.node)) {
        selectedValues.set(current.node, emptyDomain);
        continue;
      }
      activeValues.add(current.node);
      const type = valueType(current.node);
      const selected = enumDomain(type);
      if (selected.possibleEnums.length !== 0) {
        selectedValues.set(current.node, selected);
        activeValues.delete(current.node);
        continue;
      }
      const operator = ast.operatorKindName(current.node);
      const declaration = ast.is.IsIdentifier(current.node) ? navigation.sourceReferenceFor(current.node)?.declaration : undefined;
      const initializer = current.step !== "typed" && declaration !== undefined && ast.is.IsVariableDeclaration(declaration) &&
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
        selectedValues.set(current.node, emptyDomain);
        activeValues.delete(current.node);
        continue;
      }
      const childStep: EnumValueStep = initializer !== undefined
        ? current.step === "initializer" ? "alias" : "typed" : current.step;
      const inputs = children.map(node => ({ node, step: childStep }));
      pendingValues.push({ ...current, children: inputs });
      for (const child of inputs) pendingValues.push(child);
    }
    return enumValues.initializer.get(expression)!;
  }

  /**
   * A descriptor whose every present arm is a known non-numeric value (so a logical result cannot be an enum value):
   * checker `excludesEnum` was "not number-like, not any/unknown, no type variables".
   */
  function excludesEnum(type: SourceTypeDescriptor): boolean {
    if (enumDomain(type).possibleEnums.length !== 0) return false;
    const arms = presentArms(type);
    return arms.length !== 0 && arms.every(arm => {
      if (arm.kind === "primitive") return arm.primitive === "bool" || arm.primitive === "char";
      if (arm.kind === "intrinsic") return arm.intrinsic !== "any" && arm.intrinsic !== "unknown";
      if (arm.kind === "declared") return !ast.is.IsTypeParameterDeclaration(arm.declaration);
      return true;
    });
  }
}
