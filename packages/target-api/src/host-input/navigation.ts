// host-input/navigation: the checker input of source-navigation, as Node-keyed records (I3, nextgen plan §2).
// source-navigation reads no checker Type, Signature or Symbol; every symbol identity, declaration selection and
// program membership question it needs is answered here. Records carry declaration and authored-syntax Nodes only.
// R3: no record carries or classifies a checker-inferred value type. The witnesses are selections (which declaration,
// signature, member or module the checker selected) and declaration input (declared members, construct signatures).
import { SymbolFlagsAlias, type AstReader, type CheckedSourceProgram, type Node, type SourceFile, type Symbol,
  type TypeCheckerQueries } from "@tsonic/tsts";
import { selectSourcePropertyDeclaration } from "./semantics-selected-property-declarations.js";
import {
  aliasedSymbol, createSourceNavigationReferenceSelector, primaryDeclaration, symbolAtReferenceNode,
  type SourceNavigationReference,
} from "./navigation-references.js";

export type { SourceNavigationReference } from "./navigation-references.js";

/** One parameter of a selected or declared signature. */
export interface SourceNavigationSignatureParameter {
  readonly parameterIndex: number;
  readonly parameterName: string;
  readonly parameterDeclaration?: Node;
  readonly authoredTypeNode?: Node;
  readonly acceptsOmission: boolean;
  readonly rest: boolean;
}

/** A construct signature of a class value: its declaration (absent for an implicit constructor) and parameters. */
export interface SourceNavigationConstructSignature {
  readonly declaration?: Node;
  readonly parameters: readonly (SourceNavigationSignatureParameter & { readonly parameterDeclaration: Node })[];
}

export type SourceNavigationConstructSignatures =
  | { readonly kind: "signatures"; readonly signatures: readonly SourceNavigationConstructSignature[] }
  | { readonly kind: "unresolved"; readonly site: Node; readonly reason: string };

/** The argument-to-parameter binding the checker selected at a call (indexes into the call record vectors). */
export interface SourceNavigationCallBinding {
  readonly sourceArgumentIndex: number;
  readonly effectiveArgumentIndex: number;
  readonly sourceForm: "value" | "spread-element" | "spread-sequence";
  readonly spreadElementIndex?: number;
  readonly sourceParameterIndex: number;
  readonly sourceParameterForm: "parameter" | "rest-element" | "rest-sequence";
}

/** The checker's selection at a call, `new`, tagged template or `super(...)`, as declarations and syntax. */
export interface SourceNavigationCall {
  readonly call: Node;
  /** "untyped": the callee has no typed signature (the checker selected an any-call). */
  readonly selection: "resolved" | "untyped";
  readonly applicable: boolean;
  readonly optionalChain: boolean;
  /** The selected signature's declaration; absent for a signature with no declaration. */
  readonly signature?: Node;
  readonly callee: Node;
  /** The authored argument expressions, in source order. */
  readonly arguments: readonly Node[];
  readonly bindings: readonly SourceNavigationCallBinding[];
  readonly parameters: readonly SourceNavigationSignatureParameter[];
}

/** The checker's member selection at a property or element access, as declarations. */
export interface SourceNavigationMemberAccess {
  readonly access: Node;
  readonly receiver: Node;
  /** The selected member declaration for the access role (get accessor for reads, set accessor for writes). */
  readonly declaration?: Node;
  /** `declaration`, else every declaration of the selected member and its root members (union/intersection members). */
  readonly declarations: readonly Node[];
  readonly accessMode: "read" | "write" | "read-write" | "delete";
  readonly optionalChain: boolean;
}

export interface SourceNavigationModuleExport {
  readonly exportName: string;
  readonly declaration: Node;
  readonly sourceFile: SourceFile;
}

