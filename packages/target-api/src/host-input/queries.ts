// host-input queries (I3): the closed list of checker translations the Host value model reads, per source file.
//
// Every checker value that crosses into local-type-flow is an opaque handle (SourceHostType, SourceHostSymbol); only this
// module and its host-input siblings can open one. local-type-flow therefore cannot ask the checker anything: it holds
// handles and passes them back here. Each query translates declaration input (declared, authored and selected-signature
// types and their structure), authored syntax, or a selection witness (which call, member, element, iteration or
// generator the checker selected). No query here returns a checker-inferred expression type (R3): `expressionType` is
// read only by the witnesses in index.ts, which return presence, arm-selection or identity answers, never a type.
import { sourcePrimitiveFactKey, type AstReader, type ExtensionFactSubject, type Node, type ReadonlySourceFactResolver,
  type SourcePrimitiveKind, type Type } from "@tsonic/tsts";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "./semantics-types.js";
import type { ResolvedSourceCallInfo } from "./navigation-checker.js";
import { getSourceCallTypeParameterDeclaration, getSourceMethodTypeArgumentComponent } from "./semantics-type-arguments.js";
import { sourceArrayElementType } from "./semantics-array-types.js";
import { selectSourcePropertyDeclaration, selectedSourcePropertyDeclarations } from "./semantics-selected-property-declarations.js";
import type { SourcePropertyNameSelection } from "../source-semantics/property-names-model.js";
import { sourceTypeFlowHomomorphicInput } from "./mapped-types.js";
import { sourceTypeDescriptorMemberKey, sourceTypeDescriptorMemberOrigin, type SourceMemberOriginResult } from "./member-origins.js";
import type { SourceMemberKey } from "../source-semantics/descriptor-model.js";

declare const sourceHostTypeBrand: unique symbol;
declare const sourceHostSymbolBrand: unique symbol;
declare const sourceHostQueriesBrand: unique symbol;

/** Opaque checker type input: a declared, authored, selected-signature or selection-witness component type. */
export interface SourceHostType { readonly [sourceHostTypeBrand]: "SourceHostType" }
/** Opaque checker symbol identity (compared by identity only). */
export interface SourceHostSymbol { readonly [sourceHostSymbolBrand]: "SourceHostSymbol" }

/** A type component: the opaque type plus the declaration and authored syntax it was selected from. */
export interface SourceHostComponent {
  readonly selectedType: SourceHostType;
  readonly declaration?: Node;
  readonly authoredTypeNode?: Node;
  /** The call whose selected signature this component belongs to (parameter, result or type argument). */
  readonly contextualCall?: SourceHostCall;
}

export interface SourceHostValue {
  readonly expression: Node;
  readonly type: SourceHostType;
}

export interface SourceHostArgumentBinding {
  readonly sourceArgumentIndex: number;
  readonly effectiveArgumentIndex: number;
  readonly sourceForm: "value" | "spread-element" | "spread-sequence";
  readonly spreadElementIndex?: number;
  readonly sourceParameterIndex: number;
  readonly sourceParameterForm: "parameter" | "rest-element" | "rest-sequence";
  readonly selectedArgumentType: SourceHostType;
  readonly selectedParameterType: SourceHostType;
}

export interface SourceHostCallParameter {
  readonly parameterIndex: number;
  readonly parameterName: string;
  readonly parameterDeclaration?: Node;
  readonly selectedType: SourceHostType;
  readonly authoredTypeNode?: Node;
  readonly acceptsOmission: boolean;
  readonly rest: boolean;
}

export interface SourceHostMethodTypeArgument {
  readonly typeParameterName: string;
  readonly typeParameter: SourceHostType;
  readonly selectedType: SourceHostType;
  readonly explicitTypeNode?: Node;
  readonly defaultTypeNode?: Node;
}

