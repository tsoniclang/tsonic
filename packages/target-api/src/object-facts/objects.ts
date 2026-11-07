// SourceObjectFacts (G8): heritage, members, construction, implementation, required members, own keys and
// method values, over the existing heritage / member-dispatch / constructor navigation and the value model's
// descriptors. No checker Type is read here; declarations come from navigation, descriptors from SourceValueFacts.
import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceRefusal, SourceValueFacts } from "../public/source/facts.js";
import type {
  SourceConstructFacts, SourceHeritageEdge, SourceMemberImplementation, SourceObjectFacts, SourceObjectMember,
} from "../public/source/objects.js";
import type { SourceSelectionFacts } from "../public/source/selections.js";
import { isSourceCallableSignatureDeclaration, sourceNodeHasRole } from "../source-navigation/callable-boundaries.js";
import { sourceClassFieldHasStorage, sourceParameterIsProperty } from "../source-navigation/class-members.js";
import type { SourceDeclaredHeritageEdge, SourceProgramNavigation } from "../source-navigation/types.js";
import { orderEnumerableOwnStringProperties } from "../source-semantics/enumerable-own-properties.js";
import { sourceTypeDescriptorsEqual } from "../source-semantics/local-type-flow/terms.js";
import type {
  SourceMemberKey, SourceTypeDescriptor, SourceTypeDescriptorMember, SourceTypeDescriptorSignature,
} from "../source-semantics/local-type-flow/types.js";
import { sourceRefusalOfOutcome } from "./selections.js";

export interface SourceObjectFactsInput {
  readonly ast: AstReader;
  readonly navigation: SourceProgramNavigation;
  readonly values: SourceValueFacts;
  readonly selections: SourceSelectionFacts;
  /** The sole substitution (SourceSumFacts.substitute, I6): heritage defaults over earlier bindings. */
  readonly substitute: (type: SourceTypeDescriptor, bindings: ReadonlyMap<Node, SourceTypeDescriptor>) => SourceTypeDescriptor;
}

type Members = readonly SourceObjectMember[] | SourceRefusal;

export function createSourceObjectFacts(input: SourceObjectFactsInput): SourceObjectFacts & {
  refusals(): readonly SourceRefusal[];
} {
  const { ast, navigation, values, selections } = input;
  const raised: SourceRefusal[] = [];
  const raise = (code: string, site: Node, message: string): SourceRefusal => {
    const refusal: SourceRefusal = Object.freeze({ kind: "refused", code, message, site });
    if (!raised.some(entry => entry.code === code && entry.site === site)) raised.push(refusal);
    return refusal;
  };
  const memberMemo = new WeakMap<SourceTypeDescriptor, Members>();
  /** Definitions seen per declaration, to resolve a "recursion" cut to its definition (same declaration + arguments). */
  const definitions = new Map<Node, { readonly typeArguments: readonly SourceTypeDescriptor[]; readonly definition: SourceTypeDescriptor }[]>();
  const heritageMemo = new WeakMap<Node, readonly SourceHeritageEdge[] | SourceRefusal>();
  const constructionMemo = new WeakMap<Node, SourceConstructFacts | SourceRefusal>();

  const descriptor = (node: Node): SourceTypeDescriptor | SourceRefusal => {
    const outcome = values.type(node);
    if (outcome.kind !== "refused") return outcome.type;
    const refusal = sourceRefusalOfOutcome(outcome);
    if (!raised.includes(refusal)) raised.push(refusal);
    return refusal;
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
        case "union": return raise("TSONIC_SOURCE_OBJECT_UNION_MEMBERS", siteOf(type, site),
          "Members of a union value are selected per arm through its union relation, not as one member list.");
        case "declared": {
          const definition = definitionOf(type, siteOf(type, site));
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

  const siteOf = (type: SourceTypeDescriptor, site: Node | undefined): Node => {
    if (site !== undefined) return site;
    if (type.kind === "declared") return type.declaration;
    throw new Error("An object-fact refusal requires a site.");
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
    return Object.freeze({
      kind: edge.kind, declaration: edge.sourceDeclaration, heritage: edge.heritage, target: edge.target.declaration,
      typeArguments: Object.freeze(typeArguments),
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
      return Object.freeze({
        declaration, implicit: result.implicit, signatures: Object.freeze(signatures),
        initialization: classInitialization(ast, declaration),
      });
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
    heritagePath(from: Node, to: Node) {
      const result = navigation.declaredHeritagePath(from, to);
      if (result.kind === "unrelated") return "unrelated" as const;
      if (result.kind === "unresolved") return raise("TSONIC_SOURCE_HERITAGE_UNRESOLVED", result.heritage, result.reason);
      return heritageEdges(result.edges);
    },
    construction,
    implementation,
    callableImplementation,
    contracts(implementationDeclaration: Node) {
      const result = navigation.memberContracts(implementationDeclaration);
      return result.kind === "unresolved"
        ? raise("TSONIC_SOURCE_MEMBER_CONTRACTS_UNRESOLVED", result.declaration, result.reason)
        : result.contracts;
    },
    requiredMembers(objectLiteral: Node) {
      const outcome = values.type(objectLiteral);
      if (outcome.kind === "refused") return Object.freeze([]);
      const destination = outcome.construction ?? outcome.type;
      const selected = members(destination, objectLiteral);
      return refused(selected) ? Object.freeze([]) : Object.freeze(selected.filter(member => !member.optional && !member.static));
    },
    ownKeys,
    refusals: () => Object.freeze([...raised]),
  });
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
  const siblings = [...ast.members(owner), ...ast.properties(owner)].filter((member): member is Node => member !== undefined &&
    (ast.is.IsGetAccessorDeclaration(member) || ast.is.IsSetAccessorDeclaration(member)) &&
    ast.hasModifierKind(member, "static") === static_ && ast.name(member) !== undefined && ast.text(ast.name(member)!) === text);
  return siblings.length === 0 ? [declaration] : [...new Set(siblings)];
}

/**
 * Instance initialization in execution order under ES2022 class-field semantics: field initializers in declaration
 * order, then parameter-property assignments, then the constructor body.
 */
function classInitialization(ast: AstReader, declaration: Node): SourceConstructFacts["initialization"] {
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
