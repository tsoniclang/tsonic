// host-input queries (I3): the closed list of checker translations the Host value model reads, per source file.
//
// Every checker value that crosses into local-type-flow is an opaque handle (SourceHostType, SourceHostSymbol); only this
// module and its host-input siblings can open one. local-type-flow therefore cannot ask the checker anything: it holds
// handles and passes them back here. Each query translates declaration input (declared, authored and selected-signature
// types and their structure), authored syntax, or a selection witness (which call, member, element, iteration or
// generator the checker selected). No query here returns a checker-inferred expression type (R3): `expressionType` is
// read only by the witnesses in index.ts, which return presence, arm-selection or identity answers, never a type.
import { sourcePrimitiveFactKey } from "@tsonic/tsts";
import { getSourceCallTypeParameterDeclaration, getSourceMethodTypeArgumentComponent } from "./semantics-type-arguments.js";
import { sourceArrayElementType } from "./semantics-array-types.js";
import { selectSourcePropertyDeclaration, selectedSourcePropertyDeclarations } from "./semantics-selected-property-declarations.js";
import { sourceTypeFlowHomomorphicInput } from "./mapped-types.js";
import { sourceTypeDescriptorMemberKey, sourceTypeDescriptorMemberOrigin } from "./member-origins.js";
// ---- handle casts (host-input only) ----------------------------------------------------------------------------------
// The handles are the checker values themselves, typed opaquely; opening one is a type-level cast, never a copy.
export const hostType = (type) => type;
export const checkerType = (type) => type;
export const hostTypes = (types) => types;
export const hostComponent = (component) => component;
export const checkerComponent = (component) => component;
export const hostCall = (call) => call;
export const checkerCall = (call) => call;
/**
 * The one absence classifier over checker input (R4: every host-input presence, absence-admission and narrowed-arm
 * answer reads it). A constituent is absence when it is null, undefined or void: a `void` union arm is absence (WP0
 * A11), exactly as the Host union builder makes it (terms.ts). A bare `void` is not absence: it is the void intrinsic.
 */