/** The checker input of source-navigation. One per program view; lifetime is the program's (I5). */
export interface SourceNavigationInput {
  readonly ast: AstReader;
  /** The checked program's source files (project files and libraries), as the program lists them. */
  readonly sourceFiles: readonly (SourceFile | undefined)[];
  containsSourceFile(sourceFile: SourceFile): boolean;
  /**
   * The declaration a reference occurrence selects (identifier, qualified name, property or element access, type
   * reference, heritage expression), imports and aliases resolved. `reserveModuleExports` is told how many module
   * exports an import resolution examined.
   */
  reference(node: Node, reserveModuleExports?: (count: number) => void): SourceNavigationReference | undefined;
  /** All declarations of the entity a declaration declares (overloads, merged declarations, accessor pairs). */
  mergedDeclarations(declaration: Node): readonly Node[];
  /** The declaration a heritage clause element names (aliases resolved); undefined when the checker selects none. */
  heritageTarget(heritage: Node): Node | undefined;
  /** The construct signatures of a class declaration or class expression value. */
  constructSignatures(classDeclaration: Node): SourceNavigationConstructSignatures;
  /**
   * The declarations of the member of the declared instance type of a class/interface declaration that has the same
   * member name as `member`; primary declaration first. Undefined when `member` declares no named member.
   */
  declaredMember(typeDeclaration: Node, member: Node): readonly Node[] | undefined;
  /** Parameters of a callable declaration's own declared signature; undefined when it declares none. */
  declaredParameters(declaration: Node): readonly Node[] | undefined;
  moduleExports(sourceFile: SourceFile): readonly SourceNavigationModuleExport[];
  /** The source file a module specifier resolves to (program module resolution). */
  moduleSourceFile(moduleSpecifier: Node): SourceFile | undefined;
  call(use: Node): SourceNavigationCall | undefined;
  memberAccess(access: Node): SourceNavigationMemberAccess | undefined;
}

