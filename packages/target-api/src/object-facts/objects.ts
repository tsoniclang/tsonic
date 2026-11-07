// SourceObjectFacts (G8): heritage, members, construction, implementation, required members, own keys and
// method values, over the existing heritage / member-dispatch / constructor navigation and the value model's
// descriptors. No checker Type is read here; declarations come from navigation, descriptors from SourceValueFacts.
import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceRefusal, SourceValueFacts } from "../public/source/facts.js";
import type {
  SourceConstructFacts, SourceHeritageEdge, SourceJoinedMember, SourceMemberCorrespondence, SourceMemberImplementation,
  SourceMemberPair, SourceObjectFacts, SourceObjectMember,
} from "../public/source/objects.js";
import { sourceTypeDescriptorIsAbsent, sourceTypeDescriptorPresentArms } from "../source-semantics/descriptor-arms.js";
import { sourceTypeDescriptorOpenness } from "../source-semantics/local-type-flow/uses.js";
import type { SourceSelectionFacts } from "../public/source/selections.js";
import { isSourceCallableSignatureDeclaration, sourceNodeHasRole } from "../source-model/callable-boundaries.js";
import { sourceClassFieldHasStorage, sourceParameterIsProperty } from "../source-model/class-members.js";
import type { SourceDeclaredHeritageEdge, SourceProgramNavigation } from "../source-navigation/types.js";
import { orderEnumerableOwnStringProperties } from "../source-semantics/enumerable-own-properties.js";
import { sourceTypeDescriptorsEqual } from "../source-semantics/local-type-flow/terms.js";
import type {
  SourceMemberKey, SourceTypeDescriptor, SourceTypeDescriptorMember, SourceTypeDescriptorSignature,
} from "../source-semantics/local-type-flow/types.js";
import { sourceRefusalOfOutcome } from "./selections.js";

export interface SourceObjectFactsInput {
  readonly ast: AstReader;
  /** The program files whose declarations the eager refusal census reads (R5). */
  readonly sourceFiles: readonly SourceFile[];
  readonly navigation: SourceProgramNavigation;
  readonly values: SourceValueFacts;
  readonly selections: SourceSelectionFacts;
  /** The sole substitution (SourceSumFacts.substitute, I6): heritage defaults over earlier bindings. */
  readonly substitute: (type: SourceTypeDescriptor, bindings: ReadonlyMap<Node, SourceTypeDescriptor>) => SourceTypeDescriptor;
  /** The one union builder (SourceSumFacts.join, I6): a joined member's read type over the arms. */
  readonly join: (components: readonly SourceTypeDescriptor[]) => SourceTypeDescriptor | undefined;
}

type Members = readonly SourceObjectMember[] | SourceRefusal;

