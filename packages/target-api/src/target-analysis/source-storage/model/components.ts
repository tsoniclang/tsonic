// Storage component types over Host descriptors (I1/I3). A storage subject's type is the Host descriptor of its node
// (facts.values) projected through its components. Members come from facts.objects (per union arm); tuple and array
// elements from the descriptor structure. No checker Type is read.
import { sourceTypeDescriptorIsAbsent, sourceTypeDescriptorPresentArms } from "../../../source-semantics/descriptor-arms.js";
import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceStorageProjection, SourceStorageSubject } from "./subjects.js";
import { sourceTypeDescriptorOpenness } from "../../../source-semantics/local-type-flow/uses.js";
import { sourceStorageIsDataMember, sourceStorageIsMemberProjection, sourceStorageIsMethodMember } from "./subjects.js";
import { ForInOrOfStatement_Initializer, Node_Expression, Node_Initializer, VariableDeclarationList_Declarations, sourceEnclosing, sourceTransparentExpressionOperand } from "../../../source-navigation/index.js";
import { isSourceCallableSignatureDeclaration } from "../../../source-model/callable-boundaries.js";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import { sourceTypeDescriptorHasTypeVariables, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure } from "../../../source-semantics/local-type-flow/terms.js";
import { sourceAnalysisCallableResult, sourceAnalysisIncludesFile, sourceAnalysisIsScalar, sourceAnalysisValueType, type SourceAnalysisProgram } from "../../analysis-program.js";

type Descriptor = SourceTypeDescriptor;
type StorageFacts = Pick<SourceAnalysisProgram, "ast" | "facts">;

/** A scalar storage type: a primitive, string, bigint, symbol or enum value has no storage identity. */
export function sourceStorageIsScalarType(type: Descriptor, ast: AstReader): boolean {
  return sourceAnalysisIsScalar(type, node => ast.is.IsEnumDeclaration(node));
}

/** The value is wholly absent (null / undefined / void). */
export function sourceStorageIsAbsentType(type: Descriptor): boolean {
  return sourceTypeDescriptorIsAbsent(type);
}

/** The value has no arm at all (never). */
export function sourceStorageIsNeverType(type: Descriptor): boolean {
  return sourcePresentStorageArms(type).length === 0 && !sourceTypeDescriptorIsAbsent(type);
}

/** Some present arm is any / unknown (its structure is open). */
export function sourceStorageIsOpenType(ast: Pick<AstReader, "is">, type: Descriptor): boolean {
  return sourcePresentStorageArms(type).some(arm => sourceTypeDescriptorOpenness(ast, arm) === "top");
}

/** The present (non-absent, non-never) arms of a storage type. Empty: never present. */
export function sourcePresentStorageArms(type: Descriptor): readonly Descriptor[] {
  return sourceTypeDescriptorPresentArms(type);
}

/** Two storage types are the same Host type. */
export function sourceStorageTypesEqual(left: Descriptor, right: Descriptor): boolean {
  return sourceTypeDescriptorsEqual(left, right);
}

/** The storage type mentions an unbound type parameter (checker couldContainTypeVariables). */
export function sourceStorageTypeHasTypeVariables(type: Descriptor, ast: AstReader): boolean {
  return sourceTypeDescriptorHasTypeVariables(ast, type);
}

function tupleArm(type: Descriptor): Extract<Descriptor, { readonly kind: "tuple" }> | undefined {
  const structure = sourceTypeDescriptorStructure(type);
  return structure.kind === "tuple" ? structure : undefined;
}

function arrayArm(type: Descriptor): Extract<Descriptor, { readonly kind: "array" }> | undefined {
  const structure = sourceTypeDescriptorStructure(type);
  return structure.kind === "array" ? structure : undefined;
}

function sourceStorageIsTupleType(type: Descriptor): boolean {
  const arms = sourcePresentStorageArms(type);
  return arms.length > 0 && arms.every(arm => tupleArm(arm) !== undefined);
}

/** The tuple elements of every present arm (one list per arm); undefined unless every present arm is a tuple. */
export function sourceStorageTupleElements(type: Descriptor):
  readonly (readonly { readonly kind: "required" | "optional" | "rest"; readonly type: Descriptor }[])[] | undefined {
  const arms = sourcePresentStorageArms(type);
  const tuples = arms.map(tupleArm);
  return arms.length === 0 || tuples.some(tuple => tuple === undefined) ? undefined : tuples.map(tuple => tuple!.elements);
}

