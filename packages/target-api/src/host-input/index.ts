// host-input: the only Host code that reads checker Type, Signature or Symbol (invariant I3, nextgen plan §2).
// It translates declaration input, authored-syntax input and checker selection witnesses (which declaration,
// signature or member the checker selected) into Host input records. It never adopts a checker-inferred answer
// (R3): no record here carries an inferred type; types are always described by the Host from declarations and syntax.
// Checker values that local-type-flow must carry (component types, call selections) cross as opaque handles
// (queries.ts) that only host-input can open.
// Internal: nothing here is exported from a public entry point.
import type { AstReader, Node, ReadonlySourceFactResolver, SourceFile, Type } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import { sourceTypeDescriptorMemberOrigin, type SourceMemberOriginResult } from "./member-origins.js";
import { sourceObjectLiteralDestinationMember } from "./semantics-object-literal-correspondence.js";
import type { SourceFileSemantics, SourceProgramSemantics } from "./semantics-types.js";
import { createSourceHostNullishComponents, type SourceHostNullishComponents } from "./nullish-components.js";
import {
  checkerType, createSourceHostQueries, hostComponent, sourceHostAbsentConstituent, sourceHostPresence,
  sourceHostTypeDeclaration, type SourceHostComponent, type SourceHostPresence, type SourceHostQueries, type SourceHostType,
} from "./queries.js";
import type { SourcePlatformFacts } from "../source-semantics/platform-model.js";
import type { SourceEnumIntegerWidthSelection } from "../source-semantics/enum-model.js";

/**
 * The checker's selection at a call, `new`, tagged template or `super(...)` use, as declarations only: a projection of
 * the one call witness (SourceNavigationCall, host-input/navigation.ts).
 */
export interface SourceHostCallWitness {
  readonly use: Node;
  /** The selected signature declaration; undefined for a signature with no declaration (an intrinsic). */
  readonly signature: Node | undefined;
  /** The receiver expression of a member call, else the callee expression. */
  readonly receiver: Node | undefined;
  readonly optionalChain: boolean;
}

/**
 * The checker's selection at a property or element access, as declarations only: a projection of the one member-access
 * witness (SourceNavigationMemberAccess, host-input/navigation.ts).
 */
export interface SourceHostMemberWitness {
  readonly use: Node;
  readonly receiver: Node;
  /**
   * The selected member declaration(s), in order: the read declaration (get accessor), the selected declaration, then
   * the write declaration (set accessor). Duplicates appear once.
   */
  readonly declarations: readonly Node[];
  /** The declaration a write through this access targets (the set accessor of an accessor pair); undefined for none. */
  readonly writeDeclaration: Node | undefined;
  readonly accessMode: "read" | "write" | "read-write" | "delete";
  readonly optionalChain: boolean;
  /** The access is the callee of a call through transparent wrappers (checker access witness). */
  readonly callCallee: boolean;
}

/** Authored narrowing witness: the authored arms of a declaration's annotation that remain at a read. */
export interface SourceHostAuthoredNarrowing {
  readonly nodes: readonly Node[];
  /** How many nullish arms the narrowed read keeps (absence when > 0). */
  readonly nullishCount: number;
}

/** The narrowed constituents at a read (narrowed-arms witness). */
export interface SourceHostNarrowedMembers {
  readonly members: readonly SourceHostComponent[];
  readonly absent: boolean;
}

export interface SourceHostInput {
  /** The checker query facade of the file that contains `node` (program or library file). */
  at(node: Node): SourceHostQueries;
  /** The facade of a program file; undefined for a node outside the program's checked files. */
  file(node: Node): SourceHostQueries | undefined;
  /** The facade of the program's first source file (used for library declarations reached from no program use). */
  program(): SourceHostQueries | undefined;
  /** Whether a node lies in a program file the checker views. */
  includes(node: Node): boolean;