export function createSourceNavigationInput(source: CheckedSourceProgram): SourceNavigationInput {
  const { ast } = source;
  const selectReference = createSourceNavigationReferenceSelector(ast);
  const merged = new WeakMap<Node, readonly Node[]>();
  const calls = new WeakMap<Node, SourceNavigationCall | null>();
  const accesses = new WeakMap<Node, SourceNavigationMemberAccess | null>();
  const constructs = new WeakMap<Node, SourceNavigationConstructSignatures>();
  const ignoreModuleExports = (): void => undefined;

  const checkerOf = (node: Node): TypeCheckerQueries => {
    const sourceFile = ast.getSourceFile(node);
    if (sourceFile === undefined) throw new Error("Navigation input requires a node of the checked program.");
    return source.getSourceFileQueries(sourceFile).checker;
  };
  const defined = (nodes: readonly (Node | undefined)[]): readonly Node[] =>
    Object.freeze(nodes.filter((node): node is Node => node !== undefined));
  const declarationSymbol = (declaration: Node): Symbol | undefined => {
    if (ast.is.IsClassExpression(declaration)) {
      const checker = checkerOf(declaration);
      return checker.getTypeSymbol(checker.getTypeAtLocation(declaration));
    }
    return checkerOf(declaration).getSymbolAtLocation(ast.name(declaration) ?? declaration);
  };

  const mergedDeclarations = (declaration: Node): readonly Node[] => {
    const known = merged.get(declaration);
    if (known !== undefined) return known;
    const symbol = declarationSymbol(declaration);
    const declarations = symbol === undefined ? [] : defined(checkerOf(declaration).getSymbolDeclarations(symbol));
    const selected = declarations.includes(declaration) ? declarations : Object.freeze([declaration]);
    merged.set(declaration, selected);
    return selected;
  };

  const constructSignatures = (declaration: Node): SourceNavigationConstructSignatures => {
    const known = constructs.get(declaration);
    if (known !== undefined) return known;
    const selected = selectConstructSignatures(source, declaration, checkerOf);
    constructs.set(declaration, selected);
    return selected;
  };

  const declaredMember = (typeDeclaration: Node, member: Node): readonly Node[] | undefined => {
    const checker = checkerOf(typeDeclaration);
    const memberSymbol = checkerOf(member).getSymbolAtLocation(ast.name(member) ?? member);
    if (memberSymbol === undefined || !checkerOf(member).getSymbolDeclarations(memberSymbol).includes(member)) return undefined;
    const property = checker.getPropertyOfType(
      checker.getDeclaredTypeOfSymbol(declarationSymbol(typeDeclaration)), checker.getSymbolName(memberSymbol));
    if (property === undefined) return Object.freeze([]);
    const primary = primaryDeclaration(checker, property);
    const declarations = defined(checker.getSymbolDeclarations(property));
    return Object.freeze(primary === undefined ? declarations : [primary, ...declarations.filter(entry => entry !== primary)]);
  };

  const call = (use: Node): SourceNavigationCall | undefined => {
    const known = calls.get(use);
    if (known !== undefined) return known ?? undefined;
    const checker = checkerOf(use);
    const info = checker.getResolvedCallInfo(use);
    const selected = info === undefined ? undefined : Object.freeze({
      call: info.call,
      selection: info.sourceSelectedSignatureKind,
      applicable: info.outcome === "applicable",
      optionalChain: info.optionalChain,
      ...((): { readonly signature?: Node } => {
        const signature = checker.getSignatureDeclaration(info.selectedSignature);
        return signature === undefined ? {} : { signature };
      })(),
      callee: info.sourceCallee.expression,
      arguments: Object.freeze(info.sourceArguments.map(argument => argument.expression)),
      bindings: Object.freeze(info.sourceArgumentBindings.map(binding => Object.freeze({
        sourceArgumentIndex: binding.sourceArgumentIndex,
        effectiveArgumentIndex: binding.effectiveArgumentIndex,
        sourceForm: binding.sourceForm,
        ...(binding.spreadElementIndex === undefined ? {} : { spreadElementIndex: binding.spreadElementIndex }),
        sourceParameterIndex: binding.sourceParameterIndex,
        sourceParameterForm: binding.sourceParameterForm,
      }))),
      parameters: Object.freeze(info.sourceSelectedSignatureParameters.map(parameter => Object.freeze({
        parameterIndex: parameter.parameterIndex,
        parameterName: parameter.parameterName,
        ...(parameter.parameterDeclaration === undefined ? {} : { parameterDeclaration: parameter.parameterDeclaration }),
        ...(parameter.authoredTypeNode === undefined ? {} : { authoredTypeNode: parameter.authoredTypeNode }),
        acceptsOmission: parameter.acceptsOmission,
        rest: parameter.rest,
      }))),
    });
    calls.set(use, selected ?? null);
    return selected;
  };

  const memberAccess = (access: Node): SourceNavigationMemberAccess | undefined => {
    const known = accesses.get(access);
    if (known !== undefined) return known ?? undefined;
    const checker = checkerOf(access);
    const selected = ast.is.IsPropertyAccessExpression(access) ? propertyAccess(ast, checker, access)
      : ast.is.IsElementAccessExpression(access) ? elementAccess(checker, access) : undefined;
    accesses.set(access, selected ?? null);
    return selected;
  };

  return Object.freeze({
    ast,
    sourceFiles: source.sourceFiles,
    containsSourceFile: (sourceFile: SourceFile) => source.containsSourceFile(sourceFile),
    reference(node: Node, reserveModuleExports: (count: number) => void = ignoreModuleExports) {
      const sourceFile = ast.getSourceFile(node);
      return sourceFile === undefined ? undefined
        : selectReference(source.getSourceFileQueries(sourceFile).checker, node, reserveModuleExports);
    },
    mergedDeclarations,
    heritageTarget(heritage: Node): Node | undefined {
      const reference = ast.is.IsExpressionWithTypeArguments(heritage)
        ? ast.as.AsExpressionWithTypeArguments(heritage)?.Expression : heritage;
      if (reference === undefined || ast.getSourceFile(reference) === undefined) return undefined;
      const checker = checkerOf(reference);
      const selected = symbolAtReferenceNode(ast, checker, reference);
      return primaryDeclaration(checker, aliasedSymbol(ast, checker, selected) ?? selected);
    },
    constructSignatures,
    declaredMember,
    declaredParameters(declaration: Node): readonly Node[] | undefined {
      const checker = checkerOf(declaration);
      const signature = checker.getSignatureFromDeclaration(declaration);
      return signature === undefined ? undefined : signatureParameterDeclarations(ast, checker, signature);
    },
    moduleExports(sourceFile: SourceFile): readonly SourceNavigationModuleExport[] {
      const checker = source.getSourceFileQueries(sourceFile).checker;
      const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
      if (moduleSymbol === undefined) return Object.freeze([]);
      const exports: SourceNavigationModuleExport[] = [];
      for (const exported of checker.getExportsOfModule(moduleSymbol)) {
        if (exported === undefined) continue;
        const declaration = primaryDeclaration(checker, aliasedSymbol(ast, checker, exported) ?? exported);
        const declarationFile = ast.getSourceFile(declaration);
        if (declaration === undefined || declarationFile === undefined) continue;
        exports.push(Object.freeze({ exportName: checker.getSymbolName(exported), declaration, sourceFile: declarationFile }));
      }
      return Object.freeze(exports);
    },
    moduleSourceFile: (moduleSpecifier: Node) => source.resolveModuleSourceFile(moduleSpecifier),
    call,
    memberAccess,
  });
}