/** The array element of every present arm (arrays only, not tuples); undefined unless every present arm is an array. */
function sourceStorageArrayElements(type: Descriptor): readonly Descriptor[] | undefined {
  const arms = sourcePresentStorageArms(type);
  const elements = arms.map(arm => arrayArm(arm)?.element);
  return arms.length === 0 || elements.some(element => element === undefined) ? undefined : elements as Descriptor[];
}

/** The array element of an array type (checker sourceArrayElementType): the Host join of the per-arm elements. */
export function sourceStorageArrayElementType(source: Pick<StorageFacts, "facts">, type: Descriptor): Descriptor | undefined {
  return hostComponent(source, sourceStorageArrayElements(type));
}

/** Whether every present arm is an array or tuple (checker isArrayLike). */
export function sourceStorageIsArrayLikeType(type: Descriptor): boolean {
  const arms = sourcePresentStorageArms(type);
  return arms.length > 0 && arms.every(arm => arrayArm(arm) !== undefined || tupleArm(arm) !== undefined);
}

// The component of a multi-arm storage type (supervisor ruling on B4 D3): every arm must yield a component, and their
// single descriptor is the Host join (facts.sums.join, the one union builder, I6), never built here.
function hostComponent(source: Pick<StorageFacts, "facts">, components: readonly (Descriptor | undefined)[] | undefined):
  Descriptor | undefined {
  if (components === undefined || components.length === 0 || components.some(component => component === undefined)) return undefined;
  return source.facts.sums.join(components as Descriptor[]);
}

// Joined members and member correspondence are object facts: facts.objects.joinedMembers / correspondence /
// correspondingMember (R2 #23, one builder).

/**
 * The declaration of an accessor pair for an access role: the get accessor for reads, the set accessor for writes
 * (from the pair's merged declarations); any other declaration is its own role declaration.
 */
export function sourceStorageRoleDeclaration(source: Pick<SourceAnalysisProgram, "ast" | "navigation">, declaration: Node,
  mode: "read" | "write"): Node | undefined {
  const { ast } = source;
  const opposite = mode === "read" ? ast.is.IsSetAccessorDeclaration(declaration) : ast.is.IsGetAccessorDeclaration(declaration);
  if (!opposite) return declaration;
  return source.navigation.mergedDeclarations(declaration).find(candidate =>
    mode === "read" ? ast.is.IsGetAccessorDeclaration(candidate) : ast.is.IsSetAccessorDeclaration(candidate));
}

/** The declarations a member access reads or writes (navigation member witness; accessor pair by role). */
export function sourceStorageAccessDeclarations(source: SourceAnalysisProgram, access: Node,
  mode: "read" | "write"): readonly Node[] | undefined {
  const { ast, navigation } = source;
  const selected = navigation.memberAccess(access);
  if (selected === undefined) return undefined;
  if (mode === "read" ? selected.accessMode === "write" : selected.accessMode === "read") return Object.freeze([]);
  const readable = (node: Node): boolean => sourceStorageIsDataMember(node, ast) || sourceStorageIsMethodMember(node, ast) ||
    (mode === "read" ? ast.is.IsGetAccessorDeclaration(node) : ast.is.IsSetAccessorDeclaration(node));
  const direct = selected.declaration === undefined ? undefined : sourceStorageRoleDeclaration(source, selected.declaration, mode);
  if (direct !== undefined && readable(direct)) return Object.freeze([direct]);
  const declarations = [...new Set(selected.declarations.flatMap(declaration => navigation.mergedDeclarations(declaration))
    .filter(readable))];
  return declarations.length === 0 ? undefined : Object.freeze(declarations);
}

