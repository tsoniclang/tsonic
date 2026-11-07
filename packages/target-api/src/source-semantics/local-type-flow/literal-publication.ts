import type { Node } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer, ObjectLiteralProperty_Value, sourceTransparentExpressionOperand } from "../../source-navigation/ast.js";
import { freezeSourceTypeDescriptor, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorUnion } from "./terms.js";
import { sourceTypeFlowAssignmentPattern } from "./value-syntax.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { sourceTypeDescriptorMemberOrigin, sourceTypeDescriptorMemberOriginsEqual } from "./member-origins.js";
import type { SourceTypeComponentEvidence } from "../types.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import { sourceIntegerConstantIsExactlyRepresentableAsBinaryFloat, sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat } from "../literal-token.js";
import type { SourceTypeFlowDeclaredSlot } from "./declared-slots.js";
import { sourceTypeFlowBroadSlotKind } from "./uses.js";
import type {
  SourceEffectiveTypeOutcome, SourceLiteralMemberCorrespondence, SourceMethodValueUse, SourceSlotAdmission, SourceTypeDescriptor,
  SourceTypeDescriptorMember, SourceTypeFlowAnalysisContext, SourceTypeFlowRefusal,
} from "./types.js";

export interface SourceNumberOrigin {
  readonly origin: Node;
  readonly literal?: SourceLiteralValue;
}

export function createSourceSlotAdmissions(context: SourceTypeFlowAnalysisContext,
  uses: readonly { readonly site: Node; readonly association?: { readonly occurrence: Node; readonly component?: SourceTypeComponentEvidence } }[],
  outcomes: Map<Node, SourceEffectiveTypeOutcome>,
  declaredSlot: (use: Node) => SourceTypeFlowDeclaredSlot | undefined,
  numberOrigin: (value: Node) => SourceNumberOrigin | undefined,
  normalize: (type: SourceTypeDescriptor) => SourceTypeDescriptor,
): { readonly admissions: ReadonlyMap<Node, SourceSlotAdmission>; readonly refusals: readonly SourceTypeFlowRefusal[] } {
  const admissions = new Map<Node, SourceSlotAdmission>();
  const refusals: SourceTypeFlowRefusal[] = [];
  for (const entry of uses) {
    const use = entry.association?.occurrence;
    if (use === undefined || admissions.has(use)) continue;
    const selected = declaredSlot(use);
    const component = selected?.component ?? entry.association?.component;
    const described = selected?.type ?? (component === undefined ? undefined : context.describe(use, component));
    const broad = described === undefined ? undefined : sourceTypeFlowBroadSlotKind(described);
    if (described === undefined || broad === undefined) continue;
    const destination = normalize(described);
    const slot = component?.declaration ?? component?.authoredTypeNode ?? entry.site;
    const outcome = outcomes.get(use);
    if (outcome === undefined) continue;
    if (outcome.kind === "refused") {
      admissions.set(use, Object.freeze({ kind: "refused", use, slot, refusal: outcome }));
      continue;
    }
    const value = outcome.construction ?? outcome.type;
    const erasesNumber = broad === "unknown" || broad === "object";
    const origin = erasesNumber ? numberOrigin(use) : undefined;
    let conversion: Extract<SourceSlotAdmission, { readonly kind: "admitted" }>["conversion"] = Object.freeze({ kind: "identity" });
    if (origin !== undefined && value.kind === "primitive" && value.primitive === "int64") {
      const numeric = origin.literal?.numeric;
      const integer = origin.literal?.integerConstant ?? origin.literal?.integer;
      const exact = numeric?.kind === "authored"
        ? sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat(numeric.token, "float64")
        : integer !== undefined && sourceIntegerConstantIsExactlyRepresentableAsBinaryFloat(integer, "float64");
      if (!exact) {
        const refusal = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_NUMBER_ERASURE_INEXACT", use, origin.origin);
        refusals.push(refusal);
        outcomes.set(use, refusal);
        admissions.set(use, Object.freeze({ kind: "refused", use, slot, refusal }));
        continue;
      }
      conversion = Object.freeze({ kind: "exact-number-erasure", origin: origin.origin,
        result: normalize({ kind: "primitive", primitive: "float64" }) });
    }
    admissions.set(use, Object.freeze({ kind: "admitted", use, slot, value, destination,
      permission: sourceTypeDescriptorsEqual(value, destination) ? "identity" : "widening", conversion }));
  }
  return Object.freeze({ admissions, refusals: Object.freeze(refusals) });
}