  call(use: Node): SourceHostCallWitness | undefined;
  member(use: Node): SourceHostMemberWitness | undefined;
  /** Flow presence witness at a value read; undefined when the checker has no answer for the node. */
  presence(node: Node): SourceHostPresence | undefined;
  /** Presence witness of a selected component (a declared, parameter or result component). */
  componentPresence(component: SourceHostComponent, at: Node): SourceHostPresence;
  /** The intrinsic null / undefined constituents of the value read at node: the presence witness split before the
   * one-absence erasure (E9). The Host admission rule (program-facts.ts) decides from it. */
  nullishComponents(node: Node): SourceHostNullishComponents;
  /**
   * Self-reference witness (an identity answer, never a type): whether the checked type of the returned expression
   * `returned` reaches the checked type of the callable `declaration` itself. The recursive-return rule (which callables,
   * which returned expressions, the refusal) is the Host's (local-type-flow/callable-returns.ts).
   */
  returnReachesCallable(declaration: Node, returned: Node): boolean;
  /**
   * G4 contribution path witness: whether the value at `node` is the union member a recorded inference contribution
   * flowed through ("selected"), another single member ("other"), or an unselected union ("ambiguous"). undefined: no
   * checked answer at the node.
   */
  unionMemberWitness(node: Node, member: SourceHostType): "selected" | "other" | "ambiguous" | undefined;
  /** Whether the value at an argument occurrence already has exactly the formal parameter type (no binder input). */
  argumentHasFormalType(occurrence: Node, formal: SourceHostType): boolean;
  /**
   * The one destination-member selector (R1 #13): the member (canonical origin) an object-literal property fills, by the
   * checker's structural member correspondence (sourceObjectLiteralDestinationMember) between the literal's construction
   * and its destination: the given component, else the checked type at `destinationAt`, else the property's contextual
   * type. A member-selection witness (R3). undefined: no single destination member; a "refused" origin: a mapped member
   * with no single key. The reader decides what an unresolved origin means.
   */
  objectLiteralDestination(literal: Node, property: Node,
    destination: { readonly component?: SourceHostComponent; readonly destinationAt?: Node }): SourceMemberOriginResult | undefined;
  /**
   * Declaration witness of a regular expression literal: the library declaration it constructs (the global `RegExp`
   * interface) with that declaration's declared type. An identity answer (R3): the literal's value is that declaration.
   */
  regularExpressionComponent(node: Node): SourceHostComponent | undefined;
  /**
   * Narrowing witness at a project reference: whether control flow narrowed the read below its declared type. The Host
   * keeps its own descriptor; this only says whether narrowing applies.
   */
  narrowed(node: Node): boolean;
  /**
   * Whether the declared type of the reference at `occurrence` (else of `declaration`) admits absence. Declaration input;
   * selects whether a presence witness can drop an absence arm.
   */
  declaredAdmitsAbsence(occurrence: Node, declaration: Node | undefined): boolean;
  /**
   * The authored arms of `annotation` (the declaration's own annotation) that remain at the identifier read `node` after
   * control-flow narrowing. undefined: the read is not narrowed, or the narrowed type is not a selection of authored arms.
   */
  authoredNarrowing(node: Node, declaration: Node, annotation: Node): SourceHostAuthoredNarrowing | undefined;
  /**
   * Narrowed-arms witness at an identifier read whose declared type control flow narrowed: the non-nullish constituents
   * of the narrowed read (each an opaque component the Host describes only to select its OWN arms) and whether a nullish
   * constituent remains. The Host keeps the arms of its declared descriptor that these constituents select (R3: the read
   * descriptor is built from Host arms, never from the checked read type). undefined: not narrowed.
   */
  narrowedMembers(node: Node): SourceHostNarrowedMembers | undefined;
  /**
   * Narrowing witness (a declaration identity, never a type, R3): the project class whose instances control flow
   * narrowed this identifier read to (an `instanceof` guard). The Host describes the read from that class's own declared
   * instance type, the same instance its `instanceof` test relation publishes. undefined otherwise.
   */
  narrowedClass(node: Node): Node | undefined;
  /**
   * Declaration input: the member declarations named `name` on the declared type of a class, interface, alias, enum or
   * type parameter declaration (a type parameter and an enum answer through their apparent members: the constraint, the
   * primitive's library interface). Used where the Host descriptor has no structure for the declaration (a recursion cut,
   * a declaration-file type the descriptor cannot express, an enum, a type parameter). Never an inferred type.
   * undefined: the declared type has no member of that name.
   */
  declaredMembers(declaration: Node, name: string): readonly Node[] | undefined;
}