/** The checker's selection at a call, `new`, tagged template or `super(...)`: selected signature, arguments, bindings. */
export interface SourceHostCall {
  readonly call: Node;
  readonly optionalChain: boolean;
  readonly sourceSelectedSignatureKind: "resolved" | "untyped";
  readonly sourceCallee: SourceHostValue;
  readonly sourceReceiver?: SourceHostValue;
  readonly sourceCalleeAccess?: { readonly selectedDeclaration?: Node };
  readonly sourceArguments: readonly SourceHostValue[];
  readonly sourceArgumentBindings: readonly SourceHostArgumentBinding[];
  readonly sourceSelectedSignatureParameters: readonly SourceHostCallParameter[];
  readonly sourceSelectedMethodTypeArguments?: readonly SourceHostMethodTypeArgument[];
  readonly sourceResultType: SourceHostType;
}

/** The checker's selection at a property or element access. */
export interface SourceHostAccess {
  readonly expression: Node;
  readonly receiver: SourceHostValue;
  readonly argument?: SourceHostValue;
  readonly selectedSymbol?: SourceHostSymbol;
  readonly selectedDeclaration?: Node;
  readonly selectedReadDeclaration?: Node;
  readonly selectedWriteDeclaration?: Node;
  readonly optionalChain: boolean;
  readonly sourceReadType?: SourceHostType;
  readonly sourceWriteType?: SourceHostType;
}

export interface SourceHostObjectLiteralElement {
  readonly objectLiteral: Node;
  readonly element: Node;
  readonly objectLiteralType: SourceHostType;
  readonly contextualType?: SourceHostType;
  readonly sourceElementSymbol?: SourceHostSymbol;
}

export interface SourceHostProperty {
  readonly symbol: SourceHostSymbol;
  readonly rootSymbols: readonly SourceHostSymbol[];
  readonly name: string;
  readonly type: SourceHostType;
  readonly optional: boolean;
  readonly readonly: boolean;
}

export interface SourceHostSignatureParameter {
  readonly type: SourceHostType;
  readonly parameterKind: "required" | "optional" | "rest";
  readonly acceptsOmission: boolean;
  readonly declaration?: Node;
}

export interface SourceHostSignatureInfo {
  readonly parameters: readonly SourceHostSignatureParameter[];
  readonly returnType: SourceHostType | undefined;
  /** The signature's declaration; undefined for a signature with no declaration (an intrinsic or synthesized one). */
  readonly declaration?: Node;
}

/** One index signature of a type: its declaration (absent for a mapped index) and its key and value types. */
export interface SourceHostIndex {
  readonly declaration?: Node;
  readonly keyType?: SourceHostType;
  readonly valueType?: SourceHostType;
  readonly readonly: boolean;
}

/** The binding of one type parameter in a type application (declaration, its own parameter type, the argument). */
export interface SourceHostTypeArgumentBinding {
  readonly declaration: Node;
  readonly parameterType: SourceHostType;
  readonly argumentType: SourceHostType;
}

/** One step of the checker's conditional-alias instantiation journal (selected branch, its node, its bindings). */
export interface SourceHostConditionalStep {
  readonly conditional: Node;
  readonly branch: "true" | "false" | "deferred";
  readonly selectedNode?: Node;
  readonly selectedType?: SourceHostType;
  readonly bindings: readonly {
    readonly declarations: readonly Node[];
    readonly parameter: SourceHostType;
    readonly argument: SourceHostType;
    readonly applicationParameter?: SourceHostType;
  }[];
}

/** A type alias application: the alias, its body, its parameter bindings and, for a conditional body, its steps. */
export interface SourceHostAliasApplication {
  readonly kind: "direct" | "conditional";
  readonly declaration: Node;
  readonly typeNode: Node;
  readonly bindings: readonly { readonly declaration: Node; readonly parameter: SourceHostType; readonly argument: SourceHostType }[];
  readonly result: SourceHostType;
  readonly conditionalSteps: readonly SourceHostConditionalStep[];
}

export interface SourceHostCallable {
  readonly parameters: readonly SourceHostSignatureParameter[];
  readonly result: SourceHostComponent;
}

export interface SourceHostTupleElement {
  readonly type: SourceHostType;
  readonly elementKind: "required" | "optional" | "rest" | "variadic";
  readonly declaration?: Node;
}

export interface SourceHostGenerator {
  readonly declaration: Node;
  readonly sourceReturnType: SourceHostType;
  readonly returnTypeBinding?: { readonly declaration: Node; readonly parameterType: SourceHostType };
}