export function createSourceMethodValueUses(context: SourceTypeFlowAnalysisContext, nodes: readonly Node[],
  outcomes: ReadonlyMap<Node, SourceEffectiveTypeOutcome>): ReadonlyMap<Node, SourceMethodValueUse> {
  const { ast, semantics, navigation } = context.source;
  const result = new Map<Node, SourceMethodValueUse>();
  for (const occurrence of nodes) {
    const outcome = outcomes.get(occurrence);
    if (outcome === undefined || outcome.kind === "refused" || outcome.type.kind !== "callable" ||
      outcome.type.calls.length !== 1 || outcome.type.constructs.length !== 0) continue;
    const declaration = outcome.type.calls[0]!.declaration;
    if (declaration === undefined || !(ast.is.IsMethodDeclaration(declaration) ||
      ast.is.IsMethodSignatureDeclaration(declaration))) continue;
    let read = occurrence;
    let alias: SourceMethodValueUse["alias"];
    if (!(ast.is.IsPropertyAccessExpression(read) || ast.is.IsElementAccessExpression(read))) {
      const principal = ast.is.IsVariableDeclaration(occurrence) ? occurrence : ast.is.IsIdentifier(occurrence)
        ? navigation.sourceReferenceFor(occurrence)?.declaration : undefined;
      if (principal === undefined || !ast.is.IsVariableDeclaration(principal) || ast.typeNode(principal) !== undefined ||
        navigation.declarationUseSummary(principal).bindingWritten) continue;
      const initializer = Node_Initializer(ast, principal);
      if (initializer === undefined || !(ast.is.IsPropertyAccessExpression(initializer) ||
        ast.is.IsElementAccessExpression(initializer))) continue;
      const selected = outcomes.get(principal);
      const initial = outcomes.get(initializer);
      if (selected === undefined || selected.kind === "refused" || selected.provenance.occurrence !== principal ||
        initial === undefined || initial.kind === "refused" || selected.type.kind !== "callable" ||
        initial.type.kind !== "callable" || selected.type.calls.length !== 1 || initial.type.calls.length !== 1 ||
        selected.type.calls[0]!.declaration !== declaration || initial.type.calls[0]!.declaration !== declaration ||
        !sourceTypeDescriptorsEqual(outcome.type, selected.type) || !sourceTypeDescriptorsEqual(outcome.type, initial.type)) continue;
      read = initializer;
      alias = Object.freeze({ principal, initializer, provenance: selected.provenance });
    }
    const queries = semantics.forNode(read);
    const access = ast.is.IsPropertyAccessExpression(read) ? queries.operations.propertyAccess(read)
      : queries.operations.elementAccess(read);
    const selected = access === undefined ? undefined : "selectedReadDeclaration" in access
      ? access.selectedReadDeclaration ?? access.selectedDeclaration : access.selectedDeclaration;
    if (selected !== declaration || access === undefined) continue;
    let input = read;
    let parent = ast.parent(input);
    while (parent !== undefined && sourceTransparentExpressionOperand(ast, parent) === input) {
      input = parent;
      parent = ast.parent(parent);
    }
    if (parent !== undefined && (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) &&
      Node_Expression(ast, parent) === input) continue;
    const receiver = access.receiver.expression;
    if (receiver === undefined) continue;
    result.set(occurrence, Object.freeze({ occurrence, read, receiver, declaration, type: outcome.type,
      provenance: outcome.provenance, alias }));
  }
  return result;
}

