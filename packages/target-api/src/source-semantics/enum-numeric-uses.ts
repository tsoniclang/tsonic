import { AsCaseBlock } from "../source-navigation/checked-casts.js";
import { Node_Expression } from "../source-model/ast.js";
import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import { isSourceCallableBodyBoundary } from "../source-model/callable-boundaries.js";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceSlotOutcome, SourceTypeOutcome, SourceValueFacts } from "../public/source/facts.js";
import type { SourceJsApiFacts } from "../public/source/objects.js";
import type { SourceTypeDescriptor } from "./local-type-flow/types.js";
import { sourceTypeDescriptorHasTypeVariables, sourceTypeDescriptorStructure } from "./local-type-flow/terms.js";
import { sourceTypeDescriptorOpenness } from "./local-type-flow/uses.js";
import type { SourceEnumAdmissionIssue, SourceEnumConstantIndex } from "./enum-model.js";
import { sourceTypeDescriptorIsAbsent, sourceTypeDescriptorPresentArms } from "./descriptor-arms.js";

// N3′: the Source (TS) category of a Host primitive. bool is boolean, char is string, and the wide integers
// (int64, uint64, int128, uint128) are TS bigint; every other primitive is a TS number.
const nonNumberPrimitives: ReadonlySet<string> = new Set(["bool", "char", "int64", "uint64", "int128", "uint128"]);

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
    "expressionResultDisposition" | "memberAccess" | "call">;
  readonly values: Pick<SourceValueFacts, "type" | "contextual" | "slot" | "callableReturn" | "elementAccess" | "has">;
  /** The JS profile: a `String(value)` call is the one whose selected signature is the StringConstructor call row. */
  readonly profile: Pick<SourceJsApiFacts, "member">;
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

  /**
   * A Host destination: the descriptor, "refused" when the Host refused the destination value or slot (that refusal is
   * in facts.refusals() and covers the site, R5: the enum use gets no second refusal), or undefined: no destination.
   */
  type Destination = SourceTypeDescriptor | "refused" | undefined;

  function outcomeDestination(outcome: SourceTypeOutcome | SourceSlotOutcome): Destination {
    return outcome.kind === "refused" ? "refused" : outcome.type;
  }

  /** The destination descriptor of a value node (an assignment target or an assertion result). */
  function valueDestination(node: Node): Destination {
    return values.has(node) ? outcomeDestination(values.type(node)) : undefined;
  }

  /** The present arms of a descriptor (the one Host classifier, descriptor-arms.ts), each as its structure. */
  function presentArms(type: SourceTypeDescriptor): readonly SourceTypeDescriptor[] {
    return sourceTypeDescriptorPresentArms(type).map(sourceTypeDescriptorStructure);
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
      if (operator === "KindEqualsToken") {
        if (binary.Left === expression) return undefined;
        const left = valueDestination(binary.Left!);
        if (left === "refused" || admitsDestination(left, value)) return undefined;
      }
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
      // The access record exists only for an access whose result and receiver the Host typed. A Host-refused access is
      // in facts.refusals() and covers the site (R5), so the enum use is not refused a second time.
      const receiver = ast.as.AsElementAccessExpression(parent)?.Expression;
      if (receiver === undefined || valueDestination(parent) === "refused" || valueDestination(receiver) === "refused") return undefined;
      const access = values.elementAccess(parent);
      if (access.selected.kind === "tuple" || access.selected.kind === "member") return undefined;
      return { root: parent, stringProjection: access.selected.kind === "index-signature" &&
        stringIndexSignature(access.receiverType, access.selected.declaration) };
    }
    if (ast.is.IsVariableDeclaration(parent) && ast.as.AsVariableDeclaration(parent)?.Initializer === expression &&
      ast.typeNode(parent) === undefined && ast.is.IsIdentifier(ast.name(parent)) &&
      !navigation.declarationUseSummary(parent).bindingWritten) return undefined;
    const destination = destinationType(expression, parent);
    if (destination === "refused" || admitsDestination(destination, value)) return undefined;
    // A member read on the enum value that the Host refused (a method projection whose value the Host could not type)
    // is in facts.refusals() and covers the site (R5).
    if ((ast.is.IsPropertyAccessExpression(parent) || ast.is.IsElementAccessExpression(parent)) &&
      Node_Expression(ast, parent) === expression && valueDestination(parent) === "refused") return undefined;
    const callParent = ast.parent(parent);
    const root = (ast.is.IsPropertyAccessExpression(parent) || ast.is.IsElementAccessExpression(parent)) &&
      callParent !== undefined && ast.is.IsCallExpression(callParent) && ast.as.AsCallExpression(callParent)?.Expression === parent
      ? callParent : ast.is.IsTemplateSpan(parent) && callParent !== undefined ? callParent : parent;
    return { root, stringProjection: isStringProjection(expression, parent) };
  }

  /**
   * The selected index signature has a string key: the key of the receiver descriptor's index that the Host element
   * selection chose (the same `declaration`). Covers `[k: string]`, `Record<string, T>`, mapped keys and aliased `string`.
   */
  function stringIndexSignature(receiverType: SourceTypeDescriptor, declaration: Node): boolean {
    return presentArms(receiverType).some(arm => {
      const structure = sourceTypeDescriptorStructure(arm);
      return structure.kind === "shape" && structure.indexes.some(index =>
        index.declaration === declaration && sourceTypeDescriptorStructure(index.key).kind === "string");
    });
  }

  /** The operand's Host descriptor is wholly absent (null / undefined / void; the one Host classifier). */
  function absenceType(node: Node): boolean {
    const type = valueType(node);
    return type !== undefined && sourceTypeDescriptorIsAbsent(type);
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
      // `String(value)` (also through an alias such as `const convert = String`): the selected signature is the JS
      // profile's StringConstructor call row (R2 #47; baseline: the library String call signatures).
      const signature = navigation.call(parent)?.signature;
      const member = signature === undefined ? undefined : context.profile.member(signature);
      return member?.owner === "string" && member.name === "call" && member.receiver === "static";
    }
    if (!ast.is.IsPropertyAccessExpression(parent) && !ast.is.IsElementAccessExpression(parent)) return false;
    const access = navigation.memberAccess(parent);
    if (access === undefined || access.receiver !== expression || !libraryDeclaration(access.declaration)) return false;
    const member = valueType(parent);
    const structure = member === undefined ? undefined : sourceTypeDescriptorStructure(member);
    const calls = structure?.kind === "callable" || structure?.kind === "shape" ? structure.calls : [];
    return calls.some(signature => isStringType(signature.result));
  }

  /** The constructed descriptor of an object or array literal (its own type, `construction` when published). */
  function literalDestination(literal: Node): Destination {
    if (!values.has(literal)) return undefined;
    const outcome = values.type(literal);
    return outcome.kind === "refused" ? "refused" : outcome.construction ?? outcome.type;
  }

  /**
   * The Host destination of a value use (baseline enum-numeric-uses.ts:247-274 over checked types): an assertion
   * result; the Host slot the use flows into (`values.contextual`); a declaration slot; an element of an object or array
   * literal that flows into no slot, typed by the containing literal's own Host descriptor (the member whose origin is
   * the element, or the array element / tuple position); the enclosing callable's result.
   */
  function destinationType(expression: Node, parent: Node): Destination {
    if (ast.is.IsAsExpression(parent) || ast.is.IsTypeAssertion(parent)) return valueDestination(parent);
    const contextual = values.contextual(expression);
    if (contextual !== undefined) return outcomeDestination(contextual);
    if (ast.is.IsVariableDeclaration(parent) || ast.is.IsPropertyDeclaration(parent) ||
      ast.is.IsParameterDeclaration(parent) || ast.is.IsBindingElement(parent)) return outcomeDestination(values.slot(parent));
    if (ast.is.IsPropertyAssignment(parent) || ast.is.IsShorthandPropertyAssignment(parent)) {
      const literal = ast.parent(parent);
      const container = literal !== undefined && ast.is.IsObjectLiteralExpression(literal) ? literalDestination(literal) : undefined;
      if (container === undefined || container === "refused") return container;
      const structure = sourceTypeDescriptorStructure(container);
      return structure.kind === "shape" ? structure.members.find(member =>
        member.origin.kind === "declared" && member.origin.declaration === parent)?.type : undefined;
    }
    if (ast.is.IsArrayLiteralExpression(parent)) {
      const container = literalDestination(parent);
      if (container === undefined || container === "refused") return container;
      const structure = sourceTypeDescriptorStructure(container);
      if (structure.kind === "array") return structure.element;
      if (structure.kind !== "tuple") return undefined;
      const elements = ast.elements(parent);
      const index = elements.indexOf(expression);
      return index >= 0 && elements.length === structure.elements.length &&
        elements.every(element => element !== undefined && !ast.is.IsSpreadElement(element)) ? structure.elements[index]?.type : undefined;
    }
    if (ast.is.IsReturnStatement(parent) || ast.is.IsArrowFunction(parent)) {
      let callable: Node | undefined = parent;
      while (callable !== undefined && !isSourceCallableBodyBoundary(ast, callable)) callable = ast.parent(callable);
      return callable === undefined ? undefined : outcomeDestination(values.callableReturn(callable));
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
   * A descriptor whose every present arm is a known non-numeric value (so a logical result cannot be an enum value),
   * as baseline checker `excludesEnum`: no enum arm, no type variables, every arm closed (the one openness classifier,
   * sourceTypeDescriptorOpenness: not any/unknown, not a type parameter) and not a TS number (N3′: the wide integers
   * are TS bigint and exclude an enum value; an absence-only value excludes one too).
   */
  function excludesEnum(type: SourceTypeDescriptor): boolean {
    if (enumDomain(type).possibleEnums.length !== 0 || sourceTypeDescriptorHasTypeVariables(ast, type)) return false;
    return presentArms(type).every(arm => {
      if (sourceTypeDescriptorOpenness(ast, arm) !== "closed") return false;
      const structure = sourceTypeDescriptorStructure(arm);
      return structure.kind !== "primitive" || nonNumberPrimitives.has(structure.primitive);
    });
  }
}