export type SourceHostAuthoredSelection =
  | { readonly kind: "authored-members"; readonly nodes: readonly Node[]; readonly nullishCount: number }
  | { readonly kind: "ambiguous" | "unrelated" };

export type SourceHostContributionPathPart =
  | { readonly kind: "element"; readonly owner: SourceHostType }
  | { readonly kind: "tuple"; readonly owner: SourceHostType; readonly index: number }
  | { readonly kind: "type-argument"; readonly owner: SourceHostType; readonly index: number }
  | { readonly kind: "member"; readonly owner: SourceHostType; readonly symbol: SourceHostSymbol; readonly declaration: Node }
  | { readonly kind: "index"; readonly owner: SourceHostType; readonly key: SourceHostType; readonly declaration: Node }
  | { readonly kind: "callable-result"; readonly owner: SourceHostType; readonly declaration: Node }
  | { readonly kind: "callable-parameter"; readonly owner: SourceHostType; readonly index: number; readonly declaration: Node }
  | { readonly kind: "union-member"; readonly owner: SourceHostType; readonly member: SourceHostType; readonly index: number };

/** One recorded G4 inference contribution (Legacy journal) of a call: binder, origin and the source/formal paths. */
export interface SourceHostContribution {
  readonly typeParameter: SourceHostType;
  readonly origin:
    | { readonly kind: "argument"; readonly subject: Node; readonly effectiveArgumentIndex: number; readonly parameterIndex: number }
    | { readonly kind: "receiver" | "contextual-result"; readonly subject: Node };
  readonly sourcePath: readonly SourceHostContributionPathPart[];
  readonly formalPath: readonly SourceHostContributionPathPart[];
}

/** Which primitive fact applies to a value, in this order: the value node, its declaration, its type, an annotation. */
export interface SourceHostPrimitiveSubjects {
  readonly node?: Node;
  readonly declaration?: Node;
  readonly type?: SourceHostType;
  readonly annotation?: Node;
}

export interface SourceHostQueries {
  readonly [sourceHostQueriesBrand]: "SourceHostQueries";

  // ---- selection witnesses -----------------------------------------------------------------------------------------
  call(node: Node): SourceHostCall | undefined;
  /** The selected signature's declaration; undefined for an intrinsic signature. */
  callSignature(call: SourceHostCall): Node | undefined;
  /** The selected result (declared return of the selected signature) and its authored return annotation. */
  callResult(call: SourceHostCall): { readonly resultType: SourceHostType; readonly authoredTypeNode?: Node } | undefined;
  /** The type parameter declaration a selected method type argument binds. */
  callTypeParameter(invocation: Node, call: SourceHostCall, argument: SourceHostMethodTypeArgument): Node | undefined;
  methodTypeArgumentComponent(argument: SourceHostMethodTypeArgument): SourceHostComponent;
  /** The G4 journal of the call; undefined when Legacy recorded none. */
  inferenceContributions(call: SourceHostCall): readonly SourceHostContribution[] | undefined;
  propertyAccess(node: Node): SourceHostAccess | undefined;
  elementAccess(node: Node): SourceHostAccess | undefined;
  objectLiteralElement(property: Node): SourceHostObjectLiteralElement | undefined;
  /** The member of the literal's own construction that an authored property element creates. */
  objectLiteralProperty(element: SourceHostObjectLiteralElement): SourceHostProperty | undefined;
  /** The accessor or method declaration an authored method/accessor element creates (read declaration first). */
  objectLiteralAccessor(element: SourceHostObjectLiteralElement, property: SourceHostProperty): Node | undefined;
  /** The checker's iteration selection at a for-of/for-in statement or spread: its subject and selected element type. */
  iteration(node: Node): { readonly subjectKind: string; readonly subject: Node; readonly elementType: SourceHostType } | undefined;
  generator(node: Node): SourceHostGenerator | undefined;
  callableCompletion(node: Node): { readonly canFallThrough: boolean } | undefined;
  propertyName(name: Node): SourcePropertyNameSelection | undefined;
  /** Whether a function expression or arrow function has a contextual (destination) type. */
  hasContextualType(node: Node): boolean;

