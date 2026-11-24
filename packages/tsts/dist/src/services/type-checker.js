import { checkerBackingConstraints } from "../internal/checker/checker/backing-constraint-evidence.js";
import { Background } from "../go/context.js";
import { Node_Arguments, Node_Expression, Node_PropertyNameOrName, Node_Symbol, Node_Text, SourceFile_FileName, SourceFile_Path } from "../internal/ast/ast.js";
import { AsExportDeclaration } from "../internal/ast/generated/casts.js";
import { LinkStore_TryGet } from "../internal/core/linkstore.js";
import { Node_Name } from "../internal/ast/spine.js";
import { readTypeIndexInfo, readTypePropertyHeader } from "./type-members.js";
import { readInvocationReturnType } from "./signature-returns.js";
import { sourceModuleLink } from "./source-module-link.js";
import { acquireLeasedChecker, withOwnedChecker, withCheckerById, withSourceFileChecker } from "./checker-ownership.js";
import { sourceTypeAnswer } from "../internal/checker/checker/source-type-answers.js";
import { admitSourceTypeAnswer, querySourceType, readSourceType, settleSourceTypeAnswer } from "./source-type-answer.js";
import { admitNativeChecker } from "../internal/checker/resource-admission.js";
import { NodeFlagsOptionalChain, SymbolFlagsAlias, SymbolFlagsNamespace, SymbolFlagsType, SymbolFlagsValue, } from "../internal/ast/generated/flags.js";
import { IsElementAccessExpression, IsAwaitExpression, IsExportDeclaration, IsExportSpecifier, IsGetAccessorDeclaration, IsIdentifier, IsImportSpecifier, IsNamespaceExport, IsNamespaceImport, IsObjectLiteralExpression, IsMethodDeclaration, IsMethodSignatureDeclaration, IsPropertyAccessExpression, IsPropertyAssignment, IsPropertyDeclaration, IsPropertySignatureDeclaration, IsSetAccessorDeclaration, IsShorthandPropertyAssignment, } from "../internal/ast/generated/predicates.js";
import { GetSourceFileOfNode, GetContainingFunction, IsCallOrNewExpression, IsFunctionLike, IsObjectLiteralMethod, IsOuterExpression, IsPropertyName, IsDynamicName, IsImportCall, IsInExpressionContext, IsRightSideOfQualifiedNameOrPropertyAccess, ModuleExportNameIsDefault, OEKAssertions, OEKParentheses, SkipOuterExpressions, SkipParentheses, } from "../internal/ast/utilities.js";
import { Program_GetSourceFile, Program_GetTypeChecker, Program_HasUsableCheckerSession, Program_IsSourceFileDefaultLibrary } from "../internal/compiler/program.js";
import { CheckerLifetimeAPI, CheckerLifetimeDiagnostics, WithCheckerLifetime } from "../internal/core/context.js";
import { getExtensionHost } from "../extensions/host.js";
import { Checker_GetPropertyOfType, Checker_GetPropertiesOfType, Checker_ResolveName, Checker_GetSignaturesOfType, Checker_GetTypeOfPropertyOfType, } from "../internal/checker/exports.js";
import { Checker_getCompletedCallEvidence, Checker_getResolvedSignature, } from "../internal/checker/checker/signatures.js";
import { CheckModeNormal, getNumberLiteralValue } from "../internal/checker/checker/state.js";
import { Checker_GetAliasedSymbol, Checker_getResolvedSourceElementAccessInfo, Checker_getResolvedSourcePropertyAccessInfo, Checker_GetSymbolAtLocation, Checker_getDeclarationOfAliasSymbol, Checker_getDeclaredTypeOfSymbol, Checker_getEffectivePropertyNameForPropertyNameNode, Checker_getExportSymbolOfValueSymbolIfExported, Checker_getIdentifierAssignmentError, Checker_getImmediateAliasedSymbol, Checker_getLiteralTypeFromPropertyName, Checker_getTypeOfPropertyOfContextualTypeEx, Checker_getResolvedSymbolOrNil, Checker_getModuleSpecifierForImportOrExport, Checker_getExportsOfModule, Checker_getTypeOfSymbol, Checker_getWriteTypeOfSymbol, Checker_resolveExternalModuleName, Checker_resolveExternalModuleSymbol, isSourceModuleBinding, retainedAliasFailure, } from "../internal/checker/checker/symbols.js";
import { Checker_getApparentTypeOfContextualType, Checker_getAwaitedType, Checker_GetTypeAtLocation, } from "../internal/checker/checker/types.js";
import { Checker_isAssignmentToReadonlyEntity } from "../internal/checker/checker/relations.js";
import { AssignmentKindDefinite, AssignmentKindNone, getAssignmentTargetKind, isReservedMemberName } from "../internal/checker/utilities.js";
import { Checker_getResolvedSourceIterationInfo } from "../internal/checker/checker/syntax-checking.js";
import { Checker_GetConstantValue, Checker_GetRootSymbols, Checker_GetSignatureFromDeclaration, } from "../internal/checker/services.js";
import { Checker_TypeToString } from "../internal/checker/printer.js";
import { ContextFlagsNone, SignatureKindCall, SignatureKindConstruct, TypeFlagsNumberLiteral, TypeFlagsStringLiteral, TypeFlagsUniqueESSymbol } from "../internal/checker/types.js";
import { Number_String } from "../internal/jsnum/string.js";
import { resolveSourceCallableCompletionInfo, resolveSourceGeneratorInfo, resolveSourceResourceManagementInfo, resolveSourceWellKnownSymbolInfo, resolveSourceYieldInfo, } from "./source-control-flow-evidence.js";
import { resolveSourceFlowConditionInfo } from "./source-flow-conditions.js";
export function createTypeCheckerQueries(program, defaultOptions) {
    if (program === undefined || defaultOptions.sourceFile === undefined) {
        throw new Error("Type-checker queries require one source file from the compiler program.");
    }
    const callInfos = new WeakMap();
    const readCall = (node, acquisition) => {
        if (node === undefined || !IsCallOrNewExpression(node))
            return { kind: "unavailable" };
        const context = defaultOptions.context ?? Background();
        const result = withSourceFileChecker(program, defaultOptions.sourceFile, GetSourceFileOfNode(node), context, (checker) => {
            const read = () => {
                admitNativeChecker(checker, "work");
                const known = callInfos.get(node);
                if (known !== undefined)
                    return known;
                if (acquisition.kind === "produce")
                    Checker_getResolvedSignature(checker, node, undefined, CheckModeNormal);
                const selected = Checker_getCompletedCallEvidence(checker, node, acquisition.kind === "produce" ? () => Checker_GetTypeAtLocation(checker, node) : null);
                if (selected !== undefined) {
                    admitNativeChecker(checker, "retained");
                    callInfos.set(node, selected);
                }
                return selected;
            };
            return acquisition.kind === "produce" ? { kind: "complete", value: read() }
                : acquireLeasedChecker(checker, WithCheckerLifetime(context, CheckerLifetimeDiagnostics), acquisition.admit, read);
        });
        if (result === undefined || result.kind === "unavailable")
            return { kind: "unavailable" };
        if (result.kind === "refused")
            return result;
        return result.value === undefined ? { kind: "unavailable" } : { kind: "complete", value: result.value };
    };
    const propertyNames = new WeakMap();
    const propertyAccessInfos = new WeakMap();
    const readProperty = (node, admit) => {
        if (node === undefined || !IsPropertyAccessExpression(node))
            return { kind: "unavailable" };
        const context = defaultOptions.context ?? Background();
        const result = withSourceFileChecker(program, defaultOptions.sourceFile, GetSourceFileOfNode(node), context, checker => acquireLeasedChecker(checker, WithCheckerLifetime(context, CheckerLifetimeDiagnostics), admit, () => {
            admitNativeChecker(checker, "work");
            const known = propertyAccessInfos.get(node);
            if (known !== undefined)
                return known;
            const selected = Checker_getResolvedSourcePropertyAccessInfo(checker, node);
            if (selected === undefined)
                return undefined;
            const exported = isSyntheticDefaultMember(checker, selected.sourceSymbol);
            if (exported)
                admitNativeChecker(checker, "retained");
            const offered = exported
                ? { kind: "module-exported-value", target: exportedValueBoundary(checker, node) }
                : withResolvedPropertyAccessEvidence(checker, selected);
            if (offered !== undefined) {
                admitNativeChecker(checker, "retained");
                propertyAccessInfos.set(node, Object.freeze(offered));
            }
            return offered;
        }));
        if (result === undefined || result.kind === "unavailable")
            return { kind: "unavailable" };
        if (result.kind === "refused")
            return result;
        return result.value === undefined ? { kind: "unavailable" } : { kind: "complete", value: result.value };
    };
    const elementAccessInfos = new WeakMap();
    const iterationInfos = new WeakMap();
    const objectLiteralElementInfos = new WeakMap();
    const objectLiteralElementSymbols = new WeakMap();
    const storageInfos = new WeakMap();
    const readStorage = (node, admit) => {
        if (node === undefined)
            return { kind: "unavailable" };
        const context = defaultOptions.context ?? Background();
        let known;
        const head = withSourceFileChecker(program, defaultOptions.sourceFile, GetSourceFileOfNode(node), context, (checker) => {
            const read = () => {
                admitNativeChecker(checker, "work");
                known = storageInfos.get(node);
                const selected = known ?? getResolvedSourceStorageInfo(checker, node);
                if (selected === undefined)
                    return undefined;
                const type = admitSourceTypeAnswer(selected.type, defaultOptions.admitsCheckerDiagnostic, checker);
                if (type === selected.type)
                    return selected;
                admitNativeChecker(checker, "retained");
                return Object.freeze({ ...selected, type });
            };
            return admit === null ? { kind: "complete", value: read() }
                : acquireLeasedChecker(checker, WithCheckerLifetime(context, CheckerLifetimeDiagnostics), admit, read);
        });
        if (head === undefined || head.kind === "unavailable")
            return { kind: "unavailable" };
        if (head.kind === "refused")
            return head;
        const selected = head.value;
        if (selected === undefined)
            return { kind: "unavailable" };
        const type = settleSourceTypeAnswer(program, defaultOptions, selected.type, admit);
        if (type.kind !== "complete")
            return type;
        if (selected === known && type.value === selected.type)
            return { kind: "complete", value: selected };
        const stop = admit?.("retained", type.value === selected.type ? 1 : 2) ?? null;
        if (stop !== null)
            return { kind: "refused", stop };
        const completed = type.value === selected.type ? selected : Object.freeze({ ...selected, type: type.value });
        storageInfos.set(node, completed);
        return { kind: "complete", value: completed };
    };
    const callableCompletionInfos = new WeakMap();
    const flowConditionInfos = new WeakMap();
    const generatorInfos = new WeakMap();
    const yieldInfos = new WeakMap();
    const wellKnownSymbolInfos = new WeakMap();
    const resourceManagementInfos = new WeakMap();
    const queries = {
        getBackingConstraints() {
            const constraints = withCheckedFile(program, defaultOptions.sourceFile, defaultOptions, checker => {
                if (checker === undefined)
                    throw new Error("Backing-constraint queries require the original checked program.");
                return checkerBackingConstraints(checker);
            });
            if (constraints === undefined)
                throw new Error("Backing-constraint queries lost their checked lifetime.");
            return constraints;
        },
        getGlobalValueSymbol(name) {
            if (Program_GetSourceFile(program, SourceFile_FileName(defaultOptions.sourceFile)) !== defaultOptions.sourceFile)
                return undefined;
            return withChecker(program, defaultOptions.sourceFile, defaultOptions, checker => {
                const symbol = checker?.globals.get(name);
                return symbol !== undefined && (symbol.Flags & SymbolFlagsValue) !== 0 ? symbol : undefined;
            });
        },
        isDefaultLibraryDeclaration(node) {
            if (Program_GetSourceFile(program, SourceFile_FileName(defaultOptions.sourceFile)) !== defaultOptions.sourceFile)
                return false;
            const file = GetSourceFileOfNode(node);
            return file !== undefined && Program_GetSourceFile(program, SourceFile_FileName(file)) === file &&
                Program_IsSourceFileDefaultLibrary(program, SourceFile_Path(file));
        },
        getAwaitedType(type) {
            return withOwnedChecker(program, defaultOptions.sourceFile, type?.checker, defaultOptions.context ?? Background(), owner => Checker_getAwaitedType(owner, type));
        },
        acquireSourceType: (request, admit) => readSourceType(program, defaultOptions, request, admit),
        getTypeAtLocation: (node) => querySourceType(program, defaultOptions, { kind: "expression", node }),
        getTypeFromTypeNode: (node) => querySourceType(program, defaultOptions, { kind: "annotation", node }),
        getContextualType: (node, flags = ContextFlagsNone) => querySourceType(program, defaultOptions, { kind: "contextual", node, flags }),
        getEffectivePropertyName(node) {
            if (node === undefined)
                return undefined;
            const cached = propertyNames.get(node);
            if (cached !== undefined)
                return cached ?? undefined;
            const selected = withCheckerForNode(program, node, defaultOptions, checker => {
                if (!IsPropertyName(node))
                    return undefined;
                const [literalName, present] = Checker_getEffectivePropertyNameForPropertyNameNode(checker, node);
                if (!present)
                    return undefined;
                const type = Checker_getLiteralTypeFromPropertyName(checker, node);
                if (type === undefined)
                    return undefined;
                const declaration = node.Parent;
                const staticallyBound = declaration !== undefined && !IsDynamicName(node) &&
                    (IsPropertyDeclaration(declaration) || IsPropertySignatureDeclaration(declaration) ||
                        IsMethodDeclaration(declaration) || IsMethodSignatureDeclaration(declaration) ||
                        IsGetAccessorDeclaration(declaration) || IsSetAccessorDeclaration(declaration)) &&
                    !IsObjectLiteralExpression(declaration.Parent);
                const symbol = staticallyBound ? Node_Symbol(declaration) : undefined;
                if (staticallyBound && symbol === undefined)
                    return undefined;
                const name = staticallyBound ? symbol.Name : literalName;
                if ((type.flags & TypeFlagsUniqueESSymbol) !== 0)
                    return Object.freeze({ kind: "unique-symbol", name, type });
                if ((type.flags & TypeFlagsNumberLiteral) !== 0)
                    return Object.freeze({ kind: "numeric",
                        name: staticallyBound ? name : Number_String(getNumberLiteralValue(type)), type });
                if ((type.flags & TypeFlagsStringLiteral) !== 0)
                    return Object.freeze({ kind: "string", name, type });
                return undefined;
            });
            propertyNames.set(node, selected ?? null);
            return selected;
        },
        getSymbolAtLocation: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_GetSymbolAtLocation(checker, node)),
        getLexicallyResolvedSymbol: (identifier) => withCheckerForNode(program, identifier, defaultOptions, (checker) => IsIdentifier(identifier)
            ? Checker_ResolveName(checker, Node_Text(identifier), identifier, (SymbolFlagsValue | SymbolFlagsType | SymbolFlagsNamespace | SymbolFlagsAlias), false)
            : undefined),
        getResolvedSymbol: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => getDiagnosticFreeResolvedSymbol(checker, node)),
        getResolvedSymbolOrNil: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_getResolvedSymbolOrNil(checker, node)),
        getResolvedIntrinsicValueInfo: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => {
            if (checker === undefined || node?.Parent === undefined || !IsIdentifier(node))
                return undefined;
            const symbol = LinkStore_TryGet(checker.symbolNodeLinks, node)?.resolvedSymbol;
            return symbol !== undefined && symbol === checker.undefinedSymbol
                && IsInExpressionContext(node) && !IsRightSideOfQualifiedNameOrPropertyAccess(node)
                && getAssignmentTargetKind(node) !== AssignmentKindDefinite
                ? { kind: "undefined", symbol } : undefined;
        }),
        getAliasedSymbol: (symbol) => withCheckerForSymbol(program, symbol, defaultOptions, (checker) => {
            // The made default member of a module's exported value is shared between modules: its alias target is the
            // first module's and is not handed out. Its boundary is asked by occurrence (acquireResolvedPropertyAccess).
            if (isSyntheticDefaultMember(checker, symbol))
                return undefined;
            const target = Checker_GetAliasedSymbol(checker, symbol);
            return target === checker?.unknownSymbol ? undefined : target;
        }),
        getAliasStep: (symbol) => {
            if (symbol === undefined || (symbol.Flags & SymbolFlagsAlias) === 0)
                return undefined;
            const declaration = Checker_getDeclarationOfAliasSymbol(undefined, symbol);
            if (declaration === undefined)
                return undefined;
            return withCheckedFile(program, GetSourceFileOfNode(declaration), defaultOptions, (checker) => {
                if (checker === undefined)
                    return undefined;
                const retained = LinkStore_TryGet(checker.aliasSymbolLinks, symbol);
                // The two binding forms whose target the checker computes through a module's `export =` assignment.
                const namespaceForm = IsNamespaceImport(declaration) || IsNamespaceExport(declaration);
                const memberForm = (IsImportSpecifier(declaration) || IsExportSpecifier(declaration))
                    && !ModuleExportNameIsDefault(Node_PropertyNameOrName(declaration));
                const moduleForm = isSourceModuleBinding(declaration);
                const moduleSpecifier = moduleForm ? Checker_getModuleSpecifierForImportOrExport(checker, declaration) : undefined;
                const selectedModule = moduleSpecifier === undefined ? undefined : moduleOfSpecifier(checker, declaration, moduleSpecifier);
                const referenced = namespaceForm || memberForm ? selectedModule : undefined;
                const exportDeclaration = IsExportSpecifier(declaration) ? AsExportDeclaration(declaration.Parent?.Parent) : undefined;
                if (exportDeclaration !== undefined && exportDeclaration.ModuleSpecifier === undefined && Node_Symbol(declaration) !== symbol)
                    return undefined;
                // A namespace form names the module itself: its `export =` assignment when it has one, the module otherwise.
                // The checker's own target for it is the final value behind the assignment or a symbol it makes for the import.
                if (referenced !== undefined && namespaceForm)
                    return { kind: "symbol", symbol: referenced.exportAssignment ?? referenced.module };
                const failure = retainedAliasFailure(checker, declaration, symbol, selectedModule === undefined);
                const immediate = failure === undefined
                    ? Checker_getImmediateAliasedSymbol(checker, symbol) : retained?.immediateTarget;
                const target = immediate === checker?.unknownSymbol ? undefined : immediate;
                const cause = failure ?? LinkStore_TryGet(checker.aliasSymbolLinks, symbol)?.immediateFailure;
                const answer = target !== undefined ? { kind: "symbol", symbol: target }
                    : cause === undefined || defaultOptions.admitsCheckerDiagnostic?.(cause) === false ? undefined : { kind: "unresolved", cause };
                if (referenced?.exportAssignment !== undefined) {
                    return { kind: "exported-value-member", exportAssignment: referenced.exportAssignment, member: answer };
                }
                return answer;
            });
        },
        getTypeOfSymbol: (symbol) => withCheckerForSymbol(program, symbol, defaultOptions, (checker) => Checker_getTypeOfSymbol(checker, symbol)),
        getWriteTypeOfSymbol: (symbol) => withCheckerForSymbol(program, symbol, defaultOptions, (checker) => Checker_getWriteTypeOfSymbol(checker, symbol)),
        getDeclaredTypeOfSymbol: (symbol) => withCheckerForSymbol(program, symbol, defaultOptions, (checker) => Checker_getDeclaredTypeOfSymbol(checker, symbol)),
        getResolvedSignature: (node) => withCheckedFile(program, GetSourceFileOfNode(node), defaultOptions, (checker) => Checker_getResolvedSignature(checker, node, undefined, CheckModeNormal)),
        getSignatureFromDeclaration(declaration) {
            if (!IsFunctionLike(declaration))
                return undefined;
            const sourceFile = GetSourceFileOfNode(declaration);
            if (sourceFile === undefined || Program_GetSourceFile(program, SourceFile_FileName(sourceFile)) !== sourceFile)
                return undefined;
            return withCheckedFile(program, sourceFile, defaultOptions, checker => Checker_GetSignatureFromDeclaration(checker, declaration));
        },
        getResolvedCallInfo: (node) => {
            const result = readCall(node, { kind: "produce" });
            return result.kind === "complete" ? result.value : undefined;
        },
        acquireResolvedCall: (node, admit) => readCall(node, { kind: "ready", admit }),
        acquireResolvedPropertyAccess: readProperty,
        getResolvedElementAccessInfo: (node) => memoizeResolvedNodeQuery(elementAccessInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => {
            const selected = Checker_getResolvedSourceElementAccessInfo(checker, node);
            // An element access that reads the made default member would name the first module's value: nothing.
            return isSyntheticDefaultMember(checker, selected?.sourceSymbol)
                ? undefined
                : withResolvedSourceReceiverValueEvidence(checker, selected);
        })),
        getResolvedIterationInfo: (node) => memoizeResolvedNodeQuery(iterationInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_getResolvedSourceIterationInfo(checker, node))),
        getResolvedObjectLiteralElementInfo: (node) => memoizeResolvedNodeQuery(objectLiteralElementInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => getResolvedSourceObjectLiteralElementInfo(checker, node, objectLiteralElementSymbols))),
        getResolvedStorageInfo: (node) => {
            const result = readStorage(node, null);
            return result.kind === "complete" ? result.value : undefined;
        },
        acquireResolvedStorage: readStorage,
        getResolvedCallableCompletionInfo: (node) => memoizeResolvedNodeQuery(callableCompletionInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => resolveSourceCallableCompletionInfo(checker, node))),
        getResolvedFlowConditionInfo: (node) => memoizeResolvedNodeQuery(flowConditionInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => resolveSourceFlowConditionInfo(checker, node))),
        getResolvedGeneratorInfo: (node) => memoizeResolvedNodeQuery(generatorInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => resolveSourceGeneratorInfo(checker, node))),
        getResolvedYieldInfo: (node) => memoizeResolvedNodeQuery(yieldInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => {
            const declaration = GetContainingFunction(node);
            const generator = memoizeResolvedNodeQuery(generatorInfos, declaration, () => resolveSourceGeneratorInfo(checker, declaration));
            return resolveSourceYieldInfo(checker, node, generator);
        })),
        getResolvedWellKnownSymbolInfo: (node) => memoizeResolvedNodeQuery(wellKnownSymbolInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => resolveSourceWellKnownSymbolInfo(checker, node))),
        getResolvedResourceManagementInfo: (node) => memoizeResolvedNodeQuery(resourceManagementInfos, node, () => withCheckerForNode(program, node, defaultOptions, (checker) => resolveSourceResourceManagementInfo(checker, node))),
        getReturnTypeOfSignature: (signature) => querySourceType(program, defaultOptions, { kind: "signature-return", signature }),
        getInvocationReturnTypeOfSignature: (signature) => withCheckerForSignature(program, signature, defaultOptions, (checker) => readInvocationReturnType(checker, signature)),
        getCallSignaturesOfType: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetSignaturesOfType(checker, type, SignatureKindCall)) ?? [],
        getConstructSignaturesOfType: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetSignaturesOfType(checker, type, SignatureKindConstruct)) ?? [],
        getPropertyOfType: (type, name) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetPropertyOfType(checker, type, name)),
        getTypeOfPropertyOfType: (type, name) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_GetTypeOfPropertyOfType(checker, type, name)),
        getConstantValue: (node) => withCheckerForNode(program, node, defaultOptions, (checker) => Checker_GetConstantValue(checker, node)),
        typeToString: (type) => withCheckerForType(program, type, defaultOptions, (checker) => Checker_TypeToString(checker, type)) ?? "",
        getModuleSymbolFromSpecifier: (moduleSpecifier) => withCheckerForNode(program, moduleSpecifier, defaultOptions, (checker) => Checker_resolveExternalModuleName(checker, moduleSpecifier, moduleSpecifier, true)),
        getResolvedSourceModuleLink: (specifier) => specifier === undefined ? undefined
            : withCheckedFile(program, GetSourceFileOfNode(specifier), defaultOptions, checker => checker === undefined ? undefined : sourceModuleLink(checker, specifier, defaultOptions.admitsCheckerDiagnostic)),
        getResolvedExternalModuleSymbol: (moduleSymbol, dontResolveAlias = false) => withCheckerForSymbol(program, moduleSymbol, defaultOptions, (checker) => Checker_resolveExternalModuleSymbol(checker, moduleSymbol, dontResolveAlias)),
        getExportsOfModule: (moduleSymbol) => {
            if (moduleSymbol === undefined)
                return [];
            const readExports = (checker) => {
                if (checker === undefined)
                    return undefined;
                const exports = Checker_getExportsOfModule(checker, moduleSymbol);
                const links = LinkStore_TryGet(checker.moduleSymbolLinks, moduleSymbol);
                if (links?.resolvedExports !== exports)
                    throw new Error("A module export answer requires its actual native export table.");
                const rows = [];
                for (const [name, symbol] of exports) {
                    if (isReservedMemberName(name))
                        continue;
                    if (symbol === undefined)
                        throw new Error("A native export row requires its actual symbol.");
                    rows.push({ name, symbol, typeOnlyStar: links.typeOnlyExportStarMap?.get(name) ?? null });
                }
                return rows;
            };
            const owner = moduleSymbol.checkerId;
            const rows = (owner === undefined
                ? withCheckedFile(program, getSymbolSourceFile(moduleSymbol), defaultOptions, readExports)
                : withCheckerById(program, defaultOptions.sourceFile, owner, defaultOptions.context ?? Background(), readExports)) ?? [];
            for (const row of rows) {
                if (row.typeOnlyStar !== null || (row.symbol.Flags & SymbolFlagsAlias) === 0)
                    continue;
                const alias = Checker_getDeclarationOfAliasSymbol(undefined, row.symbol);
                if (alias === undefined)
                    continue;
                row.typeOnlyStar = withCheckedFile(program, GetSourceFileOfNode(alias), defaultOptions, checker => {
                    const origin = LinkStore_TryGet(checker?.aliasSymbolLinks, row.symbol)?.typeOnlyDeclaration;
                    if (origin === undefined || !IsExportDeclaration(origin))
                        return undefined;
                    const declaration = AsExportDeclaration(origin);
                    return declaration?.IsTypeOnly && declaration.ExportClause === undefined ? origin : undefined;
                }) ?? null;
            }
            return rows;
        },
        getSymbolName: (symbol) => symbol?.Name ?? "",
        getSymbolDeclarations: (symbol) => symbol?.Declarations ?? [],
        getRootSymbols: (symbol) => withCheckerForSymbol(program, symbol, defaultOptions, (checker) => Checker_GetRootSymbols(checker, symbol)) ?? [],
        getSymbolValueDeclaration: (symbol) => symbol?.ValueDeclaration,
        getPrimarySymbolDeclaration: (symbol) => getPrimarySymbolDeclaration(symbol),
        getSymbolSourceFile: (symbol) => getSymbolSourceFile(symbol),
        getTypeSymbol: (type) => type?.symbol,
        getTypeAliasSymbol: (type) => type?.alias?.symbol,
        getSignatureDeclaration: (signature) => signature?.declaration,
        getSignatureParameters: (signature) => signature?.parameters ?? [],
        getSignatureThisParameter: (signature) => signature?.thisParameter,
    };
    return Object.freeze(queries);
}
function getResolvedSourceObjectLiteralElementInfo(checker, element, symbolsByType) {
    const elementKind = resolvedSourceObjectLiteralElementKind(element);
    const objectLiteral = element?.Parent;
    if (checker === undefined || element === undefined || elementKind === undefined ||
        objectLiteral === undefined ||
        !IsObjectLiteralExpression(objectLiteral)) {
        return undefined;
    }
    const objectLiteralType = Checker_GetTypeAtLocation(checker, objectLiteral);
    const sourceElementType = Checker_GetTypeAtLocation(checker, element);
    const contextualType = Checker_getApparentTypeOfContextualType(checker, objectLiteral, ContextFlagsNone);
    if (objectLiteralType === undefined || sourceElementType === undefined) {
        return undefined;
    }
    let symbols = symbolsByType.get(objectLiteralType);
    if (symbols === undefined) {
        const selected = new Map();
        const ambiguous = new Set();
        for (const symbol of Checker_GetPropertiesOfType(checker, objectLiteralType)) {
            if (symbol === undefined)
                continue;
            for (const declaration of symbol.Declarations ?? []) {
                if (declaration === undefined || ambiguous.has(declaration))
                    continue;
                const prior = selected.get(declaration);
                if (prior !== undefined && prior !== symbol) {
                    selected.delete(declaration);
                    ambiguous.add(declaration);
                }
                else {
                    selected.set(declaration, symbol);
                }
            }
        }
        symbols = selected;
        symbolsByType.set(objectLiteralType, symbols);
    }
    const sourceElementSymbol = symbols.get(element);
    if (sourceElementSymbol === undefined)
        return undefined;
    const contextualElementType = contextualType === undefined
        ? undefined
        : Checker_getTypeOfPropertyOfContextualTypeEx(checker, contextualType, sourceElementSymbol.Name, Checker_getLiteralTypeFromPropertyName(checker, Node_Name(element)));
    const sourceSelectedSymbol = contextualElementType === undefined
        ? sourceElementSymbol
        : Checker_GetPropertyOfType(checker, contextualType, sourceElementSymbol.Name);
    const sourceSelectedType = contextualElementType === undefined
        ? Checker_getTypeOfSymbol(checker, sourceElementSymbol)
        : contextualElementType;
    if (sourceSelectedType === undefined) {
        return undefined;
    }
    const rawSourceSelectedDeclarations = sourceSelectedSymbol?.Declarations ?? [];
    if (rawSourceSelectedDeclarations.some((declaration) => declaration === undefined)) {
        return undefined;
    }
    const sourceSelectedDeclarations = Object.freeze([
        ...rawSourceSelectedDeclarations,
    ]);
    return Object.freeze({
        objectLiteral,
        element,
        elementKind,
        objectLiteralType,
        ...(contextualType === undefined ? {} : { contextualType }),
        sourceElementSymbol,
        sourceElementType,
        ...(sourceSelectedSymbol === undefined ? {} : { sourceSelectedSymbol }),
        ...(() => {
            const sourceSelectedDeclaration = getPrimarySymbolDeclaration(sourceSelectedSymbol);
            return sourceSelectedDeclaration === undefined ? {} : { sourceSelectedDeclaration };
        })(),
        sourceSelectedDeclarations,
        sourceSelectedType,
    });
}
function resolvedSourceObjectLiteralElementKind(element) {
    if (IsPropertyAssignment(element)) {
        return "property";
    }
    if (IsShorthandPropertyAssignment(element)) {
        return "shorthand";
    }
    if (IsObjectLiteralMethod(element)) {
        return "method";
    }
    if (IsGetAccessorDeclaration(element)) {
        return "get";
    }
    if (IsSetAccessorDeclaration(element)) {
        return "set";
    }
    return undefined;
}
function getResolvedSourceStorageInfo(checker, expression) {
    if (checker === undefined || expression === undefined) {
        return undefined;
    }
    let storageExpression = expression;
    const kinds = (OEKAssertions | OEKParentheses);
    for (; storageExpression !== undefined;) {
        admitNativeChecker(checker, "work");
        if (!IsOuterExpression(storageExpression, kinds))
            break;
        storageExpression = Node_Expression(storageExpression);
    }
    if (storageExpression === undefined
        || (storageExpression.Flags & NodeFlagsOptionalChain) !== 0) {
        return undefined;
    }
    if (IsIdentifier(storageExpression)) {
        const referenceSymbol = getDiagnosticFreeResolvedSymbol(checker, storageExpression);
        const symbol = referenceSymbol !== undefined && (referenceSymbol.Flags & SymbolFlagsAlias) !== 0
            ? Checker_GetAliasedSymbol(checker, referenceSymbol)
            : referenceSymbol;
        const type = sourceTypeAnswer(checker, storageExpression, Checker_GetTypeAtLocation(checker, storageExpression));
        if (referenceSymbol === undefined || symbol === undefined || symbol === checker.unknownSymbol || type === undefined) {
            return undefined;
        }
        let writable;
        if (getAssignmentTargetKind(storageExpression) !== AssignmentKindNone) {
            const localOrExport = Checker_getExportSymbolOfValueSymbolIfExported(checker, referenceSymbol);
            if (localOrExport === undefined)
                return undefined;
            writable = Checker_getIdentifierAssignmentError(checker, storageExpression, localOrExport) === undefined;
        }
        else {
            writable = !Checker_isAssignmentToReadonlyEntity(checker, storageExpression, symbol, AssignmentKindDefinite);
        }
        const declaration = getPrimarySymbolDeclaration(symbol);
        admitNativeChecker(checker, "retained");
        return Object.freeze({
            expression,
            storageExpression,
            type,
            symbol,
            ...(declaration === undefined ? {} : { declaration }),
            writable,
        });
    }
    if (IsPropertyAccessExpression(storageExpression)) {
        const selected = Checker_getResolvedSourcePropertyAccessInfo(checker, storageExpression);
        const type = sourceTypeAnswer(checker, storageExpression, selectedAccessType(selected));
        if (selected === undefined || type === undefined) {
            return undefined;
        }
        admitNativeChecker(checker, "retained");
        return Object.freeze({
            expression,
            storageExpression,
            type,
            ...(selected.selectedSymbol === undefined
                ? {}
                : { symbol: selected.selectedSymbol }),
            ...(selected.selectedDeclaration === undefined
                ? {}
                : { declaration: selected.selectedDeclaration }),
            writable: selected.writable,
        });
    }
    if (IsElementAccessExpression(storageExpression)) {
        const selected = Checker_getResolvedSourceElementAccessInfo(checker, storageExpression);
        const type = sourceTypeAnswer(checker, storageExpression, selectedAccessType(selected));
        if (selected === undefined || type === undefined) {
            return undefined;
        }
        admitNativeChecker(checker, "retained");
        return Object.freeze({
            expression,
            storageExpression,
            type,
            ...(selected.selectedSymbol === undefined
                ? {}
                : { symbol: selected.selectedSymbol }),
            ...(selected.selectedDeclaration === undefined
                ? {}
                : { declaration: selected.selectedDeclaration }),
            writable: selected.writable,
        });
    }
    return undefined;
}
function selectedAccessType(selected) {
    if (selected === undefined) {
        return undefined;
    }
    switch (selected.accessMode) {
        case "read":
        case "delete":
            return selected.sourceReadType;
        case "write":
            return selected.sourceWriteType;
        case "read-write":
            return selected.sourceReadType;
    }
}
function memoizeResolvedNodeQuery(cache, node, query) {
    if (node === undefined) {
        return undefined;
    }
    const cached = cache.get(node);
    if (cached !== undefined) {
        return cached;
    }
    const resolved = query();
    if (resolved !== undefined) {
        cache.set(node, resolved);
    }
    return resolved;
}
function getDiagnosticFreeResolvedSymbol(checker, node) {
    const resolved = Checker_getResolvedSymbolOrNil(checker, node);
    return resolved !== undefined && resolved !== checker?.unknownSymbol
        ? resolved
        : undefined;
}
function withResolvedPropertyAccessEvidence(checker, selected) {
    if (checker === undefined || selected === undefined)
        return undefined;
    admitNativeChecker(checker, "work");
    const { selectedIndex, ...access } = selected;
    const resolved = withResolvedSourceReceiverValueEvidence(checker, access);
    if (resolved === undefined)
        return undefined;
    const property = selectedIndex !== undefined || selected.sourceSymbol === undefined || selected.selectedSymbol === undefined
        ? null : Object.freeze(readTypePropertyHeader(checker, selected.sourceSymbol));
    admitNativeChecker(checker, "retained", selectedIndex === undefined ? 1 : 3);
    const value = {
        kind: "member",
        ...resolved,
        property,
        ...(selectedIndex === undefined ? {} : {
            selectedIndex: Object.freeze(readTypeIndexInfo(checker, selected.receiver.type, selectedIndex)),
        }),
    };
    return value;
}
function withResolvedSourceReceiverValueEvidence(checker, selected) {
    if (checker === undefined || selected === undefined) {
        return undefined;
    }
    const sourceSymbol = getDiagnosticFreeResolvedSymbol(checker, SkipOuterExpressions(selected.receiver.expression, (OEKAssertions | OEKParentheses)));
    const valueSymbol = sourceSymbol !== undefined &&
        (sourceSymbol.Flags & SymbolFlagsAlias) !== 0
        ? Checker_GetAliasedSymbol(checker, sourceSymbol)
        : sourceSymbol;
    if (valueSymbol === undefined || valueSymbol === checker.unknownSymbol) {
        return selected;
    }
    return Object.freeze({
        ...selected,
        receiver: Object.freeze({
            ...selected.receiver,
            valueSymbol,
            ...(valueSymbol === checker.globalThisSymbol ? { intrinsic: "global-object" } : {}),
            ...(valueSymbol.ValueDeclaration === undefined
                ? {}
                : { valueDeclaration: valueSymbol.ValueDeclaration }),
        }),
    });
}
// The module that an import or export declaration names, with the symbol of its `export =` assignment when it has
// one; nothing when the declaration names no module or the module does not resolve. Reports no diagnostic.
function referencedModule(checker, declaration) {
    return moduleOfSpecifier(checker, declaration, Checker_getModuleSpecifierForImportOrExport(checker, declaration));
}
// Whether a symbol is the `default` member the checker makes for a module's exported value: its creator's mark.
function isSyntheticDefaultMember(checker, symbol) {
    return checker !== undefined && symbol !== undefined && LinkStore_TryGet(checker.aliasSymbolLinks, symbol)?.syntheticDefault === true;
}
// The module boundary of `E.default` where the member is the made default: one symbol, the module's `export =`
// assignment when it has one and the module otherwise, exactly as a namespace import steps. Given only where the
// receiver expression proves the module: an import's own namespace binding, or `await import("m")` itself.
function exportedValueBoundary(checker, access) {
    const receiver = SkipParentheses(Node_Expression(access));
    if (receiver === undefined)
        return undefined;
    let referenced;
    if (IsIdentifier(receiver)) {
        const binding = Checker_GetSymbolAtLocation(checker, receiver);
        const declaration = binding !== undefined && (binding.Flags & SymbolFlagsAlias) !== 0
            ? Checker_getDeclarationOfAliasSymbol(checker, binding) : undefined;
        referenced = declaration !== undefined && IsNamespaceImport(declaration) ? referencedModule(checker, declaration) : undefined;
    }
    else if (IsAwaitExpression(receiver)) {
        const awaited = SkipParentheses(Node_Expression(receiver));
        referenced = awaited !== undefined && IsImportCall(awaited) ? moduleOfSpecifier(checker, awaited, Node_Arguments(awaited)?.[0]) : undefined;
    }
    return referenced === undefined ? undefined : referenced.exportAssignment ?? referenced.module;
}
function moduleOfSpecifier(checker, declaration, moduleSpecifier) {
    if (moduleSpecifier === undefined)
        return undefined;
    const moduleSymbol = Checker_resolveExternalModuleName(checker, declaration, moduleSpecifier, true);
    if (moduleSymbol === undefined)
        return undefined;
    const exported = Checker_resolveExternalModuleSymbol(checker, moduleSymbol, true);
    return { module: moduleSymbol, exportAssignment: exported === undefined || exported === moduleSymbol ? undefined : exported };
}
function withCheckerForNode(program, node, defaultOptions, callback) {
    if (node === undefined) {
        return undefined;
    }
    return withCheckedFile(program, GetSourceFileOfNode(node), defaultOptions, callback);
}
function withCheckerForSymbol(program, symbol, defaultOptions, callback) {
    if (symbol === undefined) {
        return undefined;
    }
    if (symbol.checkerId !== undefined) {
        return withCheckerById(program, defaultOptions.sourceFile, symbol.checkerId, defaultOptions.context ?? Background(), callback);
    }
    return withChecker(program, defaultOptions.sourceFile, defaultOptions, callback);
}
function withCheckerForType(program, type, defaultOptions, callback) {
    return withOwnedChecker(program, defaultOptions.sourceFile, type?.checker, defaultOptions.context ?? Background(), callback);
}
function withCheckerForSignature(program, signature, defaultOptions, callback) {
    if (signature === undefined) {
        return undefined;
    }
    return withCheckerById(program, defaultOptions.sourceFile, signature.checkerId, defaultOptions.context ?? Background(), callback);
}
function withCheckedFile(program, sourceFile, defaultOptions, callback) {
    return withSourceFileChecker(program, defaultOptions.sourceFile, sourceFile, defaultOptions.context ?? Background(), callback);
}
function withChecker(program, sourceFile, defaultOptions, callback) {
    if (program === undefined || sourceFile === undefined || !Program_HasUsableCheckerSession(program) ||
        Program_GetSourceFile(program, SourceFile_FileName(sourceFile)) !== sourceFile) {
        return undefined;
    }
    const context = defaultOptions.context ?? Background();
    const [checker, done] = Program_GetTypeChecker(program, WithCheckerLifetime(context, CheckerLifetimeAPI));
    try {
        return callback(checker);
    }
    finally {
        done();
    }
}
function getSymbolSourceFile(symbol) {
    const declaration = getPrimarySymbolDeclaration(symbol);
    return GetSourceFileOfNode(declaration);
}
function getPrimarySymbolDeclaration(symbol) {
    return symbol?.ValueDeclaration ?? symbol?.Declarations?.find((candidate) => candidate !== undefined);
}
//# sourceMappingURL=type-checker.js.map