export function createSourceObjectFacts(input: SourceObjectFactsInput): SourceObjectFacts & {
  refusals(): readonly SourceRefusal[];
} {
  const { ast, navigation, values, selections } = input;
  // A refusal is an answer of its query; `refusals()` collects the answers of its eager census, never a side log (R5).
  const raise = (code: string, site: Node, message: string): SourceRefusal =>
    Object.freeze({ kind: "refused", code, message, site });
  const memberMemo = new WeakMap<SourceTypeDescriptor, Members>();
  /** Definitions seen per declaration, to resolve a "recursion" cut to its definition (same declaration + arguments). */
  const definitions = new Map<Node, { readonly typeArguments: readonly SourceTypeDescriptor[]; readonly definition: SourceTypeDescriptor }[]>();
  const heritageMemo = new WeakMap<Node, readonly SourceHeritageEdge[] | SourceRefusal>();
  const constructionMemo = new WeakMap<Node, SourceConstructFacts | SourceRefusal>();

  const descriptor = (node: Node): SourceTypeDescriptor | SourceRefusal => {
    const outcome = values.type(node);
    return outcome.kind !== "refused" ? outcome.type : sourceRefusalOfOutcome(outcome);
  };
  const refused = (value: unknown): value is SourceRefusal =>
    typeof value === "object" && value !== null && (value as { readonly kind?: string }).kind === "refused";

  const remember = (type: Extract<SourceTypeDescriptor, { readonly kind: "declared" }>): void => {
    if (type.definition === undefined) return;
    const known = definitions.get(type.declaration) ?? [];
    if (!known.some(entry => entry.typeArguments.length === type.typeArguments.length &&
      entry.typeArguments.every((argument, index) => sourceTypeDescriptorsEqual(argument, type.typeArguments[index]!)))) {
      known.push({ typeArguments: type.typeArguments, definition: type.definition });
      definitions.set(type.declaration, known);
    }
  };

  const definitionOf = (type: Extract<SourceTypeDescriptor, { readonly kind: "declared" }>, site: Node):
    SourceTypeDescriptor | SourceRefusal | undefined => {
    if (type.definition !== undefined) { remember(type); return type.definition; }
    if (type.cut === "unexpressible") {
      return raise("TSONIC_SOURCE_OBJECT_UNEXPRESSIBLE", site,
        "The members of this declaration-file type cannot be expressed as Source object facts.");
    }
    if (type.cut === "recursion") {
      const known = definitions.get(type.declaration)?.find(entry => entry.typeArguments.length === type.typeArguments.length &&
        entry.typeArguments.every((argument, index) => sourceTypeDescriptorsEqual(argument, type.typeArguments[index]!)));
      return known?.definition ?? raise("TSONIC_SOURCE_OBJECT_RECURSION_UNRESOLVED", site,
        "The members of this recursive type reference are requested before its definition was published.");
    }
    return undefined;
  };

  const memberKind = (declarations: readonly Node[]): SourceObjectMember["kind"] => {
    const getter = declarations.some(entry => ast.is.IsGetAccessorDeclaration(entry));
    const setter = declarations.some(entry => ast.is.IsSetAccessorDeclaration(entry));
    if (getter && setter) return "accessor-pair";
    if (getter) return "get";
    if (setter) return "set";
    return declarations.some(entry => ast.is.IsMethodDeclaration(entry) || ast.is.IsMethodSignatureDeclaration(entry))
      ? "method" : "property";
  };

  const keyOf = (member: SourceTypeDescriptorMember, declaration: Node | undefined): SourceMemberKey => {
    if (member.origin.kind === "mapped") return member.origin.key;
    const name = declaration === undefined ? undefined : ast.name(declaration);
    return name !== undefined && ast.kindName(name) === "KindNumericLiteral" && String(Number(member.name)) === member.name
      ? Object.freeze({ kind: "number", value: Number(member.name) })
      : Object.freeze({ kind: "string", value: member.name });
  };

  const objectMember = (member: SourceTypeDescriptorMember, owner: Node | undefined): SourceObjectMember => {
    const declarations = member.origin.kind === "declared" ? accessorDeclarations(ast, member.origin.declaration) : [];
    const declaringOwner = member.origin.kind === "declared" ? ast.parent(member.origin.declaration)
      : member.origin.owner;
    if (declaringOwner === undefined) throw new Error("A published member requires its declaring owner.");
    const setter = declarations.find(entry => ast.is.IsSetAccessorDeclaration(entry));
    const setterParameter = setter === undefined ? undefined : ast.parameters(setter)[0];
    const written = setterParameter === undefined ? undefined : descriptor(setterParameter);
    const writeType = written === undefined || refused(written) || sourceTypeDescriptorsEqual(written, member.type) ? undefined : written;
    const first = declarations[0];
    return Object.freeze({
      key: keyOf(member, first),
      name: member.name,
      kind: memberKind(declarations),
      declarations: Object.freeze(declarations),
      type: member.type,
      ...(writeType === undefined ? {} : { writeType }),
      optional: member.optional,
      readonly: member.readonly === true,
      static: first !== undefined && ast.hasModifierKind(first, "static"),
      owner: declaringOwner,
      inherited: owner !== undefined && declaringOwner !== owner,
    });
  };

  const members = (type: SourceTypeDescriptor, site?: Node): Members => {
    const known = memberMemo.get(type);
    if (known !== undefined) return known;
    const selected = ((): Members => {
      switch (type.kind) {
        case "shape": return Object.freeze(type.members.map(member => objectMember(member, undefined)));
        case "optional": return members(type.value, site);
        // A union value has the members every present arm has with the same key, declarations and type (R2 #32: a target
        // query, never a Source refusal). Per-arm members are selected through the union relation (relations.at).
        case "union": {
          const perArm: (readonly SourceObjectMember[])[] = [];
          for (const arm of sourceTypeDescriptorPresentArms(type)) {
            const armMembers = members(arm, site);
            if (refused(armMembers)) return armMembers;
            perArm.push(armMembers);
          }
          const [first, ...rest] = perArm;
          return Object.freeze((first ?? []).filter(member => rest.every(candidates => candidates.some(candidate =>
            memberKeysEqual(candidate.key, member.key) && sourceTypeDescriptorsEqual(candidate.type, member.type) &&
            candidate.declarations.length === member.declarations.length &&
            candidate.declarations.every((declaration, index) => declaration === member.declarations[index])))));
        }
        case "declared": {
          const definition = definitionOf(type, site ?? type.declaration);
          if (definition === undefined) return Object.freeze([]);
          if (refused(definition)) return definition;
          if (definition.kind !== "shape") return members(definition, site);
          return Object.freeze(definition.members.map(member => objectMember(member, type.declaration)));
        }
        default: return Object.freeze([]);
      }
    })();
    memberMemo.set(type, selected);
    return selected;
  };

  // Type arguments of a heritage clause, one per target binder (R-B4-3): the authored argument, else the binder's
  // authored default with the earlier bindings substituted (the sole substitution, I6). A binder with neither is not
  // published (the clause names fewer arguments than binders only when defaults supply the rest).
  const heritageEdge = (edge: SourceDeclaredHeritageEdge): SourceHeritageEdge | SourceRefusal => {
    const typeArguments: SourceTypeDescriptor[] = [];
    const binders = !hasTypeParameters(edge.target.declaration) ? []
      : ast.typeParameters(edge.target.declaration).filter((binder): binder is Node => binder !== undefined);
    const bindings = new Map<Node, SourceTypeDescriptor>();
    for (const [index, argument] of edge.typeArguments.entries()) {
      const selected = descriptor(argument);
      if (refused(selected)) return selected;
      typeArguments.push(selected);
      const binder = binders[index];
      if (binder !== undefined) bindings.set(binder, selected);
    }
    for (const binder of binders.slice(edge.typeArguments.length)) {
      const authored = ast.as.AsTypeParameterDeclaration(binder)?.DefaultType;
      if (authored === undefined) break;
      const selected = descriptor(authored);
      if (refused(selected)) return selected;
      const applied = input.substitute(selected, bindings);
      typeArguments.push(applied);
      bindings.set(binder, applied);
    }
    // The base reference (FX-CC-H2): the target declaration's Host instance type (values.type of the class / interface
    // declaration, with its definition) applied to this clause's type arguments by the sole substitution (I6).
    const target = selfType(edge.target.declaration);
    if (refused(target)) return target;
    const type = bindings.size === 0 ? target : input.substitute(target, bindings);
    return Object.freeze({
      kind: edge.kind, declaration: edge.sourceDeclaration, heritage: edge.heritage, target: edge.target.declaration,
      typeArguments: Object.freeze(typeArguments), type,
    });
  };
  const heritageEdges = (edges: readonly SourceDeclaredHeritageEdge[]): readonly SourceHeritageEdge[] | SourceRefusal => {
    const selected: SourceHeritageEdge[] = [];
    for (const edge of edges) {
      const published = heritageEdge(edge);
      if (refused(published)) return published;
      selected.push(published);
    }
    return Object.freeze(selected);
  };

  const heritage = (declaration: Node): readonly SourceHeritageEdge[] | SourceRefusal => {
    const known = heritageMemo.get(declaration);
    if (known !== undefined) return known;
    const result = navigation.declaredHeritage(declaration);
    const selected = result.kind === "unresolved"
      ? raise("TSONIC_SOURCE_HERITAGE_UNRESOLVED", result.heritage, result.reason)
      : heritageEdges(result.edges);
    heritageMemo.set(declaration, selected);
    return selected;
  };

  // A declaration kind that can declare type parameters (ast.typeParameters is defined only for those, E13).
  const hasTypeParameters = (declaration: Node): boolean =>
    ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) || ast.is.IsInterfaceDeclaration(declaration) ||
    ast.is.IsTypeAliasDeclaration(declaration);

  const instanceType = (declaration: Node): SourceTypeDescriptor => Object.freeze({
    kind: "declared", declaration,
    typeArguments: Object.freeze((ast.typeParameters(declaration) ?? []).filter((entry): entry is Node => entry !== undefined)
      .map(parameter => Object.freeze({ kind: "declared" as const, declaration: parameter, typeArguments: Object.freeze([]) }))),
  });

  /**
   * The instance type of a class or interface declaration (R3 #17): the value model's descriptor of the declaration
   * (declared, with its definition; FX-HV publishes class and interface declarations as their instance type). A class
   * expression is a value (its constructor), so its instance type is the declared reference the construction results
   * name. Any other node is an invariant failure.
   */
  function selfType(declaration: Node): SourceTypeDescriptor | SourceRefusal {
    if (ast.is.IsClassExpression(declaration)) return instanceType(declaration);
    if (!ast.is.IsClassDeclaration(declaration) && !ast.is.IsInterfaceDeclaration(declaration)) {
      throw new Error("objects.selfType requires a class or interface declaration.");
    }
    return descriptor(declaration);
  }

  const construction = (declaration: Node): SourceConstructFacts | SourceRefusal => {
    const known = constructionMemo.get(declaration);
    if (known !== undefined) return known;
    const result = navigation.classConstructors(declaration);
    const selected = ((): SourceConstructFacts | SourceRefusal => {
      if (result.kind === "unresolved") return raise("TSONIC_SOURCE_CONSTRUCTION_UNRESOLVED", result.declaration, result.reason);
      const typeParameters = Object.freeze((ast.typeParameters(declaration) ?? []).filter((entry): entry is Node => entry !== undefined));
      const result_ = instanceType(declaration);
      const signatures: SourceTypeDescriptorSignature[] = [];
      for (const signature of result.signatures) {
        const parameters: SourceTypeDescriptorSignature["parameters"][number][] = [];
        for (const parameter of signature.parameters) {
          const type = descriptor(parameter.parameterDeclaration);
          if (refused(type)) return type;
          parameters.push(Object.freeze({
            declaration: parameter.parameterDeclaration,
            kind: parameter.rest ? "rest" : parameter.acceptsOmission ? "optional" : "required",
            type,
          }));
        }
        signatures.push(Object.freeze({
          ...(signature.declaration === undefined ? {} : { declaration: signature.declaration }),
          typeParameters, parameters: Object.freeze(parameters), result: result_,
        }));
      }
      return Object.freeze({ declaration, implicit: result.implicit, signatures: Object.freeze(signatures) });
    })();
    constructionMemo.set(declaration, selected);
    return selected;
  };

  const implementation = (classDeclaration: Node, contractMember: Node): SourceMemberImplementation | "unrelated" | SourceRefusal => {
    const result = navigation.memberImplementation(classDeclaration, contractMember);
    if (result.kind === "unrelated") return "unrelated";
    if (result.kind === "unresolved") return raise("TSONIC_SOURCE_MEMBER_IMPLEMENTATION_UNRESOLVED", contractMember, result.reason);
    const dispatch = navigation.memberDispatch(result.implementation.declaration);
    return Object.freeze({
      contract: result.contractDeclaration, implementation: result.implementation.declaration,
      overridesBase: dispatch?.overridesBase === true, hasDerivedOverride: dispatch?.hasDerivedOverride === true,
    });
  };

  const contracts = (implementationDeclaration: Node) => {
    const result = navigation.memberContracts(implementationDeclaration);
    return result.kind === "unresolved"
      ? raise("TSONIC_SOURCE_MEMBER_CONTRACTS_UNRESOLVED", result.declaration, result.reason)
      : result.contracts;
  };
  let censusRefusals: readonly SourceRefusal[] | undefined;

  const callableImplementation = (contract: Node): Node | "unrelated" | SourceRefusal => {
    const result = navigation.callableImplementation(contract);
    if (result.kind === "resolved") return result.implementation.declaration;
    if (result.kind === "unrelated" || !navigation.isProjectDeclaration(contract) ||
      !isSourceCallableSignatureDeclaration(ast, contract)) return "unrelated";
    // The entity's declarations, as the navigation selects among them: a constructor's are its class's constructors.
    const entity = ast.is.IsConstructorDeclaration(contract)
      ? ast.members(ast.parent(contract)).filter((member): member is Node => member !== undefined)
      : navigation.mergedDeclarations(contract);
    return entity.some(declaration => sourceNodeHasRole(ast, declaration, "callable-body"))
      ? raise("TSONIC_SOURCE_CALLABLE_IMPLEMENTATION_UNRESOLVED", contract, result.reason)
      : "unrelated";
  };

  const ownKeys = (value: Node): readonly SourceMemberKey[] | "ambiguous" => {
    let current = value;
    for (let step = 0; step < 64; step += 1) {
      if (ast.is.IsParenthesizedExpression(current) || ast.is.IsAsExpression(current) || ast.is.IsSatisfiesExpression(current)) {
        const inner = ast.as.AsParenthesizedExpression(current)?.Expression ?? ast.as.AsAsExpression(current)?.Expression ??
          ast.as.AsSatisfiesExpression(current)?.Expression;
        if (inner === undefined) return "ambiguous";
        current = inner;
        continue;
      }
      if (ast.is.IsObjectLiteralExpression(current)) return objectLiteralOwnKeys(ast, current);
      if (ast.is.IsNewExpression(current)) {
        const selected = selections.call(current);
        const target = selected === undefined || refused(selected) ? undefined : selected.declaration;
        return target === undefined || !ast.is.IsClassDeclaration(target) && !ast.is.IsClassExpression(target) ||
          !navigation.isProjectDeclaration(target) || heritageHasBase(target) ? "ambiguous" : classOwnKeys(ast, target);
      }
      if (ast.is.IsIdentifier(current)) {
        const reference = navigation.sourceReferenceFor(current);
        if (reference === undefined || !reference.project || !ast.is.IsVariableDeclaration(reference.declaration)) return "ambiguous";
        const summary = navigation.declarationUseSummary(reference.declaration);
        const initializer = ast.as.AsVariableDeclaration(reference.declaration)?.Initializer;
        if (summary.bindingWritten || summary.memberWritten || summary.aliasedOrStored || initializer === undefined) return "ambiguous";
        current = initializer;
        continue;
      }
      return "ambiguous";
    }
    return "ambiguous";
  };

  // ---- member correspondence (G8; R2 #23: the one builder, formerly target-analysis source-storage components) -----
  const joinedMemo = new WeakMap<SourceTypeDescriptor, readonly SourceJoinedMember[] | null>();
  const joinedMembers = (type: SourceTypeDescriptor): readonly SourceJoinedMember[] | undefined => {
    const known = joinedMemo.get(type);
    if (known !== undefined) return known ?? undefined;
    const arms = sourceTypeDescriptorPresentArms(type);
    let selected: readonly SourceJoinedMember[] | undefined;
    if (arms.length !== 0 && !arms.some(arm => sourceTypeDescriptorOpenness(ast, arm) === "top")) {
      const perArm: (readonly SourceObjectMember[])[] = [];
      for (const arm of arms) {
        const armMembers = members(arm);
        if (refused(armMembers)) { perArm.length = 0; break; }
        perArm.push(armMembers);
      }
      if (perArm.length === arms.length) {
        const joined: SourceJoinedMember[] = [];
        for (const member of perArm[0]!) {
          const matches = perArm.map(candidates => candidates.find(candidate => candidate.name === member.name));
          if (matches.some(match => match === undefined)) continue;
          const declarations = Object.freeze([...new Set(matches.flatMap(match => match!.declarations))]);
          const getters = Object.freeze(declarations.filter(node => ast.is.IsGetAccessorDeclaration(node)));
          const setters = Object.freeze(declarations.filter(node => ast.is.IsSetAccessorDeclaration(node)));
          const types = matches.map(match => match!.type);
          joined.push(Object.freeze({
            name: member.name,
            optional: matches.some(match => match!.optional),
            readonly: matches.some(match => match!.readonly),
            receiverType: type,
            declarations,
            getters,
            setters,
            read: getters.length > 0 ? "accessor" as const : setters.length > 0 ? "unavailable" as const
              : declarations.some(node => ast.is.IsMethodDeclaration(node) || ast.is.IsMethodSignatureDeclaration(node))
                ? "method" as const : "property" as const,
            type: input.join(types),
          }));
        }
        selected = Object.freeze(joined);
      }
    }
    joinedMemo.set(type, selected ?? null);
    return selected;
  };
  const correspondence = (from: SourceTypeDescriptor, to: SourceTypeDescriptor,
    purpose: "correspondence" | "read"): SourceMemberCorrespondence => {
    const unavailable = (reason: Extract<SourceMemberCorrespondence, { readonly kind: "unavailable" }>["reason"],
      pairs: readonly SourceMemberPair[] = []): SourceMemberCorrespondence => Object.freeze({ kind: "unavailable", reason, pairs });
    if (sourceTypeDescriptorIsAbsent(from) !== sourceTypeDescriptorIsAbsent(to)) return unavailable("disjoint-shape");
    const fromMembers = joinedMembers(from);
    const toMembers = joinedMembers(to);
    if (fromMembers === undefined || toMembers === undefined) return unavailable("unresolved-shape");
    const single = sourceTypeDescriptorPresentArms(from).length === 1 && sourceTypeDescriptorPresentArms(to).length === 1;
    const pairs: SourceMemberPair[] = [];
    let missing = false;
    let unreadable = false;
    for (const destination of toMembers) {
      const selected = fromMembers.find(member => member.name === destination.name);
      if (selected === undefined) {
        if (!destination.optional) missing = true;
        pairs.push(Object.freeze({ kind: "absent", destination }));
        continue;
      }
      if (selected.read === "unavailable") unreadable = true;
      pairs.push(Object.freeze({ kind: "present", destination, source: selected }));
    }
    const frozen = Object.freeze(pairs);
    if (!single) return unavailable("unresolved-shape", frozen);
    if (missing) return unavailable("missing-required-member", frozen);
    if (purpose === "read" && unreadable) return unavailable("unreadable-member", frozen);
    return Object.freeze({ kind: "available", members: frozen, pairs: frozen });
  };
  const correspondingMember = (from: SourceTypeDescriptor, to: SourceTypeDescriptor, declaration: Node,
    purpose: "correspondence" | "read"): SourceMemberPair | undefined => {
    let selected: SourceMemberPair | undefined;
    for (const member of correspondence(from, to, purpose).pairs) {
      if (!member.destination.declarations.includes(declaration)) continue;
      if (member.kind === "present" && member.source.declarations.length === 0) return undefined;
      if (purpose === "read" && member.kind === "present" && member.source.read === "unavailable") return undefined;
      if (selected !== undefined) return undefined;
      selected = member;
    }
    return selected;
  };

  const heritageHasBase = (declaration: Node): boolean => {
    const edges = heritage(declaration);
    return refused(edges) || edges.some(edge => edge.kind === "extends");
  };

  return Object.freeze({
    members: (type: SourceTypeDescriptor) => members(type),
    member(type: SourceTypeDescriptor, key: SourceMemberKey) {
      const selected = members(type);
      return refused(selected) ? undefined : selected.find(member => memberKeysEqual(member.key, key));
    },
    indexes(type: SourceTypeDescriptor) {
      const shape = type.kind === "shape" ? type : type.kind === "declared" ? definitionOf(type, type.declaration) : undefined;
      return shape === undefined || refused(shape) || shape.kind !== "shape" ? Object.freeze([])
        : Object.freeze(shape.indexes.map(index => Object.freeze({
            key: index.key, value: index.value, readonly: index.readonly, declaration: index.declaration,
          })));
    },
    heritage,
    construction,
    selfType,
    implementation,
    callableImplementation,
    contracts,
    ownKeys,
    joinedMembers,
    correspondence,
    correspondingMember,
    refusals: () => census(),
  });

  /**
   * Every object refusal of the program, computed once and in source order, independent of target query order (R5,
   * R2 #30, FX-CC #11). The census asks: the heritage of every class and interface; the construction of every class;
   * the contracts of every named class member, and the implementation of that class for every contract they name; the
   * members of every project class and interface instance type (its Host declared type, values.type of the
   * declaration); and the implementation of every project callable signature. The collection holds the refusal answers
   * of these queries (deduplicated by code and site), so a target that asks the same query later gets an answer that is
   * already in `refusals()`, whichever query ran first.
   */
  function census(): readonly SourceRefusal[] {
    if (censusRefusals !== undefined) return censusRefusals;
    const collected: SourceRefusal[] = [];
    const collect = (answer: unknown): void => {
      if (refused(answer) && !collected.some(entry => entry.code === answer.code && entry.site === answer.site)) {
        collected.push(answer);
      }
    };
    // The instance type of a project class or interface declaration is the declaration's Host type (a value-model fact,
    // not a target query); a refused declaration type is a value-model refusal, collected by the value model.
    const instanceMembers = (declaration: Node): void => {
      if (!navigation.isProjectDeclaration(declaration)) return;
      const type = descriptor(declaration);
      if (!refused(type)) collect(members(type));
    };
    const visit = (node: Node): void => {
      if (ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node)) {
        collect(heritage(node));
        collect(construction(node));
        for (const member of ast.members(node)) {
          if (member === undefined || ast.is.IsConstructorDeclaration(member) || ast.name(member) === undefined) continue;
          const named = contracts(member);
          collect(named);
          if (!refused(named)) for (const contract of named) collect(implementation(node, contract));
        }
        if (ast.is.IsClassDeclaration(node)) instanceMembers(node);
      } else if (ast.is.IsInterfaceDeclaration(node)) {
        collect(heritage(node));
        instanceMembers(node);
      }
      if (isSourceCallableSignatureDeclaration(ast, node) && navigation.isProjectDeclaration(node)) {
        collect(callableImplementation(node));
      }
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    for (const file of input.sourceFiles) visit(file);
    censusRefusals = Object.freeze(collected);
    return censusRefusals;
  }
}