  // ---- declaration and authored-syntax input -----------------------------------------------------------------------
  declaredType(declaration: Node): SourceHostType | undefined;
  declaredValueType(declaration: Node): SourceHostType | undefined;
  authoredType(node: Node): SourceHostType | undefined;
  declarationSignature(declaration: Node): SourceHostSignatureInfo | undefined;
  isDefaultLibrary(node: Node): boolean;
  /** The class, interface, alias, enum, type literal or type parameter declaration that names a type. */
  typeDeclaration(type: SourceHostType, authoredTypeNode?: Node, excluded?: ReadonlySet<Node>): Node | undefined;
  /** All declarations of the type's symbol. */
  typeSymbolDeclarations(type: SourceHostType): readonly Node[];
  /** The primary declaration of the type's symbol. */
  primaryTypeDeclaration(type: SourceHostType): Node | undefined;
  /** The primary declaration of a property's symbol. */
  propertyDeclaration(property: SourceHostProperty): Node | undefined;
  homomorphicInput(type: SourceHostType, authoredTypeNode?: Node): SourceHostType | undefined;
  memberOrigin(property: SourceHostProperty, receiver: SourceHostType): SourceMemberOriginResult | undefined;
  /** The first primitive fact over the given subjects (value node, declaration, type, annotation). */
  primitive(subjects: SourceHostPrimitiveSubjects): SourcePrimitiveKind | undefined;
  /** The authored arms of `annotation` that make up `type` (a narrowed or selected type of the same annotation). */
  authoredSelection(annotation: Node, type: SourceHostType): SourceHostAuthoredSelection;

  // ---- structure of declared and selected types --------------------------------------------------------------------
  isAny(type: SourceHostType): boolean;
  isUnknown(type: SourceHostType): boolean;
  isNonPrimitive(type: SourceHostType): boolean;
  isNullish(type: SourceHostType): boolean;
  /** The one absence classifier (sourceHostAbsentConstituent): null, undefined or void as a union constituent (A11). */
  isAbsentConstituent(type: SourceHostType): boolean;
  isUnion(type: SourceHostType): boolean;
  isIntersection(type: SourceHostType): boolean;
  isTuple(type: SourceHostType): boolean;
  isArrayLike(type: SourceHostType): boolean;
  isVoidLike(type: SourceHostType): boolean;
  isBooleanLike(type: SourceHostType): boolean;
  isNumberLike(type: SourceHostType): boolean;
  isStringLike(type: SourceHostType): boolean;
  isSymbolLike(type: SourceHostType): boolean;
  isNever(type: SourceHostType): boolean;
  isBigIntLike(type: SourceHostType): boolean;
  stringLiteralValue(type: SourceHostType): string | undefined;
  numericLiteralValue(type: SourceHostType): number | bigint | undefined;
  booleanLiteralValue(type: SourceHostType): boolean | undefined;
  literalBaseType(type: SourceHostType): SourceHostType | undefined;
  /** The declaration an authored type reference names (declaration identity only). */
  authoredTypeDeclaration(node: Node): Node | undefined;
  /** The member key of an authored property name: a string or finite number literal key, or a unique symbol. */
  propertyNameKey(name: Node): SourceMemberKey | undefined;
  members(type: SourceHostType): readonly SourceHostType[];
  tupleElements(type: SourceHostType): readonly SourceHostTupleElement[];
  tupleElementTypes(type: SourceHostType): readonly SourceHostType[];
  typeArguments(type: SourceHostType): readonly SourceHostType[];
  typeArgumentBindings(type: SourceHostType): readonly SourceHostTypeArgumentBinding[] | undefined;
  aliasApplication(type: SourceHostType): SourceHostAliasApplication | undefined;
  /** The application of an alias declaration to the given argument types. */
  instantiateAlias(declaration: Node, arguments_: readonly SourceHostType[]): SourceHostAliasApplication | undefined;
  indexes(type: SourceHostType): readonly SourceHostIndex[];
  properties(type: SourceHostType): readonly SourceHostProperty[];
  callable(type: SourceHostType): SourceHostCallable | undefined;
  signatures(type: SourceHostType, kind: "call" | "construct"): readonly SourceHostSignatureInfo[];
  couldContainTypeVariables(type: SourceHostType): boolean;
  nonNullableType(type: SourceHostType): SourceHostType | undefined;
  arrayElementType(type: SourceHostType): SourceHostType | undefined;
  instantiatedBaseTypes(type: SourceHostType): readonly SourceHostType[] | undefined;
  isIdentical(left: SourceHostType, right: SourceHostType): boolean;
}