function signatureParameterDeclarations(
  ast: AstReader, checker: TypeCheckerQueries, signature: NonNullable<ReturnType<TypeCheckerQueries["getSignatureFromDeclaration"]>>,
): readonly Node[] | undefined {
  const parameters: Node[] = [];
  for (const symbol of checker.getSignatureParameters(signature)) {
    const parameter = symbol === undefined ? undefined : checker.getPrimarySymbolDeclaration(symbol);
    if (parameter === undefined || !ast.is.IsParameterDeclaration(parameter) || parameters.includes(parameter)) return undefined;
    parameters.push(parameter);
  }
  return Object.freeze(parameters);
}

function selectConstructSignatures(
  source: CheckedSourceProgram,
  declaration: Node,
  checkerOf: (node: Node) => TypeCheckerQueries,
): SourceNavigationConstructSignatures {
  const { ast } = source;
  const unresolved = (site: Node, reason: string): SourceNavigationConstructSignatures =>
    Object.freeze({ kind: "unresolved", site, reason });
  const name = ast.name(declaration);
  const sourceFile = ast.getSourceFile(declaration);
  const expression = ast.is.IsClassExpression(declaration);
  if ((!expression && name === undefined) || sourceFile === undefined) {
    return unresolved(declaration, "The project class has no exact source declaration.");
  }
  const queries = source.getSourceFileQueries(sourceFile);
  const checker = checkerOf(declaration);
  const symbol = name === undefined ? undefined : checker.getSymbolAtLocation(name);
  const valueType = expression ? checker.getTypeAtLocation(declaration)
    : symbol === undefined ? undefined : checker.getTypeOfSymbol(symbol);
  const rawSignatures = valueType === undefined ? [] : checker.getConstructSignaturesOfType(valueType);
  const signatures = rawSignatures.filter((signature): signature is NonNullable<typeof signature> => signature !== undefined);
  if (valueType === undefined || signatures.length === 0 || signatures.length !== rawSignatures.length) {
    return unresolved(declaration,
      "The checked source program did not provide an effective constructor signature for the project class.");
  }
  const selected: SourceNavigationConstructSignature[] = [];
  for (const signature of signatures) {
    const parameters: (SourceNavigationSignatureParameter & { readonly parameterDeclaration: Node })[] = [];
    const requiredParameterCount = queries.typeShape.getSignatureParameterInfos(signature)
      .filter(parameter => !parameter.acceptsOmission).length;
    const parameterSymbols = checker.getSignatureParameters(signature);
    for (let index = 0; index < parameterSymbols.length; index += 1) {
      const parameterSymbol = parameterSymbols[index];
      if (parameterSymbol === undefined) {
        return unresolved(declaration, "An effective constructor signature contains an absent selected parameter symbol.");
      }
      const parameterDeclaration = checker.getPrimarySymbolDeclaration(parameterSymbol);
      const parameter = parameterDeclaration === undefined ? undefined : ast.as.AsParameterDeclaration(parameterDeclaration);
      if (parameterDeclaration === undefined || !ast.is.IsParameterDeclaration(parameterDeclaration) || parameter === undefined) {
        return unresolved(declaration, "A non-empty effective constructor signature has no exact parameter declaration.");
      }
      const parameterName = checker.getSymbolName(parameterSymbol);
      if (parameterName.length === 0) {
        return unresolved(parameterDeclaration, "The selected constructor parameter has no exact name.");
      }
      parameters.push(Object.freeze({
        parameterIndex: index,
        parameterName,
        parameterDeclaration,
        ...(parameter.Type === undefined ? {} : { authoredTypeNode: parameter.Type }),
        acceptsOmission: index >= requiredParameterCount,
        rest: parameter.DotDotDotToken !== undefined,
      }));
    }
    const signatureDeclaration = checker.getSignatureDeclaration(signature);
    selected.push(Object.freeze({
      ...(signatureDeclaration === undefined ? {} : { declaration: signatureDeclaration }),
      parameters: Object.freeze(parameters),
    }));
  }
  return Object.freeze({ kind: "signatures", signatures: Object.freeze(selected) });
}