export function sourceLiteralMemberCorrespondence(context: SourceTypeFlowAnalysisContext, node: Node,
  type: SourceTypeDescriptor, component?: SourceTypeComponentEvidence): readonly SourceLiteralMemberCorrespondence[] | undefined {
  const { ast, semantics } = context.source;
  if (!ast.is.IsObjectLiteralExpression(node)) return undefined;
  const selectedType = sourceTypeDescriptorStructure(type);
  if (selectedType.kind !== "shape") return undefined;
  const result: SourceLiteralMemberCorrespondence[] = [];
  const queries = semantics.forNode(node);
  const sourceType = queries.types.expressionType(node);
  if (sourceType === undefined) throw new Error("A Source literal correspondence requires its actual checked construction type.");
  for (const property of ast.properties(node)) {
    if (property === undefined || ast.is.IsSpreadAssignment(property)) continue;
    // When the published descriptor is the literal's own shape, the authored member is its own destination.
    // Its origin is that property, so no separately selected destination type takes part (it is not the published type).
    const own = selectedType.members.filter(member => member.origin.kind === "declared" && member.origin.declaration === property);
    if (own.length === 1) {
      result.push(Object.freeze({ property, origin: own[0]!.origin }));
      continue;
    }
    const element = queries.operations.objectLiteralElement(property);
    const destination = component === undefined
      ? element?.objectLiteral === node && element.element === property ? element.contextualType : undefined : component.selectedType;
    const presentDestination = destination === undefined ? undefined : queries.types.nonNullableType(destination);
    if (presentDestination === undefined) continue;
    const correspondence = queries.types.structuralMembers(sourceType, presentDestination, "correspondence");
    if (correspondence.kind !== "available") continue;
    const pairs = correspondence.members.filter(pair => pair.kind === "present" &&
      (pair.source.declarations.includes(property) || element?.sourceElementSymbol !== undefined &&
        pair.source.property.symbol === element.sourceElementSymbol));
    if (pairs.length === 0) continue;
    if (pairs.length !== 1) throw new Error("An authored Source member requires exactly one checked destination pair.");
    const member = pairs[0]!.destination;
    const selected = sourceTypeDescriptorMemberOrigin(context.source, queries, member.property, member.receiverType);
    if (selected?.kind !== "resolved") throw new Error("A published Source destination requires its complete canonical member origin.");
    const matches = selectedType.members.filter(member => sourceTypeDescriptorMemberOriginsEqual(member.origin, selected.origin));
    if (matches.length !== 1) throw new Error("A checked Source correspondence requires exactly one descriptor member with the same origin.");
    result.push(Object.freeze({ property, origin: matches[0]!.origin }));
  }
  return Object.freeze(result);
}