// ---- handle casts (host-input only) ----------------------------------------------------------------------------------
// The handles are the checker values themselves, typed opaquely; opening one is a type-level cast, never a copy.

export const hostType = (type: Type): SourceHostType => type as unknown as SourceHostType;
export const checkerType = (type: SourceHostType): Type => type as unknown as Type;
export const hostTypes = (types: readonly Type[]): readonly SourceHostType[] => types as unknown as readonly SourceHostType[];
export const hostComponent = (component: SourceTypeComponentEvidence): SourceHostComponent =>
  component as unknown as SourceHostComponent;
export const checkerComponent = (component: SourceHostComponent): SourceTypeComponentEvidence =>
  component as unknown as SourceTypeComponentEvidence;
export const hostCall = (call: ResolvedSourceCallInfo): SourceHostCall => call as unknown as SourceHostCall;
export const checkerCall = (call: SourceHostCall): ResolvedSourceCallInfo => call as unknown as ResolvedSourceCallInfo;

type PropertyInfo = ReturnType<SourceFileSemantics["types"]["propertyInfos"]>[number];

/**
 * The checker flow witness at a read: whether the value read there can be null/undefined. A selection witness only (R3):
 * the Host uses it to keep or drop the absence arm of its own descriptor, never as a type.
 */
export type SourceHostPresence = "present" | "possibly-absent" | "absent";

/**
 * The one absence classifier over checker input (R4: every host-input presence, absence-admission and narrowed-arm
 * answer reads it). A constituent is absence when it is null, undefined or void: a `void` union arm is absence (WP0
 * A11), exactly as the Host union builder makes it (terms.ts). A bare `void` is not absence: it is the void intrinsic.
 */
export function sourceHostAbsentConstituent(types: SourceFileSemantics["types"], type: Type): boolean {
  return types.isNullish(type) || types.isVoidLike(type);
}

/** The presence of a checker type under the one absence classifier. */
export function sourceHostPresence(types: SourceFileSemantics["types"], type: Type): SourceHostPresence {
  if (types.isNullish(type)) return "absent";
  return types.isUnion(type) && types.unionOrIntersectionTypes(type).some(member => sourceHostAbsentConstituent(types, member))
    ? "possibly-absent" : "present";
}