export function sourceHostAbsentConstituent(types, type) {
    return types.isNullish(type) || types.isVoidLike(type);
}
/** The presence of a checker type under the one absence classifier. */
export function sourceHostPresence(types, type) {
    if (types.isNullish(type))
        return "absent";
    return types.isUnion(type) && types.unionOrIntersectionTypes(type).some(member => sourceHostAbsentConstituent(types, member))
        ? "possibly-absent" : "present";
}
/** The per-file query facade. One per checker file view, owned by the program's host-input adapter (I5). */
export function createSourceHostQueries(ast, queries, sourceFacts, source) {
    const t = checkerType;
    const { types, declarations, operations } = queries;
    const primitiveOf = (subjects) => {
        for (const subject of subjects) {
            const fact = sourceFacts.getFact(subject, sourcePrimitiveFactKey);
            if (fact !== undefined)
                return fact.kind;
        }
        return undefined;
    };
    const signatureInfo = (signature) => Object.freeze({
        parameters: signature.parameters,
        returnType: signature.returnType === undefined ? undefined : hostType(signature.returnType),
        ...(() => {
            const declaration = declarations.signatureDeclaration(signature.signature);
            return declaration === undefined ? {} : { declaration };
        })(),
    });
    const facade = {
        call: (node) => {
            const call = operations.call(node);
            return call === undefined ? undefined : hostCall(call);
        },
        callSignature: (call) => declarations.signatureDeclaration(checkerCall(call).selectedSignature),
        callResult: (call) => {
            const result = operations.callResult(checkerCall(call));
            return result === undefined ? undefined : Object.freeze({ resultType: hostType(result.resultType),
                ...(result.authoredTypeNode === undefined ? {} : { authoredTypeNode: result.authoredTypeNode }) });
        },
        callTypeParameter: (invocation, call, argument) => getSourceCallTypeParameterDeclaration(ast, queries, invocation, checkerCall(call), argument),
        methodTypeArgumentComponent: (argument) => hostComponent(getSourceMethodTypeArgumentComponent(argument)),
        inferenceContributions: (call) => {
            const evidence = checkerCall(call).sourceInferenceContributions;
            return evidence.kind === "available" ? evidence.contributions : undefined;
        },
        propertyAccess: (node) => operations.propertyAccess(node),
        elementAccess: (node) => operations.elementAccess(node),
        objectLiteralElement: (property) => operations.objectLiteralElement(property),
        objectLiteralProperty: (element) => {
            const symbol = element.sourceElementSymbol;
            if (symbol === undefined)
                return undefined;
            return types.propertyInfos(t(element.objectLiteralType)).find(member => member.symbol === symbol);
        },
        objectLiteralAccessor: (element, property) => {
            const selected = selectedSourcePropertyDeclarations(queries, undefined, property.symbol, [t(element.objectLiteralType)]);
            return selected === undefined ? undefined : selectSourcePropertyDeclaration(ast, selected, "read") ??
                selectSourcePropertyDeclaration(ast, selected, "write");
        },
        iteration: (node) => {
            const iteration = operations.iteration(node);
            return iteration === undefined ? undefined
                : Object.freeze({ subjectKind: iteration.subject.kind, subject: iteration.subject.node, elementType: hostType(iteration.sourceElementType) });
        },
        generator: (node) => operations.generator(node),
        callableCompletion: (node) => {
            const completion = operations.callableCompletion(node);
            return completion === undefined ? undefined : Object.freeze({ canFallThrough: completion.canFallThrough });
        },
        propertyName: (name) => queries.propertyNames.get(name),
        hasContextualType: (node) => types.contextualType(node) !== undefined,
        declaredType: (declaration) => { const type = declarations.declaredType(declaration); return type === undefined ? undefined : hostType(type); },
        declaredValueType: (declaration) => {
            const type = declarations.declaredValueType(declaration);
            return type === undefined ? undefined : hostType(type);
        },
        authoredType: (node) => { const type = types.authoredType(node); return type === undefined ? undefined : hostType(type); },
        declarationSignature: (declaration) => {
            const signature = types.declarationSignatureInfo(declaration);
            return signature === undefined ? undefined : signatureInfo(signature);
        },
        isDefaultLibrary: (node) => declarations.isDefaultLibraryDeclaration(node),
        typeDeclaration: (type, authoredTypeNode, excluded) => sourceHostTypeDeclaration(ast, queries, t(type), authoredTypeNode, excluded),
        typeSymbolDeclarations: (type) => {
            const symbol = declarations.typeSymbol(t(type));
            return symbol === undefined ? [] : declarations.symbolDeclarations(symbol);
        },
        primaryTypeDeclaration: (type) => {
            const symbol = declarations.typeSymbol(t(type));
            return symbol === undefined ? undefined : declarations.primarySymbolDeclaration(symbol);
        },
        propertyDeclaration: (property) => declarations.primarySymbolDeclaration(property.symbol),
        homomorphicInput: (type, authoredTypeNode) => {
            const input = sourceTypeFlowHomomorphicInput(source, queries, t(type), authoredTypeNode);
            return input === undefined ? undefined : hostType(input);
        },
        memberOrigin: (property, receiver) => sourceTypeDescriptorMemberOrigin({ ast }, queries, property, t(receiver)),
        primitive: (subjects) => primitiveOf([
            ...(subjects.node === undefined ? [] : [subjects.node]),
            ...queries.facts.selectedSubjects(undefined, subjects.declaration),
            ...(subjects.type === undefined ? [] : queries.facts.typeSubjects(t(subjects.type))),
            ...(subjects.annotation === undefined ? [] : queries.facts.authoredTypeSubjects(subjects.annotation)),
        ]),
        authoredSelection: (annotation, type) => {
            const selected = types.authoredSelection(annotation, t(type));
            return selected.kind === "authored-members"
                ? Object.freeze({ kind: "authored-members", nodes: selected.nodes, nullishCount: selected.selectedNullishTypes.length })
                : Object.freeze({ kind: selected.kind });
        },
        isAny: (type) => types.isAny(t(type)),
        isUnknown: (type) => types.isUnknown(t(type)),
        isNonPrimitive: (type) => types.isNonPrimitive(t(type)),
        isNullish: (type) => types.isNullish(t(type)),
        isAbsentConstituent: (type) => sourceHostAbsentConstituent(types, t(type)),
        isUnion: (type) => types.isUnion(t(type)),
        isIntersection: (type) => types.isIntersection(t(type)),
        isTuple: (type) => types.isTuple(t(type)),
        isArrayLike: (type) => types.isArrayLike(t(type)),
        isVoidLike: (type) => types.isVoidLike(t(type)),
        isBooleanLike: (type) => types.isBooleanLike(t(type)),
        isNumberLike: (type) => types.isNumberLike(t(type)),
        isStringLike: (type) => types.isStringLike(t(type)),
        isSymbolLike: (type) => types.isSymbolLike(t(type)),
        isNever: (type) => types.isNever(t(type)),
        isBigIntLike: (type) => types.isBigIntLike(t(type)),
        stringLiteralValue: (type) => types.stringLiteralValue(t(type)),
        numericLiteralValue: (type) => types.numericLiteralValue(t(type)),
        booleanLiteralValue: (type) => types.booleanLiteralValue(t(type)),
        literalBaseType: (type) => { const selected = types.literalBaseType(t(type)); return selected === undefined ? undefined : hostType(selected); },
        authoredTypeDeclaration: (node) => declarations.authoredTypeDeclaration(node),
        propertyNameKey: (name) => {
            const selected = operations.propertyName(name);
            return selected === undefined ? undefined : sourceTypeDescriptorMemberKey(selected.type, queries);
        },
        members: (type) => hostTypes(types.unionOrIntersectionTypes(t(type))),
        tupleElements: (type) => types.tupleElementInfos(t(type)),
        tupleElementTypes: (type) => hostTypes(types.tupleElementTypes(t(type))),
        typeArguments: (type) => hostTypes(types.typeArguments(t(type))),
        typeArgumentBindings: (type) => types.typeArgumentBindings(t(type)),
        aliasApplication: (type) => types.aliasApplication(t(type)),
        instantiateAlias: (declaration, arguments_) => types.instantiateAlias(declaration, arguments_),
        indexes: (type) => types.indexInfos(t(type)),
        properties: (type) => types.propertyInfos(t(type)),
        callable: (type) => {
            const callable = types.callable(t(type));
            return callable === undefined ? undefined : Object.freeze({
                parameters: callable.parameters,
                result: hostComponent(callable.result)
            });
        },
        signatures: (type, kind) => types.signatureInfos(t(type), kind).map(signatureInfo),
        couldContainTypeVariables: (type) => types.couldContainTypeVariables(t(type)),
        nonNullableType: (type) => { const selected = types.nonNullableType(t(type)); return selected === undefined ? undefined : hostType(selected); },
        arrayElementType: (type) => { const selected = sourceArrayElementType(t(type), queries); return selected === undefined ? undefined : hostType(selected); },
        instantiatedBaseTypes: (type) => {
            const bases = types.instantiatedBaseTypes(t(type));
            return bases === undefined ? undefined : hostTypes(bases);
        },
        isIdentical: (left, right) => types.isIdentical(t(left), t(right)),
    };
    return Object.freeze(facade);
}
/**
 * The declaration that names a checked type: the authored reference's declaration first, else the type's alias or
 * type symbol declarations (class, interface, alias, enum, type literal, or the type parameter whose declared type it is).
 */