export function memberKeysEqual(left: SourceMemberKey, right: SourceMemberKey): boolean {
  return left.kind === right.kind && (left.kind === "unique-symbol"
    ? left.declaration === (right as typeof left).declaration
    : left.value === (right as typeof left).value);
}

/** A getter's and setter's declarations together (authored order); any other member declaration alone. */
function accessorDeclarations(ast: AstReader, declaration: Node): readonly Node[] {
  if (!ast.is.IsGetAccessorDeclaration(declaration) && !ast.is.IsSetAccessorDeclaration(declaration)) return [declaration];
  const owner = ast.parent(declaration);
  const name = ast.name(declaration);
  if (owner === undefined || name === undefined) return [declaration];
  const text = ast.text(name);
  const static_ = ast.hasModifierKind(declaration, "static");
  const siblings = (ast.is.IsObjectLiteralExpression(owner) ? ast.properties(owner) : ast.members(owner)).filter((member): member is Node => member !== undefined &&
    (ast.is.IsGetAccessorDeclaration(member) || ast.is.IsSetAccessorDeclaration(member)) &&
    ast.hasModifierKind(member, "static") === static_ && ast.name(member) !== undefined && ast.text(ast.name(member)!) === text);
  return siblings.length === 0 ? [declaration] : [...new Set(siblings)];
}