/** The per-file query facade. One per checker file view, owned by the program's host-input adapter (I5). */
export function createSourceHostQueries(ast: AstReader, queries: SourceFileSemantics,
  sourceFacts: ReadonlySourceFactResolver, source: Parameters<typeof sourceTypeFlowHomomorphicInput>[0]): SourceHostQueries {
  const t = checkerType;
  const { types, declarations, operations } = queries;
  const primitiveOf = (subjects: readonly ExtensionFactSubject[]): SourcePrimitiveKind | undefined => {
    for (const subject of subjects) {
      const fact = sourceFacts.getFact(subject, sourcePrimitiveFactKey);
      if (fact !== undefined) return fact.kind;
    }
    return undefined;
  };
  const signatureInfo = (signature: ReturnType<typeof types.signatureInfos>[number]): SourceHostSignatureInfo => Object.freeze({
    parameters: signature.parameters as unknown as readonly SourceHostSignatureParameter[],
    returnType: signature.returnType === undefined ? undefined : hostType(signature.returnType),
    ...(() => {
      const declaration = declarations.signatureDeclaration(signature.signature);
      return declaration === undefined ? {} : { declaration };
    })(),
  });
  const facade = {
    call: (node: Node) => {
      const call = operations.call(node);
      return call === undefined ? undefined : hostCall(call);
    },
    callSignature: (call: SourceHostCall) => declarations.signatureDeclaration(checkerCall(call).selectedSignature),
    callResult: (call: SourceHostCall) => {
      const result = operations.callResult(checkerCall(call));
      return result === undefined ? undefined : Object.freeze({ resultType: hostType(result.resultType),
        ...(result.authoredTypeNode === undefined ? {} : { authoredTypeNode: result.authoredTypeNode }) });
    },
    callTypeParameter: (invocation: Node, call: SourceHostCall, argument: SourceHostMethodTypeArgument) =>
      getSourceCallTypeParameterDeclaration(ast, queries, invocation, checkerCall(call),
        argument as unknown as NonNullable<ResolvedSourceCallInfo["sourceSelectedMethodTypeArguments"]>[number]),
    methodTypeArgumentComponent: (argument: SourceHostMethodTypeArgument) => hostComponent(getSourceMethodTypeArgumentComponent(
      argument as unknown as NonNullable<ResolvedSourceCallInfo["sourceSelectedMethodTypeArguments"]>[number])),
    inferenceContributions: (call: SourceHostCall) => {
      const evidence = checkerCall(call).sourceInferenceContributions;
      return evidence.kind === "available" ? evidence.contributions as unknown as readonly SourceHostContribution[] : undefined;
    },
    propertyAccess: (node: Node) => operations.propertyAccess(node) as unknown as SourceHostAccess | undefined,
    elementAccess: (node: Node) => operations.elementAccess(node) as unknown as SourceHostAccess | undefined,
    objectLiteralElement: (property: Node) =>
      operations.objectLiteralElement(property) as unknown as SourceHostObjectLiteralElement | undefined,
    objectLiteralProperty: (element: SourceHostObjectLiteralElement) => {
      const symbol = element.sourceElementSymbol as unknown;
      if (symbol === undefined) return undefined;
      return types.propertyInfos(t(element.objectLiteralType)).find(member => member.symbol === symbol) as unknown as
        SourceHostProperty | undefined;
    },
    objectLiteralAccessor: (element: SourceHostObjectLiteralElement, property: SourceHostProperty) => {
      const selected = selectedSourcePropertyDeclarations(queries, undefined, (property as unknown as PropertyInfo).symbol,
        [t(element.objectLiteralType)]);
      return selected === undefined ? undefined : selectSourcePropertyDeclaration(ast, selected, "read") ??
        selectSourcePropertyDeclaration(ast, selected, "write");
    },
    iteration: (node: Node) => {
      const iteration = operations.iteration(node);
      return iteration === undefined ? undefined
        : Object.freeze({ subjectKind: iteration.subject.kind, subject: iteration.subject.node, elementType: hostType(iteration.sourceElementType) });
    },
    generator: (node: Node) => operations.generator(node) as unknown as SourceHostGenerator | undefined,
    callableCompletion: (node: Node) => {
      const completion = operations.callableCompletion(node);
      return completion === undefined ? undefined : Object.freeze({ canFallThrough: completion.canFallThrough });
    },
    propertyName: (name: Node) => queries.propertyNames.get(name),
    hasContextualType: (node: Node) => types.contextualType(node) !== undefined,

    declaredType: (declaration: Node) => { const type = declarations.declaredType(declaration); return type === undefined ? undefined : hostType(type); },
    declaredValueType: (declaration: Node) => {
      const type = declarations.declaredValueType(declaration);
      return type === undefined ? undefined : hostType(type);
    },
    authoredType: (node: Node) => { const type = types.authoredType(node); return type === undefined ? undefined : hostType(type); },
    declarationSignature: (declaration: Node) => {
      const signature = types.declarationSignatureInfo(declaration);
      return signature === undefined ? undefined : signatureInfo(signature);
    },
    isDefaultLibrary: (node: Node) => declarations.isDefaultLibraryDeclaration(node),
    typeDeclaration: (type: SourceHostType, authoredTypeNode?: Node, excluded?: ReadonlySet<Node>) =>
      sourceHostTypeDeclaration(ast, queries, t(type), authoredTypeNode, excluded),
    typeSymbolDeclarations: (type: SourceHostType) => {
      const symbol = declarations.typeSymbol(t(type));
      return symbol === undefined ? [] : declarations.symbolDeclarations(symbol);
    },
    primaryTypeDeclaration: (type: SourceHostType) => {
      const symbol = declarations.typeSymbol(t(type));
      return symbol === undefined ? undefined : declarations.primarySymbolDeclaration(symbol);
    },
    propertyDeclaration: (property: SourceHostProperty) =>
      declarations.primarySymbolDeclaration((property as unknown as PropertyInfo).symbol),
    homomorphicInput: (type: SourceHostType, authoredTypeNode?: Node) => {
      const input = sourceTypeFlowHomomorphicInput(source, queries, t(type), authoredTypeNode);
      return input === undefined ? undefined : hostType(input);
    },
    memberOrigin: (property: SourceHostProperty, receiver: SourceHostType) =>
      sourceTypeDescriptorMemberOrigin({ ast }, queries, property as unknown as PropertyInfo, t(receiver)),
    primitive: (subjects: SourceHostPrimitiveSubjects) => primitiveOf([
      ...(subjects.node === undefined ? [] : [subjects.node]),
      ...queries.facts.selectedSubjects(undefined, subjects.declaration),
      ...(subjects.type === undefined ? [] : queries.facts.typeSubjects(t(subjects.type))),
      ...(subjects.annotation === undefined ? [] : queries.facts.authoredTypeSubjects(subjects.annotation)),
    ]),
    authoredSelection: (annotation: Node, type: SourceHostType): SourceHostAuthoredSelection => {
      const selected = types.authoredSelection(annotation, t(type));
      return selected.kind === "authored-members"
        ? Object.freeze({ kind: "authored-members", nodes: selected.nodes, nullishCount: selected.selectedNullishTypes.length })
        : Object.freeze({ kind: selected.kind });
    },

    isAny: (type: SourceHostType) => types.isAny(t(type)),
    isUnknown: (type: SourceHostType) => types.isUnknown(t(type)),
    isNonPrimitive: (type: SourceHostType) => types.isNonPrimitive(t(type)),
    isNullish: (type: SourceHostType) => types.isNullish(t(type)),
    isAbsentConstituent: (type: SourceHostType) => sourceHostAbsentConstituent(types, t(type)),
    isUnion: (type: SourceHostType) => types.isUnion(t(type)),
    isIntersection: (type: SourceHostType) => types.isIntersection(t(type)),
    isTuple: (type: SourceHostType) => types.isTuple(t(type)),
    isArrayLike: (type: SourceHostType) => types.isArrayLike(t(type)),
    isVoidLike: (type: SourceHostType) => types.isVoidLike(t(type)),
    isBooleanLike: (type: SourceHostType) => types.isBooleanLike(t(type)),
    isNumberLike: (type: SourceHostType) => types.isNumberLike(t(type)),
    isStringLike: (type: SourceHostType) => types.isStringLike(t(type)),
    isSymbolLike: (type: SourceHostType) => types.isSymbolLike(t(type)),
    isNever: (type: SourceHostType) => types.isNever(t(type)),
    isBigIntLike: (type: SourceHostType) => types.isBigIntLike(t(type)),
    stringLiteralValue: (type: SourceHostType) => types.stringLiteralValue(t(type)),
    numericLiteralValue: (type: SourceHostType) => types.numericLiteralValue(t(type)),
    booleanLiteralValue: (type: SourceHostType) => types.booleanLiteralValue(t(type)),
    literalBaseType: (type: SourceHostType) => { const selected = types.literalBaseType(t(type)); return selected === undefined ? undefined : hostType(selected); },
    authoredTypeDeclaration: (node: Node) => declarations.authoredTypeDeclaration(node),
    propertyNameKey: (name: Node) => {
      const selected = operations.propertyName(name);
      return selected === undefined ? undefined : sourceTypeDescriptorMemberKey(selected.type, queries);
    },
    members: (type: SourceHostType) => hostTypes(types.unionOrIntersectionTypes(t(type))),
    tupleElements: (type: SourceHostType) => types.tupleElementInfos(t(type)) as unknown as readonly SourceHostTupleElement[],
    tupleElementTypes: (type: SourceHostType) => hostTypes(types.tupleElementTypes(t(type))),
    typeArguments: (type: SourceHostType) => hostTypes(types.typeArguments(t(type))),
    typeArgumentBindings: (type: SourceHostType) => types.typeArgumentBindings(t(type)) as unknown as
      readonly SourceHostTypeArgumentBinding[] | undefined,
    aliasApplication: (type: SourceHostType) => types.aliasApplication(t(type)) as unknown as SourceHostAliasApplication | undefined,
    instantiateAlias: (declaration: Node, arguments_: readonly SourceHostType[]) =>
      types.instantiateAlias(declaration, arguments_ as unknown as readonly Type[]) as unknown as SourceHostAliasApplication | undefined,
    indexes: (type: SourceHostType) => types.indexInfos(t(type)) as unknown as readonly SourceHostIndex[],
    properties: (type: SourceHostType) => types.propertyInfos(t(type)) as unknown as readonly SourceHostProperty[],
    callable: (type: SourceHostType) => {
      const callable = types.callable(t(type));
      return callable === undefined ? undefined : Object.freeze({
        parameters: callable.parameters as unknown as readonly SourceHostSignatureParameter[],
        result: hostComponent(callable.result) });
    },
    signatures: (type: SourceHostType, kind: "call" | "construct") => types.signatureInfos(t(type), kind).map(signatureInfo),
    couldContainTypeVariables: (type: SourceHostType) => types.couldContainTypeVariables(t(type)),
    nonNullableType: (type: SourceHostType) => { const selected = types.nonNullableType(t(type)); return selected === undefined ? undefined : hostType(selected); },
    arrayElementType: (type: SourceHostType) => { const selected = sourceArrayElementType(t(type), queries); return selected === undefined ? undefined : hostType(selected); },
    instantiatedBaseTypes: (type: SourceHostType) => {
      const bases = types.instantiatedBaseTypes(t(type));
      return bases === undefined ? undefined : hostTypes(bases);
    },
    isIdentical: (left: SourceHostType, right: SourceHostType) => types.isIdentical(t(left), t(right)),
  };
  return Object.freeze(facade) as unknown as SourceHostQueries;
}