/** The member key of an access whose receiver is `any` (dynamic member): the property name or the literal index. */
export function sourceStorageDynamicMemberKey(source: SourceAnalysisProgram, access: Node): string | undefined {
  const { ast } = source;
  const selected = source.navigation.memberAccess(access);
  if (selected === undefined) return undefined;
  const receiver = sourceAnalysisValueType(source, selected.receiver);
  const structure = receiver === undefined ? undefined : sourceTypeDescriptorStructure(receiver);
  if (structure?.kind !== "intrinsic" || structure.intrinsic !== "any") return undefined;
  if (ast.is.IsPropertyAccessExpression(access)) {
    const name = ast.name(access);
    if (name === undefined || !ast.is.IsIdentifier(name)) return undefined;
    const property = source.facts.analyses.propertyName(name);
    return property?.kind === "resolved" ? property.name : undefined;
  }
  return sourceStorageLiteralKey(source, ast.is.IsElementAccessExpression(access)
    ? ast.as.AsElementAccessExpression(access)?.ArgumentExpression : undefined);
}

/** The constant key text of an element-access argument (string literal, else numeric literal). */
export function sourceStorageLiteralKey(source: Pick<SourceAnalysisProgram, "facts">, argument: Node | undefined): string | undefined {
  const literal = argument === undefined ? undefined : source.facts.values.literal(argument);
  if (literal?.text !== undefined) return literal.text;
  return literal?.form === "numeric" && literal.number !== undefined ? String(literal.number) : undefined;
}

/** The members named `key` of a subject's type (dynamic member resolution). */
export function sourceStorageDynamicMemberDeclarations(source: SourceAnalysisProgram, receiver: SourceStorageSubject,
  key: string, mode: "read" | "write", step: () => boolean):
  { readonly type: Descriptor; readonly declarations: readonly Node[] } | undefined {
  const type = sourceStorageSubjectType(source, receiver);
  if (type === undefined || sourceStorageIsOpenType(source.ast, type)) return undefined;
  const members = source.facts.objects.joinedMembers(type);
  if (members === undefined) return undefined;
  const originals = new Set<Node>();
  for (const member of members) {
    if (!step()) return undefined;
    if (member.name !== key) continue;
    for (const declaration of member.declarations) {
      if (!step()) return undefined;
      if (sourceStorageIsDataMember(declaration, source.ast) || sourceStorageIsMethodMember(declaration, source.ast) ||
        (mode === "read" ? source.ast.is.IsGetAccessorDeclaration(declaration) : source.ast.is.IsSetAccessorDeclaration(declaration)))
        originals.add(declaration);
    }
  }
  return originals.size === 0 ? undefined : Object.freeze({ type, declarations: Object.freeze([...originals]) });
}

/** The type of one component of a storage type. */
export function sourceStorageComponentType(source: StorageFacts, type: Descriptor, component: SourceStorageProjection): Descriptor | undefined {
  const { ast } = source;
  if (sourcePresentStorageArms(type).length === 0) return undefined;
  if (sourceStorageIsMemberProjection(component)) {
    if (component.kind === "method-value" ? !sourceStorageIsMethodMember(component.declaration, ast)
      : !sourceStorageIsDataMember(component.declaration, ast) && !ast.is.IsGetAccessorDeclaration(component.declaration)) return undefined;
    const members = source.facts.objects.joinedMembers(type)?.filter(member => member.declarations.includes(component.declaration));
    return members?.length === 1 ? members[0]!.type : undefined;
  }
  if (component.kind === "tuple-element") {
    const tuples = sourceStorageTupleElements(type);
    if (tuples === undefined) return undefined;
    return hostComponent(source, tuples.map(elements => {
      const element = elements[component.index];
      return element?.kind === "required" || element?.kind === "optional" ? element.type : undefined;
    }));
  }
  return sourceStorageArrayElementType(source, type);
}

/** The source components a destination component is read from, across a value edge `from` → `to`. */
export function sourceStorageOriginalComponents(source: StorageFacts, from: Descriptor, to: Descriptor,
  component: SourceStorageProjection): Iterable<SourceStorageProjection> {
  if (sourceStorageIsMemberProjection(component)) {
    if (sourceTypeDescriptorsEqual(from, to)) return [component];
    const member = source.facts.objects.correspondingMember(from, to, component.declaration, "read");
    if (member?.kind !== "present" || member.source.read === "unavailable" ||
      (component.kind === "method-value" ? member.destination.read !== "method"
        : member.destination.read !== "property" && member.destination.read !== "accessor")) return [];
    return (member.source.read === "accessor" ? member.source.getters : member.source.declarations).map(declaration => ({
      kind: member.source.read === "method" ? "method-value" as const : "member" as const, declaration,
    }));
  }
  return component.kind === "array-element" ? sourceStorageComponents(from)
    : [sourceStorageIsTupleType(from) ? component : { kind: "array-element" }];
}