/**
 * Instance initialization in execution order under ES2022 class-field semantics: field initializers in declaration
 * order, then parameter-property assignments, then the constructor body.
 */
function classInitialization(ast: AstReader, declaration: Node):
  readonly { readonly member: Node; readonly region: "parameter-property" | "field" | "constructor-body" }[] {
  const regions: { readonly member: Node; readonly region: "parameter-property" | "field" | "constructor-body" }[] = [];
  const members = ast.members(declaration).filter((member): member is Node => member !== undefined);
  for (const member of members) {
    if (ast.is.IsPropertyDeclaration(member) && !ast.hasModifierKind(member, "static") && sourceClassFieldHasStorage(ast, member)) {
      regions.push(Object.freeze({ member, region: "field" }));
    }
  }
  const constructor = members.find(member => ast.is.IsConstructorDeclaration(member) && ast.body(member) !== undefined);
  if (constructor !== undefined) {
    for (const parameter of ast.parameters(constructor)) {
      if (parameter !== undefined && sourceParameterIsProperty(ast, parameter)) {
        regions.push(Object.freeze({ member: parameter, region: "parameter-property" }));
      }
    }
    regions.push(Object.freeze({ member: constructor, region: "constructor-body" }));
  }
  return Object.freeze(regions);
}

function objectLiteralOwnKeys(ast: AstReader, literal: Node): readonly SourceMemberKey[] | "ambiguous" {
  const names: string[] = [];
  for (const property of ast.properties(literal)) {
    if (property === undefined || ast.is.IsSpreadAssignment(property)) return "ambiguous";
    const name = ast.name(property);
    if (name === undefined || ast.is.IsComputedPropertyName(name)) return "ambiguous";
    const text = ast.text(name);
    if (!names.includes(text)) names.push(text);
  }
  return Object.freeze(orderEnumerableOwnStringProperties(names, name => name)
    .map(name => Object.freeze({ kind: "string" as const, value: name })));
}

function classOwnKeys(ast: AstReader, declaration: Node): readonly SourceMemberKey[] | "ambiguous" {
  const names: string[] = [];
  for (const region of classInitialization(ast, declaration)) {
    if (region.region === "constructor-body") continue;
    const name = ast.name(region.member);
    if (name === undefined || ast.is.IsComputedPropertyName(name) || ast.is.IsPrivateIdentifier(name)) {
      if (name !== undefined && ast.is.IsPrivateIdentifier(name)) continue;
      return "ambiguous";
    }
    const text = ast.text(name);
    if (!names.includes(text)) names.push(text);
  }
  return Object.freeze(orderEnumerableOwnStringProperties(names, name => name)
    .map(name => Object.freeze({ kind: "string" as const, value: name })));
}