/**
 * The declaration that names a checked type: the authored reference's declaration first, else the type's alias or
 * type symbol declarations (class, interface, alias, enum, type literal, or the type parameter whose declared type it is).
 */
export function sourceHostTypeDeclaration(
  ast: AstReader,
  queries: SourceFileSemantics,
  type: Type,
  authoredTypeNode?: Node,
  excludedDeclarations?: ReadonlySet<Node>,
): Node | undefined {
  const authored = authoredTypeNode === undefined ? undefined : queries.declarations.authoredTypeDeclaration(authoredTypeNode);
  if (authored !== undefined && (ast.is.IsTypeAliasDeclaration(authored) || ast.is.IsClassDeclaration(authored) ||
    ast.is.IsInterfaceDeclaration(authored) || ast.is.IsEnumDeclaration(authored) || ast.is.IsTypeParameterDeclaration(authored))) return authored;
  const symbols = [...new Set([queries.declarations.typeAliasSymbol(type), queries.declarations.typeSymbol(type)])];
  // A symbol can merge a type parameter with a same-named value (e.g. `function f<T>() { function T() {} }`): a type
  // parameter declaration names this type only when its declared type is this type.
  // An enum member literal type (`Value.First`) is named by its enum: the canonical descriptor has no literal types, so an
  // enum literal is a value of its enum declaration.
  return symbols.flatMap(symbol => symbol === undefined ? [] : queries.declarations.symbolDeclarations(symbol)).map(declaration => {
    const owner = ast.is.IsEnumMember(declaration) ? ast.parent(declaration) : undefined;
    return owner !== undefined && ast.is.IsEnumDeclaration(owner) ? owner : declaration;
  }).find(declaration =>
    !excludedDeclarations?.has(declaration) && (ast.is.IsTypeAliasDeclaration(declaration) || ast.is.IsClassDeclaration(declaration) ||
    ast.is.IsClassExpression(declaration) || ast.is.IsInterfaceDeclaration(declaration) ||
    ast.is.IsEnumDeclaration(declaration) || ast.is.IsTypeLiteralNode(declaration) ||
    ast.is.IsTypeParameterDeclaration(declaration) && (() => {
      const declared = queries.declarations.declaredType(declaration);
      return declared !== undefined && queries.types.isIdentical(declared, type);
    })()));
}