export interface SourceHostInputServices {
  readonly ast: AstReader;
  readonly semantics: SourceProgramSemantics;
  readonly sourceFacts: ReadonlySourceFactResolver;
  readonly navigation: SourceProgramNavigation;
  readonly sourceFiles: readonly SourceFile[];
  /** The active target's native integer premise (E24); carried into the type-flow source the descriptor reader reads. */
  readonly platform: SourcePlatformFacts;
  /** The integer width of a numeric enum (enum-constants.ts); carried into the type-flow source. */
  enumIntegerWidth(declaration: Node): SourceEnumIntegerWidthSelection | undefined;
}

const presenceOf = (queries: SourceFileSemantics, type: Type): SourceHostPresence => sourceHostPresence(queries.types, type);

/** One adapter per program view; lifetime is the program's (I5). */
export function createSourceHostInput(services: SourceHostInputServices): SourceHostInput {
  const { ast, semantics, sourceFacts, navigation, sourceFiles, platform } = services;
  const reader = Object.freeze({ ast, navigation, sourceFacts, sourceFiles, platform,
    enumIntegerWidth: (declaration: Node) => services.enumIntegerWidth(declaration) });
  const calls = new Map<Node, SourceHostCallWitness | undefined>();
  const members = new Map<Node, SourceHostMemberWitness | undefined>();
  const declaredMembers = new Map<Node, Map<string, readonly Node[] | undefined>>();
  const facades = new Map<SourceFileSemantics, SourceHostQueries>();
  const facade = (queries: SourceFileSemantics): SourceHostQueries => {
    let selected = facades.get(queries);
    if (selected === undefined) {
      selected = createSourceHostQueries(ast, queries, sourceFacts, reader);
      facades.set(queries, selected);
    }
    return selected;
  };
  const includes = (node: Node): boolean => {
    const file = ast.getSourceFile(node);
    return file !== undefined && semantics.includes(file);
  };
  const nullishComponents = createSourceHostNullishComponents(semantics);
  return Object.freeze({
    nullishComponents,
    at: (node: Node) => facade(semantics.forNode(node)),
    file: (node: Node) => {
      const file = ast.getSourceFile(node);
      return file !== undefined && semantics.includes(file) ? facade(semantics.forFile(file)) : undefined;
    },
    program: () => sourceFiles[0] === undefined ? undefined : facade(semantics.forFile(sourceFiles[0])),
    includes,
    returnReachesCallable(declaration: Node, returned: Node): boolean {
      const queries = semantics.forNode(declaration);
      const selected = ast.is.IsFunctionExpression(declaration) || ast.is.IsArrowFunction(declaration)
        ? queries.types.expressionType(declaration) : queries.declarations.declaredValueType(declaration);
      if (selected === undefined || queries.types.callSignatures(selected).length === 0) return false;
      const type = queries.types.expressionType(returned);
      if (type === undefined) return false;
      const pending: Type[] = [type];
      const seen = new Set<Type>();
      while (pending.length > 0) {
        const current = pending.pop()!;
        if (current === selected) return true;
        if (seen.has(current)) continue;
        seen.add(current);
        if (queries.types.isUnion(current) || queries.types.isIntersection(current)) {
          pending.push(...queries.types.unionOrIntersectionTypes(current));
          continue;
        }
        const symbol = queries.declarations.typeAliasSymbol(current) ?? queries.declarations.typeSymbol(current);
        const nominal = symbol !== undefined && queries.declarations.symbolDeclarations(symbol).some(node =>
          ast.is.IsTypeAliasDeclaration(node) || ast.is.IsClassDeclaration(node) || ast.is.IsInterfaceDeclaration(node));
        if (nominal || queries.types.isArrayLike(current) || queries.types.isTuple(current)) {
          pending.push(...queries.types.typeArguments(current));
          continue;
        }
        for (const signature of [...queries.types.signatureInfos(current, "call"), ...queries.types.signatureInfos(current, "construct")]) {
          if (signature.returnType !== undefined) pending.push(signature.returnType);
          pending.push(...signature.parameters.map(parameter => parameter.type));
        }
        if (!queries.types.isAny(current) && !queries.types.isUnknown(current) && !queries.types.isNumberLike(current) &&
          !queries.types.isStringLike(current) && !queries.types.isBooleanLike(current) && !queries.types.isBigIntLike(current) &&
          !queries.types.isSymbolLike(current) && !queries.types.isNullish(current) && !queries.types.isVoidLike(current)) {
          pending.push(...queries.types.propertyInfos(current).map(property => property.type));
        }
      }
      return false;
    },
    unionMemberWitness(node: Node, member: SourceHostType): "selected" | "other" | "ambiguous" | undefined {
      const queries = semantics.forNode(node);
      const type = queries.types.expressionType(node);
      if (type === undefined) return undefined;
      const base = queries.types.literalBaseType(type);
      const selected = checkerType(member);
      if (queries.types.isIdentical(type, selected) || base !== undefined && queries.types.isIdentical(base, selected)) return "selected";
      return queries.types.isUnion(type) ? "ambiguous" : "other";
    },
    argumentHasFormalType(occurrence: Node, formal: SourceHostType): boolean {
      const queries = semantics.forNode(occurrence);
      const actual = queries.types.expressionType(occurrence);
      return actual !== undefined && queries.types.isIdentical(actual, checkerType(formal));
    },
    objectLiteralDestination(literal: Node, property: Node,
      destination: { readonly component?: SourceHostComponent; readonly destinationAt?: Node }) {
      const queries = semantics.forNode(literal);
      const element = queries.operations.objectLiteralElement(property);
      if (element === undefined || element.objectLiteral !== literal || element.element !== property) return undefined;
      const selected = (destination.component === undefined ? undefined : checkerType(destination.component.selectedType)) ??
        (destination.destinationAt === undefined ? undefined : queries.types.expressionType(destination.destinationAt)) ??
        element.contextualType;
      const present = selected === undefined ? undefined : queries.types.nonNullableType(selected);
      const member = present === undefined ? undefined : sourceObjectLiteralDestinationMember(element, present, queries);
      return member === undefined ? undefined : sourceTypeDescriptorMemberOrigin({ ast }, queries, member.property, member.receiverType);
    },
    // The presence witness is the presence field of the one read's nullish components (Q104): one read, one owner.
    presence: (node: Node): SourceHostPresence | undefined => nullishComponents(node).presence,
    componentPresence(component: SourceHostComponent, at: Node): SourceHostPresence {
      return presenceOf(semantics.forNode(at), checkerType(component.selectedType));
    },
    regularExpressionComponent(node: Node): SourceHostComponent | undefined {
      if (ast.kindName(node) !== "KindRegularExpressionLiteral") return undefined;
      const queries = semantics.forNode(node);
      const type = queries.types.expressionType(node);
      const symbol = type === undefined ? undefined : queries.declarations.typeSymbol(type);
      const declaration = symbol === undefined ? undefined : queries.declarations.primarySymbolDeclaration(symbol);
      const declared = declaration === undefined ? undefined : queries.declarations.declaredType(declaration);
      return declaration === undefined || declared === undefined ? undefined
        : hostComponent(Object.freeze({ selectedType: declared, declaration }));
    },
    narrowed(node: Node): boolean {
      const refinement = semantics.selectValueTypeRefinement(node);
      return refinement.kind === "resolved" &&
        !semantics.forNode(node).types.isIdentical(refinement.declaredType, refinement.selectedType);
    },
    declaredAdmitsAbsence(occurrence: Node, declaration: Node | undefined): boolean {
      const queries = semantics.forNode(occurrence);
      const refinement = semantics.selectValueTypeRefinement(occurrence);
      const declared = refinement.kind === "resolved" ? refinement.declaredType
        : declaration === undefined ? undefined : queries.declarations.declaredType(declaration);
      return declared !== undefined && presenceOf(queries, declared) === "possibly-absent";
    },
    authoredNarrowing(node: Node, declaration: Node, annotation: Node): SourceHostAuthoredNarrowing | undefined {
      if (!ast.is.IsIdentifier(node)) return undefined;
      const refinement = semantics.selectValueTypeRefinement(node);
      if (refinement.kind !== "resolved" || refinement.reference.declaration !== declaration) return undefined;
      const selected = semantics.forNode(node).types.authoredSelection(annotation, refinement.selectedType);
      return selected.kind === "authored-members"
        ? Object.freeze({ nodes: selected.nodes, nullishCount: selected.selectedNullishTypes.length }) : undefined;
    },
    narrowedMembers(node: Node): SourceHostNarrowedMembers | undefined {
      if (!ast.is.IsIdentifier(node)) return undefined;
      const refinement = semantics.selectValueTypeRefinement(node);
      if (refinement.kind !== "resolved") return undefined;
      const types = semantics.forNode(node).types;
      if (types.isIdentical(refinement.declaredType, refinement.selectedType)) return undefined;
      const constituents = types.isUnion(refinement.selectedType) ? types.unionOrIntersectionTypes(refinement.selectedType)
        : [refinement.selectedType];
      return Object.freeze({
        members: Object.freeze(constituents.filter(member => !sourceHostAbsentConstituent(types, member))
          .map(member => hostComponent(Object.freeze({ selectedType: member })))),
        absent: constituents.some(member => sourceHostAbsentConstituent(types, member)),
      });
    },
    narrowedClass(node: Node): Node | undefined {
      if (!ast.is.IsIdentifier(node)) return undefined;
      const selected = semantics.selectValueTypeRefinement(node);
      if (selected.kind !== "resolved") return undefined;
      const queries = semantics.forNode(node);
      if (queries.types.isIdentical(selected.declaredType, selected.selectedType) ||
        queries.types.couldContainTypeVariables(selected.selectedType)) return undefined;
      const declaration = sourceHostTypeDeclaration(ast, queries, selected.selectedType);
      if (declaration === undefined || !(ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration))) return undefined;
      const declared = queries.declarations.declaredType(declaration);
      return declared !== undefined && queries.types.isIdentical(declared, selected.selectedType) ? declaration : undefined;
    },
    declaredMembers(declaration: Node, name: string): readonly Node[] | undefined {
      let byName = declaredMembers.get(declaration);
      if (byName === undefined) { byName = new Map(); declaredMembers.set(declaration, byName); }
      if (byName.has(name)) return byName.get(name);
      const queries = semantics.forNode(declaration);
      const declared = queries.declarations.declaredType(declaration);
      const property = declared === undefined ? undefined : queries.types.propertyInfos(declared).find(selected => selected.name === name);
      const found = property === undefined ? undefined : queries.declarations.symbolDeclarations(property.symbol);
      const result = found === undefined || found.length === 0 ? undefined : Object.freeze([...found]);
      byName.set(name, result);
      return result;
    },
    // A projection of the one call witness (host-input/navigation.ts, R2 #1).
    call(use: Node): SourceHostCallWitness | undefined {
      if (calls.has(use)) return calls.get(use);
      const selected = navigation.call(use);
      const witness = selected === undefined ? undefined : Object.freeze({
        use,
        signature: selected.signature,
        receiver: selected.receiver ?? selected.callee,
        optionalChain: selected.optionalChain,
      });
      calls.set(use, witness);
      return witness;
    },
    member(use: Node): SourceHostMemberWitness | undefined {
      if (members.has(use)) return members.get(use);
      // A projection of the one member-access witness (host-input/navigation.ts, R2 #2): only the declarations the
      // checker selected (read, selected, write), never the root-member list of an unselected access.
      const selected = navigation.memberAccess(use);
      const declarations = selected === undefined ? [] : [...new Set([selected.readDeclaration, selected.declaration,
        selected.writeDeclaration].filter((declaration): declaration is Node => declaration !== undefined))];
      const witness = selected === undefined ? undefined : Object.freeze({
        use, receiver: selected.receiver, declarations: Object.freeze(declarations), writeDeclaration: selected.writeDeclaration,
        accessMode: selected.accessMode, optionalChain: selected.optionalChain, callCallee: selected.callCallee,
      });
      members.set(use, witness);
      return witness;
    },
  });
}