/** The element components of a storage type (tuple positions, else the array element). */
export function* sourceStorageComponents(type: Descriptor): Iterable<SourceStorageProjection> {
  const tuples = sourceStorageTupleElements(type);
  if (tuples !== undefined) {
    const indexes = new Set<number>();
    for (const elements of tuples) for (const [index, element] of elements.entries()) {
      if (element.kind === "required" || element.kind === "optional") indexes.add(index);
    }
    for (const index of indexes) yield { kind: "tuple-element", index };
  } else if (sourceStorageArrayElements(type) !== undefined)
    yield { kind: "array-element" };
}

/** The Host type of an array literal, else of the nearest transparent parent whose Host type is a tuple. */
export function sourceStorageArrayLiteralType(source: SourceAnalysisProgram, node: Node, step?: () => boolean): Descriptor | undefined {
  let selected = sourceAnalysisValueType(source, node);
  let expression = node;
  while (selected === undefined || !sourceStorageIsTupleType(selected)) {
    if (step !== undefined && !step()) return undefined;
    const parent = source.ast.parent(expression);
    if (parent === undefined || sourceTransparentExpressionOperand(source.ast, parent) !== expression) break;
    expression = parent;
    const parentType = sourceAnalysisValueType(source, expression);
    if (parentType !== undefined && sourceStorageIsTupleType(parentType)) selected = parentType;
  }
  return selected;
}

/**
 * The Host type of a storage subject: its node's Host descriptor (values.type / callable result / iteration element /
 * receiver type), projected through its components. undefined when a Host value on the path is refused.
 */
export function sourceStorageSubjectType(source: SourceAnalysisProgram, value: SourceStorageSubject, sourceFile?: SourceFile): Descriptor | undefined {
  const { ast } = source;
  const file = sourceFile ?? ast.getSourceFile(value.node);
  if (!sourceAnalysisIncludesFile(source, file)) return undefined;
  let selected: Descriptor | undefined;
  if (value.kind === "return") {
    selected = isSourceCallableSignatureDeclaration(ast, value.node) ? sourceAnalysisCallableResult(source, value.node) : undefined;
  } else if (value.kind === "receiver") {
    selected = sourceStorageReceiverType(source, value.node);
  } else if (value.kind === "value" && ast.is.IsArrayLiteralExpression(value.node)) {
    selected = sourceStorageArrayLiteralType(source, value.node);
  } else if (value.kind === "value" && ast.is.IsSpreadElement(value.node)) {
    const operand = Node_Expression(ast, value.node);
    selected = operand === undefined ? undefined : sourceAnalysisValueType(source, operand);
  } else {
    const name = ast.name(value.node);
    const bindingContainer = name !== undefined && (ast.is.IsVariableDeclaration(value.node) ||
      ast.is.IsParameterDeclaration(value.node)) &&
      (ast.is.IsArrayBindingPattern(name) || ast.is.IsObjectBindingPattern(name));
    const initializer = bindingContainer ? Node_Initializer(ast, value.node) : undefined;
    const containerType = bindingContainer ? ast.typeNode(value.node) : undefined;
    const declarationList = bindingContainer && ast.is.IsVariableDeclaration(value.node) ? ast.parent(value.node) : undefined;
    const declarations = declarationList !== undefined && ast.is.IsVariableDeclarationList(declarationList)
      ? VariableDeclarationList_Declarations(ast, declarationList) : undefined;
    const loop = declarationList === undefined ? undefined : ast.parent(declarationList);
    const iteration = loop !== undefined && declarations?.length === 1 && declarations[0] === value.node &&
      (ast.is.IsForOfStatement(loop) || ast.is.IsForInStatement(loop)) &&
      ForInOrOfStatement_Initializer(ast, loop) === declarationList ? loop : undefined;
    if (!bindingContainer) selected = sourceAnalysisValueType(source, value.node);
    else if (iteration !== undefined) {
      const selection = source.facts.selections.iteration(iteration);
      selected = selection === undefined || "kind" in selection ? undefined : selection.element;
    } else if (containerType !== undefined) selected = sourceAnalysisValueType(source, containerType);
    else if (initializer !== undefined) selected = sourceAnalysisValueType(source, initializer);
    else if (ast.is.IsParameterDeclaration(value.node)) selected = sourceAnalysisValueType(source, value.node);
  }
  for (const component of value.projection) {
    if (selected === undefined) return undefined;
    selected = sourceStorageComponentType(source, selected, component);
  }
  return selected;
}