export function publishSourceLiteralMetadata(
  context: SourceTypeFlowAnalysisContext,
  nodes: readonly Node[],
  outcomes: WeakMap<Node, SourceEffectiveTypeOutcome>,
  callableReturn: (declaration: Node) => SourceEffectiveTypeOutcome | undefined,
  retainedFill: (node: Node) => SourceTypeComponentEvidence | undefined,
  descriptorRefusal: (node: Node) => SourceTypeFlowRefusal | undefined,
): void {
  const { ast, semantics } = context.source;
  const complete = new Set<Node>();

  function published(node: Node): SourceEffectiveTypeOutcome {
    const selected = outcomes.get(node);
    if (selected === undefined) throw new Error(`Source literal metadata requires a published ${ast.kindName(node)} child.`);
    return publish(node, selected);
  }

  function array(node: Node): SourceTypeDescriptor | SourceTypeFlowRefusal {
    const types: SourceTypeDescriptor[] = [];
    for (const element of ast.elements(node)) {
      if (element === undefined) throw new Error("A Source array construction requires its actual element nodes.");
      if (ast.is.IsOmittedExpression(element)) {
        const sourceFile = ast.getSourceFile(element);
        if (sourceFile === undefined) throw new Error("A Source array omission requires its original source file.");
        const type: SourceTypeDescriptor = Object.freeze({ kind: "intrinsic", intrinsic: "absence" });
        outcomes.set(element, Object.freeze({ kind: "resolved", type,
          provenance: Object.freeze({ group: node, occurrence: element, sourceFile }) }));
        const outcome = published(element);
        if (outcome.kind === "refused") return outcome;
        types.push(outcome.type);
        continue;
      }
      const spread = ast.is.IsSpreadElement(element);
      const value = spread ? Node_Expression(ast, element) : element;
      if (value === undefined) throw new Error("A Source spread element requires its original operand.");
      const outcome = published(value);
      if (outcome.kind === "refused") return outcome;
      if (!spread) { types.push(outcome.type); continue; }
      const iteration = semantics.forNode(element).operations.iteration(element);
      if (iteration?.subject.kind !== "spread" || iteration.subject.node !== element) {
        throw new Error("A Source spread construction requires the checker's iteration result for that exact spread element.");
      }
      const projected = context.describe(node, { selectedType: iteration.sourceElementType });
      if (projected === undefined) {
        const refusal = descriptorRefusal(node);
        if (refusal !== undefined) return refusal;
        throw new Error("A checked Source spread element requires its published element descriptor.");
      }
      types.push(projected);
    }
    return { kind: "array", readonly: false,
      element: sourceTypeDescriptorUnion(context.unions, types) ?? { kind: "intrinsic", intrinsic: "never" } };
  }

  function object(node: Node): SourceTypeDescriptor | SourceTypeFlowRefusal {
    const members = new Map<string, SourceTypeDescriptorMember>();
    const queries = semantics.forNode(node);
    for (const property of ast.properties(node)) {
      if (property === undefined) throw new Error("A Source object construction requires its actual property nodes.");
      if (ast.is.IsSpreadAssignment(property)) {
        const operand = ast.as.AsSpreadAssignment(property)?.Expression;
        if (operand === undefined) throw new Error("A Source spread property requires its original operand.");
        const outcome = published(operand);
        if (outcome.kind === "refused") return outcome;
        const selected = sourceTypeDescriptorStructure(outcome.construction ?? outcome.type);
        const selectedMembers = selected.kind === "shape" ? selected.members : undefined;
        if (selectedMembers !== undefined) for (const member of selectedMembers) members.set(member.name, member);
        continue;
      }
      const nameNode = ast.name(property);
      const name = nameNode === undefined ? undefined : queries.propertyNames.get(nameNode);
      if (name?.kind !== "resolved") continue;
      const value = ObjectLiteralProperty_Value(ast, property);
      const parameter = ast.is.IsSetAccessorDeclaration(property) ? ast.parameters(property)[0] : undefined;
      const outcome = value !== undefined ? published(value) : ast.is.IsGetAccessorDeclaration(property)
        ? callableReturn(property) : parameter !== undefined ? published(parameter) : published(property);
      if (outcome === undefined) throw new Error("A Source accessor construction requires its published return descriptor.");
      if (outcome.kind === "refused") return outcome;
      const evidence = queries.operations.objectLiteralElement(property);
      const selected = evidence?.sourceElementSymbol === undefined ? undefined
        : queries.types.propertyInfos(evidence.objectLiteralType).find(member => member.symbol === evidence.sourceElementSymbol);
      if (!ast.is.IsSetAccessorDeclaration(property) || !members.has(name.name)) members.set(name.name, {
        name: name.name, type: outcome.construction ?? outcome.type, origin: { kind: "declared", declaration: property }, optional: false,
        ...(selected === undefined ? {} : { readonly: selected.readonly }),
      });
    }
    return { kind: "shape", members: [...members.values()], indexes: [], calls: [], constructs: [] };
  }

  function publish(node: Node, outcome: SourceEffectiveTypeOutcome): SourceEffectiveTypeOutcome {
    if (outcome.kind === "refused" || complete.has(node)) return outcome;
    complete.add(node);
    if (!(ast.is.IsObjectLiteralExpression(node) || ast.is.IsArrayLiteralExpression(node)) ||
      sourceTypeFlowAssignmentPattern(ast, node)) return outcome;
    const type = outcome.type;
    // Maintainer Q4 (C-2323, 28j'): an empty object literal whose slot is `unknown` has no member inventory to
    // construct and no target type; it is refused. Non-empty literals under object/unknown still construct (C-2246).
    if (ast.is.IsObjectLiteralExpression(node) && type.kind === "intrinsic" && type.intrinsic === "unknown" &&
      ast.properties(node).length === 0) {
      const refusal = createSourceTypeFlowRefusal("TSONIC_UNTYPED_OBJECT_LITERAL", node);
      outcomes.set(node, refusal);
      return refusal;
    }
    const broad = type.kind === "intrinsic" && (type.intrinsic === "object" || type.intrinsic === "unknown");
    const constructed = broad || ast.is.IsObjectLiteralExpression(node) && type.kind === "shape";
    const produced = !constructed ? undefined : ast.is.IsObjectLiteralExpression(node) ? object(node) : array(node);
    if (produced?.kind === "refused") { outcomes.set(node, produced); return produced; }
    const construction = produced === undefined || sourceTypeDescriptorsEqual(produced, type) ? undefined : produced;
    const memberCorrespondence = sourceLiteralMemberCorrespondence(context, node, type, retainedFill(node));
    const selected = Object.freeze({ ...outcome,
      ...(construction === undefined ? {} : { construction: freezeSourceTypeDescriptor(construction) }),
      ...(memberCorrespondence === undefined ? {} : { memberCorrespondence }),
    });
    outcomes.set(node, selected);
    return selected;
  }

  for (const node of nodes) {
    const selected = outcomes.get(node);
    if (selected !== undefined) publish(node, selected);
  }
}
