// host-input/navigation: the checker input of source-navigation, as Node-keyed records (I3, nextgen plan §2).
// source-navigation reads no checker Type, Signature or Symbol; every symbol identity, declaration selection and
// program membership question it needs is answered here. Records carry declaration and authored-syntax Nodes only.
// R3: no record carries or classifies a checker-inferred value type. The witnesses are selections (which declaration,
// signature, member or module the checker selected) and declaration input (declared members, construct signatures).
// This module is the one translator of a checker call selection and of a checker member-access selection (R2 #1, #2):
// SourceHostInput.call/.member (index.ts), HostCheckerInput.call/.memberAccess (objects.ts) and the per-file checker
// views (semantics-program.ts operations.propertyAccess) project from the records built here. The records are defined
// in the checker-free source-model/navigation-records.ts.
import type {
  AstReader, CheckedSourceProgram, Node, ResolvedSourcePropertyAccessInfo, SourceFile, SourceFileQueries, Symbol, TypeCheckerQueries,
} from "@tsonic/tsts";
import type {
  SourceNavigationCall, SourceNavigationConstructSignature, SourceNavigationConstructSignatures, SourceNavigationInput,
  SourceNavigationMemberAccess, SourceNavigationModuleExport, SourceNavigationReference, SourceNavigationSignatureParameter,
} from "../source-model/navigation-records.js";
import {
  normalizeSourcePropertyAccessDeclarations, selectedSourcePropertyDeclarations, type SourcePropertySelectionQueries,
} from "./semantics-selected-property-declarations.js";
import { selectRefinedSourcePropertyAccess } from "./semantics-property-refinement.js";
import { selectSourceTypeRefinement } from "./semantics-type-refinement.js";
import { sourceDeclarationSymbol, sourceDeclaredValueType } from "./navigation-checker.js";
import { aliasedSymbol, createSourceNavigationReferenceSelector, primaryDeclaration, symbolAtReferenceNode } from "./navigation-references.js";