/**
 * The `this` type of a callable or class owner: the explicit `this` parameter, the enclosing callable of an arrow, the
 * object literal of an object-literal member, the instance type of a class (its construct result), or the constructor
 * value of a static member's class.
 */
function sourceStorageReceiverType(source: SourceAnalysisProgram, node: Node): Descriptor | undefined {
  const { ast } = source;
  const visited = new Set<Node>();
  for (let depth = 0; depth < 128 && !visited.has(node); depth += 1) {
    visited.add(node);
    const thisParameter = isSourceCallableSignatureDeclaration(ast, node) ? ast.parameters(node)[0] : undefined;
    const thisName = thisParameter === undefined ? undefined : ast.name(thisParameter);
    if (thisParameter !== undefined && thisName !== undefined && ast.is.IsIdentifier(thisName) && ast.text(thisName) === "this")
      return sourceAnalysisValueType(source, thisParameter);
    if (ast.is.IsArrowFunction(node)) {
      const owner = sourceEnclosing(ast, node, "callable-body");
      if (owner === undefined) return undefined;
      node = owner;
      continue;
    }
    const owner = ast.parent(node);
    if (owner !== undefined && ast.is.IsObjectLiteralExpression(owner)) {
      const element = source.facts.selections.objectLiteralElement(node);
      const kind = ast.is.IsMethodDeclaration(node) ? "method"
        : ast.is.IsGetAccessorDeclaration(node) ? "get" : ast.is.IsSetAccessorDeclaration(node) ? "set" : undefined;
      return element?.element === node && element.objectLiteral === owner && element.elementKind === kind && kind !== undefined
        ? sourceAnalysisValueType(source, owner) : undefined;
    }
    if (ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node)) return sourceStorageInstanceType(source, node);
    // An interface's receiver is its declared type (the Host type of the interface declaration), as at baseline.
    if (ast.is.IsInterfaceDeclaration(node)) return sourceAnalysisValueType(source, node);
    if (owner !== undefined && (ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner))) return ast.hasModifierKind(node, "static")
      ? sourceAnalysisValueType(source, owner) : sourceStorageInstanceType(source, owner);
    if (owner !== undefined && ast.is.IsInterfaceDeclaration(owner)) return sourceAnalysisValueType(source, owner);
    return undefined;
  }
  return undefined;
}

/**
 * The instance type of a class: the one result every construct signature of the class shares (a class has one instance
 * type for all its overloads; this is not a join of components). undefined when the Host construction is refused, has
 * no signature, or its signatures disagree.
 */
export function sourceStorageInstanceType(source: Pick<StorageFacts, "facts">, declaration: Node): Descriptor | undefined {
  const construction = source.facts.objects.construction(declaration);
  if ("kind" in construction) return undefined;
  const [first, ...rest] = construction.signatures.map(signature => signature.result);
  return first !== undefined && rest.every(result => sourceTypeDescriptorsEqual(result, first)) ? first : undefined;
}

/** The projection an element access selects on a storage type (literal tuple position, else the array element). */
export function sourceIndexedStorageProjection(source: StorageFacts, type: Descriptor, index: Node | undefined): SourceStorageProjection | undefined {
  if (sourcePresentStorageArms(type).length === 0) return undefined;
  if (sourceStorageIsTupleType(type)) {
    const literal = index === undefined ? undefined : source.facts.values.literal(index);
    const value = literal?.form === "numeric" ? literal.number : undefined;
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 &&
      sourceStorageComponentType(source, type, { kind: "tuple-element", index: value }) !== undefined
      ? Object.freeze({ kind: "tuple-element", index: value }) : undefined;
  }
  if (sourceStorageComponentType(source, type, { kind: "array-element" }) !== undefined)
    return Object.freeze({ kind: "array-element" });
  return undefined;
}