function memberDeclarations(checker: TypeCheckerQueries, symbol: Symbol | undefined): readonly Node[] {
  if (symbol === undefined) return Object.freeze([]);
  const declarations = new Set<Node>();
  for (const member of [symbol, ...checker.getRootSymbols(symbol)]) {
    if (member === undefined) continue;
    const selected = (member.Flags & SymbolFlagsAlias) === 0 ? member : checker.getAliasedSymbol(member);
    for (const declaration of checker.getSymbolDeclarations(selected)) if (declaration !== undefined) declarations.add(declaration);
  }
  return Object.freeze([...declarations]);
}

// The property-access declaration normalization of source-semantics (normalizeSourcePropertyAccessDeclarations):
// an accessor pair selects the get accessor for reads and the set accessor for writes.
function propertyAccess(ast: AstReader, checker: TypeCheckerQueries, access: Node): SourceNavigationMemberAccess | undefined {
  const info = checker.getResolvedPropertyAccessInfo(access);
  if (info === undefined) return undefined;
  const role = info.accessMode === "write" ? "write" : "read";
  const all = memberDeclarations(checker, info.selectedSymbol);
  let declaration = info.selectedDeclaration;
  if (declaration === undefined || (role === "read" ? ast.is.IsSetAccessorDeclaration(declaration)
    : ast.is.IsGetAccessorDeclaration(declaration))) {
    const read = info.accessMode === "write" ? undefined : selectSourcePropertyDeclaration(ast, all, "read");
    const write = info.writable && (info.accessMode === "write" || info.accessMode === "read-write")
      ? selectSourcePropertyDeclaration(ast, all, "write") : undefined;
    const consistent = (info.selectedReadDeclaration === undefined || info.selectedReadDeclaration === read) &&
      (info.selectedWriteDeclaration === undefined || info.selectedWriteDeclaration === write);
    const normalized = role === "write" ? write : read;
    if (all.length > 0 && consistent && normalized !== undefined) declaration = normalized;
  }
  return Object.freeze({
    access,
    receiver: info.receiver.expression,
    ...(declaration === undefined ? {} : { declaration }),
    declarations: declaration === undefined ? all : Object.freeze([declaration]),
    accessMode: info.accessMode,
    optionalChain: info.optionalChain,
  });
}

function elementAccess(checker: TypeCheckerQueries, access: Node): SourceNavigationMemberAccess | undefined {
  const info = checker.getResolvedElementAccessInfo(access);
  if (info === undefined) return undefined;
  const declaration = info.selectedDeclaration;
  return Object.freeze({
    access,
    receiver: info.receiver.expression,
    ...(declaration === undefined ? {} : { declaration }),
    declarations: declaration === undefined ? memberDeclarations(checker, info.selectedSymbol) : Object.freeze([declaration]),
    accessMode: info.accessMode,
    optionalChain: info.optionalChain,
  });
}