export function createSourceNavigationInput(source: CheckedSourceProgram): SourceNavigationInput {
  const { ast } = source;
  const selectReference = createSourceNavigationReferenceSelector(ast);
  const merged = new WeakMap<Node, readonly Node[]>();
  const calls = new WeakMap<Node, SourceNavigationCall | null>();
  const accesses = new WeakMap<Node, SourceNavigationMemberAccess | null>();
  const constructs = new WeakMap<Node, SourceNavigationConstructSignatures>();
  const ignoreModuleExports = (): void => undefined;

  const queriesOf = (node: Node): SourceFileQueries => {
    const sourceFile = ast.getSourceFile(node);
    if (sourceFile === undefined) throw new Error("Navigation input requires a node of the checked program.");
    return source.getSourceFileQueries(sourceFile);
  };
  const checkerOf = (node: Node): TypeCheckerQueries => queriesOf(node).checker;
  const defined = <T>(values: readonly (T | undefined)[]): readonly T[] =>
    Object.freeze(values.filter((value): value is T => value !== undefined));
  // The declaration's symbol in its own file's checker: the one declaration -> symbol selector (navigation-checker.ts).
  const declarationSymbol = (declaration: Node): Symbol | undefined => sourceDeclarationSymbol(ast, checkerOf(declaration), declaration);
  // Program membership: the project's own implementation files (no declaration files, no provider virtual modules).
  const projectSourceFiles = Object.freeze(source.sourceFiles.filter((sourceFile): sourceFile is SourceFile =>
    sourceFile !== undefined && !sourceFile.IsDeclarationFile && !ast.getFileName(sourceFile).startsWith("tsts-provider://")));
  const projectFiles = new Set<SourceFile>(projectSourceFiles);
  const isProjectNode = (node: Node | undefined): boolean => {
    const sourceFile = node === undefined ? undefined : ast.getSourceFile(node);
    return sourceFile !== undefined && projectFiles.has(sourceFile);
  };
  const reference = (node: Node, reserveModuleExports: (count: number) => void = ignoreModuleExports): SourceNavigationReference | undefined => {
    const sourceFile = ast.getSourceFile(node);
    return sourceFile === undefined ? undefined
      : selectReference(source.getSourceFileQueries(sourceFile).checker, node, reserveModuleExports);
  };
  const selectionQueries = new WeakMap<SourceFileQueries, SourcePropertySelectionQueries>();
  const selectionQueriesOf = (queries: SourceFileQueries): SourcePropertySelectionQueries => {
    let selected = selectionQueries.get(queries);
    if (selected === undefined) {
      const { checker, typeShape } = queries;
      selected = Object.freeze({
        declarations: Object.freeze({
          rootSymbols: (symbol: Symbol) => defined(checker.getRootSymbols(symbol)),
          aliasedSymbol: (symbol: Symbol) => checker.getAliasedSymbol(symbol),
          symbolDeclarations: (symbol: Symbol) => defined(checker.getSymbolDeclarations(symbol)),
        }),
        types: Object.freeze({ propertyInfos: typeShape.getPropertyInfos }),
      });
      selectionQueries.set(queries, selected);
    }
    return selected;
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
      ...(info.sourceReceiver === undefined ? {} : { receiver: info.sourceReceiver.expression }),
      ...(info.sourceCalleeAccess === undefined ? {} : { calleeAccess: Object.freeze({ kind: info.sourceCalleeAccess.kind,
        ...((): { readonly declaration?: Node } => {
          const access = info.sourceCalleeAccess;
          const declaration = access?.kind === "property" ? access.selectedDeclaration ?? access.declaration : undefined;
          return declaration === undefined ? {} : { declaration };
        })() }) }),
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
    const queries = queriesOf(access);
    const selected = ast.is.IsPropertyAccessExpression(access) ? propertyAccess(access, queries)
      : ast.is.IsElementAccessExpression(access) ? elementAccess(access, queries) : undefined;
    accesses.set(access, selected ?? null);
    return selected;
  };

  // A property access: the checker selection, role-normalized (an accessor pair selects the get accessor for reads and
  // the set accessor for writes) and, for an unselected read through a narrowed project reference, the member of the
  // one refined receiver arm (selectRefinedSourcePropertyAccess). The one property-access declaration answer.
  function propertyAccess(access: Node, queries: SourceFileQueries): SourceNavigationMemberAccess | undefined {
    const info = queries.checker.getResolvedPropertyAccessInfo(access);
    if (info === undefined) return undefined;
    const selectedQueries = selectionQueriesOf(queries);
    const normalized = normalizeSourcePropertyAccessDeclarations(ast, selectedQueries, info);
    const selected = refinedPropertyAccess(normalized, queries);
    return memberAccessRecord(access, selected.receiver.expression, selected.selectedDeclaration,
      selected.selectedReadDeclaration, selected.selectedWriteDeclaration,
      () => selectedSourcePropertyDeclarations(selectedQueries, undefined, selected.selectedSymbol) ?? [],
      selected.accessMode, selected.optionalChain, selected.callCallee);
  }

  function refinedPropertyAccess(selected: ResolvedSourcePropertyAccessInfo, queries: SourceFileQueries): ResolvedSourcePropertyAccessInfo {
    if (selected.selectedDeclaration !== undefined || selected.selectedSymbol === undefined || selected.accessMode !== "read") return selected;
    const receiver = selected.receiver.expression;
    if (!isProjectNode(receiver) || ast.is.IsTypeQueryNode(receiver)) return selected;
    const selectedReference = reference(receiver);
    if (selectedReference === undefined || !isProjectNode(selectedReference.declaration)) return selected;
    const { checker, typeShape } = queries;
    const declaredType = sourceDeclaredValueType(ast, checker, declaration => sourceDeclarationSymbol(ast, checker, declaration),
      selectedReference.declaration);
    if (declaredType === undefined) return selected;
    const selectedType = selected.receiver.type;
    return selectRefinedSourcePropertyAccess(selected, Object.freeze({ kind: "resolved", reference: selectedReference,
      declaredType, selectedType, refinement: selectSourceTypeRefinement(typeShape, checker, source.sourceFacts, declaredType, selectedType) }),
      checker, typeShape, source.sourceFacts, ast);
  }

  function elementAccess(access: Node, queries: SourceFileQueries): SourceNavigationMemberAccess | undefined {
    const info = queries.checker.getResolvedElementAccessInfo(access);
    if (info === undefined) return undefined;
    return memberAccessRecord(access, info.receiver.expression, info.selectedDeclaration, undefined, undefined,
      () => selectedSourcePropertyDeclarations(selectionQueriesOf(queries), undefined, info.selectedSymbol) ?? [],
      info.accessMode, info.optionalChain, info.callCallee);
  }

  return Object.freeze({
    ast,
    sourceFiles: source.sourceFiles,
    projectSourceFiles,
    containsSourceFile: (sourceFile: SourceFile) => source.containsSourceFile(sourceFile),
    reference,
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

function memberAccessRecord(access: Node, receiver: Node, declaration: Node | undefined, read: Node | undefined,
  write: Node | undefined, members: () => readonly Node[], accessMode: SourceNavigationMemberAccess["accessMode"],
  optionalChain: boolean, callCallee: boolean): SourceNavigationMemberAccess {
  const selected = [...new Set([read, declaration, write].filter((node): node is Node => node !== undefined))];
  return Object.freeze({
    access,
    receiver,
    ...(declaration === undefined ? {} : { declaration }),
    ...(read === undefined ? {} : { readDeclaration: read }),
    ...(write === undefined ? {} : { writeDeclaration: write }),
    declarations: Object.freeze(selected.length > 0 ? selected : [...members()]),
    accessMode,
    optionalChain,
    callCallee,
  });
}