export function sourceHostTypeDeclaration(ast, queries, type, authoredTypeNode, excludedDeclarations) {
    const authored = authoredTypeNode === undefined ? undefined : queries.declarations.authoredTypeDeclaration(authoredTypeNode);
    if (authored !== undefined && (ast.is.IsTypeAliasDeclaration(authored) || ast.is.IsClassDeclaration(authored) ||
        ast.is.IsInterfaceDeclaration(authored) || ast.is.IsEnumDeclaration(authored) || ast.is.IsTypeParameterDeclaration(authored)))
        return authored;
    const symbols = [...new Set([queries.declarations.typeAliasSymbol(type), queries.declarations.typeSymbol(type)])];
    // A symbol can merge a type parameter with a same-named value (e.g. `function f<T>() { function T() {} }`): a type
    // parameter declaration names this type only when its declared type is this type.
    // An enum member literal type (`Value.First`) is named by its enum: the canonical descriptor has no literal types, so an
    // enum literal is a value of its enum declaration.
    return symbols.flatMap(symbol => symbol === undefined ? [] : queries.declarations.symbolDeclarations(symbol)).map(declaration => {
        const owner = ast.is.IsEnumMember(declaration) ? ast.parent(declaration) : undefined;
        return owner !== undefined && ast.is.IsEnumDeclaration(owner) ? owner : declaration;
    }).find(declaration => !excludedDeclarations?.has(declaration) && (ast.is.IsTypeAliasDeclaration(declaration) || ast.is.IsClassDeclaration(declaration) ||
        ast.is.IsClassExpression(declaration) || ast.is.IsInterfaceDeclaration(declaration) ||
        ast.is.IsEnumDeclaration(declaration) || ast.is.IsTypeLiteralNode(declaration) ||
        ast.is.IsTypeParameterDeclaration(declaration) && (() => {
            const declared = queries.declarations.declaredType(declaration);
            return declared !== undefined && queries.types.isIdentical(declared, type);
        })()));
}
//# sourceMappingURL=queries.js.map