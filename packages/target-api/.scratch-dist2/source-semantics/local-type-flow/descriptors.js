// The Host descriptor reader (R1 #12a): the one rule set that turns declaration input (authored type syntax and the
// declared/selected checker types of declarations, read only through the opaque SourceHostQueries facade, I3) into Host
// descriptors. Union families (authored order), member literal domains (D-2), the FixedArray extent, pointer-marker
// identity, alias identity (C-2263) and the C29 floor are decided here, never in host-input.
import { sourceMarkerFactKey } from "@tsonic/tsts";
import { createSourceTypeDescriptorNormalizer, sourceTypeDescriptorOptional, sourceTypeDescriptorHasTypeVariables, sourceTypeDescriptorLiteralKey, sourceTypeDescriptorsEqual, sourceTypeDescriptorUnion } from "./terms.js";
import { sourceTypeDescriptorConditionalDefinition } from "./conditional-descriptors.js";
import { failTargetCompilerResourceLimit } from "../../artifacts.js";
import { sourceTypeExpansionBudget } from "../type-expansion-budget.js";
import { sourceIntegerLiteralValue } from "../integer-literal.js";
export function createSourceTypeDescriptorReader(source, unions, parametersFor, declaredValue, refusedSignature) {
    const { ast } = source;
    const active = [];
    // Reuse (Q112): a class or interface definition is expanded once per (checked type, file view, bindings) and set of
    // required enclosing frames, not once per path. Expanding every path again is exponential in a strongly connected
    // library graph (lib.dom: Node, Document, Element, Window, ...).
    const expandedDefinitions = new Map();
    const activeCallables = new Map();
    const empty = new Map();
    const expansions = new Set();
    let expansionDepth = 0;
    let expansionSite;
    const reads = [];
    let conditionalBindings = new Map();
    function capture(read) {
        const frame = {};
        reads.push(frame);
        try {
            const type = read();
            return frame.failure === undefined ? Object.freeze({ kind: "resolved", type })
                : frame.failure;
        }
        finally {
            reads.pop();
        }
    }
    function expand(selectedType, site, depth, read) {
        if (expansionDepth === 0) {
            expansions.clear();
            expansionSite = site;
        }
        expansionDepth += 1;
        if (Math.max(depth, active.length) > sourceTypeExpansionBudget.depth) {
            failTargetCompilerResourceLimit("tsonic", "Declared source type expansion", "depth", sourceTypeExpansionBudget.depth, expansionSite);
        }
        if (selectedType !== undefined)
            expansions.add(selectedType);
        if (expansions.size > sourceTypeExpansionBudget.types) {
            failTargetCompilerResourceLimit("tsonic", "Declared source type expansion", "types", sourceTypeExpansionBudget.types, expansionSite);
        }
        try {
            return read();
        }
        finally {
            expansionDepth -= 1;
        }
    }
    function frame(declaration, arguments_) {
        return { declaration, arguments: arguments_, requires: new Map() };
    }
    // The innermost active frame a cut with this requirement matches, or -1.
    function cutTarget(requirement) {
        for (let index = active.length - 1; index >= 0; index -= 1) {
            const selected = active[index];
            if (selected.declaration !== requirement.declaration)
                continue;
            if (requirement.byDeclaration || selected.arguments.length === requirement.arguments.length &&
                selected.arguments.every((argument, position) => sourceTypeDescriptorsEqual(argument, requirement.arguments[position])))
                return index;
        }
        return -1;
    }
    // A cut matched frame `index`: every frame expanding inside it now requires a frame like it above itself.
    function requireFrame(index, requirement) {
        const target = active[index];
        for (let position = index + 1; position < active.length; position += 1)
            active[position].requires.set(target, requirement);
    }
    function cutsAt(requirement) {
        const index = cutTarget(requirement);
        if (index >= 0)
            requireFrame(index, requirement);
        return index >= 0;
    }
    function expanding(declaration, arguments_) {
        return cutsAt({ declaration, arguments: arguments_, byDeclaration: false });
    }
    function cutByDeclaration(declaration) {
        return ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) || ast.is.IsInterfaceDeclaration(declaration);
    }
    function recursionCut(declaration, arguments_) {
        return cutByDeclaration(declaration) ? cutsAt({ declaration, arguments: [], byDeclaration: true }) : expanding(declaration, arguments_);
    }
    function bindingsEqual(left, right) {
        if (left === right)
            return true;
        if (left.size !== right.size)
            return false;
        for (const [declaration, value] of left) {
            const other = right.get(declaration);
            if (other === undefined || other !== value && !sourceTypeDescriptorsEqual(value, other))
                return false;
        }
        return true;
    }
    // An expanded definition of this class or interface whose cuts all have a matching frame here. Every cut inside it
    // then still lies below a frame of its target, so the reused definition is valid under the cut; its requirements
    // become requirements of the frames expanding here. A frame that would now cut deeper inside it is not consulted:
    // the definition stays the finite one already expanded, equal by declared identity (descriptor equality).
    function expandedDefinition(declaration, selectedType, queries, bindings) {
        for (const known of expandedDefinitions.get(declaration) ?? []) {
            if (known.selectedType !== selectedType || known.queries !== queries || !bindingsEqual(known.bindings, bindings))
                continue;
            const targets = known.requires.map(requirement => cutTarget(requirement));
            if (targets.some(index => index < 0))
                continue;
            known.requires.forEach((requirement, position) => requireFrame(targets[position], requirement));
            return known;
        }
        return undefined;
    }
    // The first primitive fact over the given subjects (the facade orders them: value node, declaration, type, annotation).
    function primitive(queries, subjects) {
        const kind = queries.primitive(subjects);
        return kind === undefined ? undefined : { kind: "primitive", primitive: kind };
    }
    function syntax(node, queries, depth = 0, bindings = empty) {
        if (reads.some(read => read.failure !== undefined))
            return undefined;
        if (ast.is.IsUnionTypeNode(node) && bindings.size > 0) {
            const original = syntax(node, queries, depth, empty);
            return original === undefined ? undefined : createSourceTypeDescriptorNormalizer(unions, bindings)(original);
        }
        return expand(queries.authoredType(node), node, depth, () => readSyntax(node, queries, depth, bindings));
    }
    function readSyntax(node, queries, depth, bindings) {
        const direct = ast.is.IsUnionTypeNode(node) ? undefined : primitive(queries, { node });
        if (direct !== undefined)
            return direct;
        const selectedType = queries.authoredType(node);
        if (selectedType === undefined)
            return undefined;
        const declaration = queries.typeDeclaration(selectedType, node);
        const substituted = declaration === undefined ? undefined : bindings.get(declaration);
        if (substituted !== undefined)
            return substituted;
        if (ast.is.IsParenthesizedTypeNode(node)) {
            const inner = ast.as.AsParenthesizedTypeNode(node)?.Type;
            return inner === undefined ? undefined : syntax(inner, queries, depth, bindings);
        }
        if (ast.is.IsArrayTypeNode(node)) {
            const elementNode = ast.as.AsArrayTypeNode(node)?.ElementType;
            const element = elementNode === undefined ? undefined : syntax(elementNode, queries, depth + 1, bindings);
            return element === undefined ? undefined : { kind: "array", readonly: false, element };
        }
        if (ast.is.IsTypeOperatorNode(node) && ast.operatorKindName(node) === "KindReadonlyKeyword") {
            const inner = ast.as.AsTypeOperatorNode(node)?.Type;
            const value = inner === undefined ? undefined : syntax(inner, queries, depth, bindings);
            return value?.kind === "array" || value?.kind === "tuple" ? { ...value, readonly: true } : value;
        }
        if (ast.is.IsTupleTypeNode(node)) {
            return tuple(selectedType, queries, depth, bindings, node);
        }
        if (ast.is.IsIntersectionTypeNode(node)) {
            return type(selectedType, queries, { selectedType, authoredTypeNode: node }, depth, bindings, new Set(active.filter(selected => ast.is.IsTypeAliasDeclaration(selected.declaration)).map(selected => selected.declaration)));
        }
        if (ast.is.IsUnionTypeNode(node)) {
            const types = [];
            for (const child of ast.children(node)) {
                if (child === undefined)
                    return undefined;
                const value = syntax(child, queries, depth + 1, bindings);
                if (value === undefined)
                    return undefined;
                types.push(value);
            }
            return sourceTypeDescriptorUnion(unions, types, { kind: "authored", node }, bindings);
        }
        if (ast.is.IsTypeLiteralNode(node))
            return structure(selectedType, queries, depth, bindings);
        if (ast.is.IsMappedTypeNode(node))
            return structure(selectedType, queries, depth, bindings, node);
        if (ast.is.IsFunctionTypeNode(node) || ast.is.IsConstructorTypeNode(node)) {
            return structure(selectedType, queries, depth, bindings);
        }
        if (ast.is.IsImportTypeNode(node) && ast.typeArguments(node).length === 0) {
            const imported = primitive(queries, { annotation: node });
            if (imported !== undefined)
                return imported;
        }
        if (declaration !== undefined) {
            const declaredPrimitive = primitive(queries, { node: declaration, declaration });
            if (declaredPrimitive !== undefined)
                return declaredPrimitive;
            if (ast.is.IsTypeReferenceNode(node) || ast.is.IsImportTypeNode(node)) {
                const argumentNodes = ast.typeArguments(node);
                const arguments_ = [];
                for (const argument of argumentNodes) {
                    const selected = argument === undefined ? undefined : syntax(argument, queries, depth + 1, bindings);
                    if (selected === undefined)
                        return undefined;
                    arguments_.push(selected);
                }
                const parameters = parametersFor(declaration);
                const instantiated = new Map(bindings);
                parameters.forEach((parameter, index) => {
                    const argument = arguments_[index];
                    if (argument !== undefined)
                        instantiated.set(parameter, argument);
                });
                let declaredBindings;
                let application;
                if (ast.is.IsTypeAliasDeclaration(declaration)) {
                    const checkedArguments = [];
                    for (const argument of argumentNodes) {
                        const authored = argument === undefined ? undefined : queries.authoredType(argument);
                        const parameter = authored === undefined ? undefined : queries.typeDeclaration(authored, argument);
                        const checked = parameter !== undefined && conditionalBindings.has(parameter)
                            ? conditionalBindings.get(parameter) : authored;
                        if (checked === undefined)
                            return undefined;
                        checkedArguments.push(checked);
                    }
                    application = queries.instantiateAlias(declaration, checkedArguments);
                    if (application === undefined || application.declaration !== declaration)
                        return undefined;
                    declaredBindings = application.bindings.map(binding => ({ declaration: binding.declaration, argumentType: binding.argument }));
                }
                else
                    declaredBindings = queries.typeArgumentBindings(selectedType);
                if (declaredBindings !== undefined) {
                    const ordered = [];
                    for (const binding of declaredBindings) {
                        const argument = instantiated.get(binding.declaration) ?? type(binding.argumentType, queries, { selectedType: binding.argumentType }, depth + 1, instantiated);
                        if (argument === undefined)
                            return undefined;
                        ordered.push(argument);
                        instantiated.set(binding.declaration, argument);
                    }
                    arguments_.splice(0, arguments_.length, ...ordered);
                }
                const body = ast.is.IsTypeAliasDeclaration(declaration) ? ast.typeNode(declaration) : undefined;
                // A native pointer marker alias (`type Pointer<T> = T`) keeps its declared identity and type argument (R-B4-12):
                // the pointee is read from the reference, never from the transparent body.
                const referenceOnly = body !== undefined && (ast.is.IsUnionTypeNode(body) || ast.is.IsMappedTypeNode(body) ||
                    ast.is.IsConditionalTypeNode(body) || ast.is.IsIntersectionTypeNode(body) || ast.is.IsTypeLiteralNode(body) ||
                    pointerMarkerDeclaration(declaration));
                if (referenceOnly)
                    return nominal(selectedType, declaration, arguments_, queries, {
                        selectedType, declaration, authoredTypeNode: node,
                    }, depth, instantiated, application);
                if (ast.is.IsTypeAliasDeclaration(declaration) && !expanding(declaration, arguments_)) {
                    if (body !== undefined) {
                        active.push(frame(declaration, arguments_));
                        const value = syntax(body, queries, depth, instantiated);
                        active.pop();
                        if (value !== undefined)
                            return value;
                    }
                }
                if (queries.isArrayLike(selectedType) && arguments_.length === 1) {
                    return { kind: "array", readonly: queries.indexes(selectedType).some(index => index.readonly), element: arguments_[0] };
                }
                if (arguments_.length > 0 || expanding(declaration, arguments_)) {
                    return nominal(selectedType, declaration, arguments_, queries, {
                        selectedType, declaration, authoredTypeNode: node,
                    }, depth, instantiated);
                }
            }
        }
        return type(selectedType, queries, { selectedType, authoredTypeNode: node }, depth, bindings);
    }
    function members(selectedType, queries, depth, bindings) {
        const inherited = new Map([...inheritedBindings(selectedType, queries, depth, bindings)]
            .map(([declaration, binding]) => [declaration, binding.value]));
        const result = [];
        for (const property of queries.properties(selectedType)) {
            const selectedOrigin = queries.memberOrigin(property, selectedType);
            if (selectedOrigin?.kind === "refused") {
                const failure = Object.freeze({ ...selectedOrigin, code: "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE" });
                for (const read of reads)
                    read.failure ?? (read.failure = failure);
                return undefined;
            }
            if (selectedOrigin === undefined) {
                // A synthetic member of several distinct root symbols has no single declared identity, so this structure
                // is not describable (the value is refused by totality, R1). Any other missing origin is an invariant failure.
                if (property.rootSymbols.length > 1)
                    return undefined;
                throw new Error(`Source member '${property.name}' has no approved checked origin.`);
            }
            const origin = selectedOrigin.origin;
            const literals = memberLiterals(property.type, property.optional, queries);
            const literal = literals === undefined ? {} : { literals };
            if (origin.kind !== "declared") {
                const value = type(property.type, queries, { selectedType: property.type }, depth + 1, inherited);
                if (value === undefined)
                    return undefined;
                result.push({ name: property.name, optional: property.optional, readonly: property.readonly,
                    origin, type: value, ...literal });
                continue;
            }
            const declaration = origin.declaration;
            const signature = ast.is.IsFunctionDeclaration(declaration) ||
                ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration);
            const annotation = signature ? undefined : ast.is.IsSetAccessorDeclaration(declaration)
                ? ast.typeNode(ast.parameters(declaration)[0]) : ast.typeNode(declaration);
            const initializer = ast.is.IsPropertyDeclaration(declaration) ? ast.as.AsPropertyDeclaration(declaration)?.Initializer
                : ast.is.IsPropertyAssignment(declaration) ? ast.as.AsPropertyAssignment(declaration)?.Initializer : undefined;
            let value = annotation === undefined && initializer !== undefined ? declaredValue(declaration, queries, inherited)
                : annotation === undefined ? type(property.type, queries, { selectedType: property.type, declaration }, depth + 1, inherited)
                    : syntax(annotation, queries, depth + 1, inherited);
            if (value === undefined)
                return undefined;
            if (property.optional)
                value = sourceTypeDescriptorOptional(value);
            result.push({ name: property.name, optional: property.optional, readonly: property.readonly,
                origin, type: value, ...literal });
        }
        return result;
    }
    // The literal values of a member's declared type in this arm (05 §2a D-2, R6): a literal type or a union of literal
    // types (string, number, bigint, boolean; an enum member by its value). Declaration input only: the property's type
    // in the selected arm type, after that arm's own application, never an expression type (R3). A type parameter that is
    // still unbound is not literal (D-10). The full boolean domain is not a literal set; absence of an optional member is
    // not a value. The set is sorted by value key, so equal sets have one spelling.
    function memberLiterals(selectedType, optional, queries) {
        const parts = queries.isUnion(selectedType) ? queries.members(selectedType) : [selectedType];
        const result = new Map();
        for (const part of parts) {
            if (optional && queries.isNullish(part))
                continue;
            const string = queries.stringLiteralValue(part);
            const number = string === undefined ? queries.numericLiteralValue(part) : undefined;
            const boolean = string === undefined && number === undefined ? queries.booleanLiteralValue(part) : undefined;
            const literal = string !== undefined ? { kind: "string", value: string }
                : typeof number === "bigint" ? { kind: "bigint", value: number }
                    : typeof number === "number" && Number.isFinite(number) ? { kind: "number", value: number }
                        : boolean !== undefined ? { kind: "boolean", value: boolean } : undefined;
            if (literal === undefined)
                return undefined;
            result.set(sourceTypeDescriptorLiteralKey(literal), Object.freeze(literal));
        }
        if (result.size === 0 || result.has("b:true") && result.has("b:false"))
            return undefined;
        return Object.freeze([...result].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([, literal]) => literal));
    }
    function inheritedBindings(selectedType, queries, depth, bindings, authoredBindings = empty) {
        const result = new Map(bindings);
        const authored = new Map(authoredBindings);
        const components = new Map();
        const application = queries.aliasApplication(selectedType);
        if (application?.kind === "direct" && application.bindings.length === 1 &&
            queries.homomorphicInput(selectedType) !== undefined) {
            const input = bindings.get(application.bindings[0].declaration);
            const declared = input?.kind === "declared" ? queries.declaredType(input.declaration) : undefined;
            const parameters = declared === undefined ? undefined
                : queries.typeArgumentBindings(declared)?.map(binding => binding.declaration);
            if (input?.kind === "declared")
                (parameters ?? parametersFor(input.declaration)).forEach((parameter, index) => {
                    const argument = input.typeArguments[index];
                    if (argument !== undefined)
                        result.set(parameter, argument);
                });
        }
        const declaration = queries.typeDeclaration(selectedType);
        const declaredType = declaration === undefined ? undefined : queries.declaredType(declaration);
        const pending = [{ type: declaredType ?? selectedType, depth: 0 }];
        const seen = new Set();
        while (pending.length > 0) {
            const current = pending.shift();
            if (seen.has(current.type))
                continue;
            seen.add(current.type);
            const owner = queries.typeDeclaration(current.type);
            const heritage = owner === undefined ? undefined : source.navigation.declaredHeritage(owner);
            if (heritage?.kind === "resolved")
                for (const edge of heritage.edges) {
                    parametersFor(edge.target.declaration).forEach((parameter, index) => {
                        if (result.has(parameter))
                            return;
                        const node = edge.typeArguments[index];
                        const declared = node === undefined ? undefined : syntax(node, queries, depth + 1, authored);
                        const proven = declared !== undefined && !sourceTypeDescriptorHasTypeVariables(ast, declared);
                        const argument = proven ? declared : node === undefined ? undefined : syntax(node, queries, depth + 1, result);
                        if (argument !== undefined)
                            result.set(parameter, argument);
                        const selectedType = proven && node !== undefined ? queries.authoredType(node) : undefined;
                        if (proven && selectedType !== undefined) {
                            authored.set(parameter, declared);
                            components.set(parameter, Object.freeze({ selectedType, authoredTypeNode: node }));
                        }
                    });
                }
            for (const binding of queries.typeArgumentBindings(current.type) ?? []) {
                if (result.has(binding.declaration))
                    continue;
                const argument = type(binding.argumentType, queries, { selectedType: binding.argumentType }, depth + 1, result);
                if (argument !== undefined)
                    result.set(binding.declaration, argument);
            }
            for (const base of queries.instantiatedBaseTypes(current.type) ?? [])
                pending.push({ type: base, depth: current.depth + 1 });
        }
        return new Map([...result].map(([declaration, value]) => [declaration, Object.freeze({ value,
                ...(components.has(declaration) ? { authoredComponent: components.get(declaration) } : {}) })]));
    }
    function indexes(selectedType, queries, depth, bindings, mappedOrigin) {
        const result = [];
        for (const index of queries.indexes(selectedType)) {
            const declaration = index.declaration ?? mappedOrigin;
            if (declaration === undefined || !(ast.is.IsIndexSignatureDeclaration(declaration) || ast.is.IsMappedTypeNode(declaration)) ||
                index.keyType === undefined || index.valueType === undefined)
                return undefined;
            const keyBase = queries.literalBaseType(index.keyType);
            if (keyBase === undefined || !queries.isIdentical(keyBase, index.keyType) ||
                !(queries.isStringLike(index.keyType) || queries.isNumberLike(index.keyType) ||
                    queries.isSymbolLike(index.keyType)))
                return undefined;
            const parameter = ast.is.IsIndexSignatureDeclaration(declaration) ? ast.parameters(declaration)[0] : undefined;
            const keyNode = parameter === undefined ? undefined : ast.typeNode(parameter);
            const valueNode = ast.is.IsMappedTypeNode(declaration) ? ast.as.AsMappedTypeNode(declaration)?.Type : ast.typeNode(declaration);
            // An authored key that is a union of key kinds (e.g. PropertyKey) yields one checker index per kind;
            // each index then takes its key from the checker's per-kind key type.
            const authoredKey = keyNode === undefined ? undefined : syntax(keyNode, queries, depth + 1, bindings);
            const key = authoredKey === undefined || authoredKey.kind === "union"
                ? type(index.keyType, queries, { selectedType: index.keyType }, depth + 1, bindings) : authoredKey;
            const value = valueNode === undefined ? type(index.valueType, queries, { selectedType: index.valueType }, depth + 1, bindings)
                : syntax(valueNode, queries, depth + 1, bindings);
            if (key === undefined || value === undefined || key.kind !== "string" &&
                !(key.kind === "primitive" && key.primitive !== "bool") &&
                !(key.kind === "intrinsic" && key.intrinsic === "symbol"))
                return undefined;
            result.push({ declaration, key, value, readonly: index.readonly });
        }
        return result;
    }
    function nominal(selectedType, declaration, arguments_, queries, component, depth, bindings, application) {
        const fixedArray = fixedArrayDeclaration(declaration);
        const extent = fixedArray ? fixedArrayExtent(component.authoredTypeNode, declaration, queries) : undefined;
        // A FixedArray reference whose extent no authored type argument states is not describable (the value is refused by
        // totality); the extent is never read from a checked literal type (R-C4-1, R3).
        if (fixedArray && extent === undefined)
            return undefined;
        const reference = { kind: "declared", declaration, typeArguments: arguments_, ...(extent === undefined ? {} : { extent }) };
        if (ast.is.IsTypeParameterDeclaration(declaration) || ast.is.IsEnumDeclaration(declaration))
            return reference;
        if (recursionCut(declaration, arguments_))
            return { ...reference, cut: "recursion" };
        const alias = ast.is.IsTypeAliasDeclaration(declaration);
        const body = alias ? ast.typeNode(declaration) : undefined;
        // Only a class or interface definition is reused: it is the checked type's structure under these bindings. An alias
        // definition also reads its application, conditional bindings and the enclosing alias bodies.
        const reusable = cutByDeclaration(declaration) && application === undefined && conditionalBindings.size === 0;
        const known = reusable ? expandedDefinition(declaration, selectedType, queries, bindings) : undefined;
        if (known !== undefined)
            return floor(reference, declaration, known.definition);
        const expansion = frame(declaration, arguments_);
        active.push(expansion);
        let definition;
        try {
            definition = application?.kind === "conditional"
                ? sourceTypeDescriptorConditionalDefinition(source, unions, queries, application, bindings, (node, selected, checked) => {
                    const previous = conditionalBindings;
                    conditionalBindings = new Map([...previous, ...checked]);
                    try {
                        return syntax(node, queries, depth + 1, selected);
                    }
                    finally {
                        conditionalBindings = previous;
                    }
                })
                : body === undefined ? structure(selectedType, queries, depth, bindings)
                    : ast.is.IsMappedTypeNode(body) || ast.is.IsConditionalTypeNode(body) || ast.is.IsIntersectionTypeNode(body)
                        ? type(selectedType, queries, component, depth, bindings, new Set(active.filter(selected => ast.is.IsTypeAliasDeclaration(selected.declaration)).map(selected => selected.declaration)))
                        : syntax(body, queries, depth, bindings);
        }
        finally {
            active.pop();
        }
        if (reusable && !reads.some(read => read.failure !== undefined)) {
            const known = expandedDefinitions.get(declaration) ?? [];
            known.push(Object.freeze({ selectedType, queries, bindings, requires: Object.freeze([...expansion.requires.values()]), definition }));
            expandedDefinitions.set(declaration, known);
        }
        return floor(reference, declaration, definition);
    }
    function floor(reference, declaration, definition) {
        if (definition !== undefined)
            return { ...reference, definition };
        // C29 floor: a nominal type declared in a declaration file (lib, profile or ambient package) whose structure contains
        // a form the descriptor cannot express is published by identity and type arguments alone; only a consumer that
        // needs its structure refuses. The descriptor model names the floor for a class, interface or alias reference; a
        // declaration-file alias whose definition is not expressible here (a deferred conditional such as `Awaited<T[K]>`,
        // a generic mapped body) is that reference (Q113). Project declarations must describe completely.
        const file = ast.getSourceFile(declaration);
        return file !== undefined && ast.isDeclarationFile(file) &&
            (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) || ast.is.IsInterfaceDeclaration(declaration) ||
                ast.is.IsTypeAliasDeclaration(declaration)) &&
            !reads.some(read => read.failure !== undefined)
            ? { ...reference, cut: "unexpressible" } : undefined;
    }
    // The FixedArray declaration carries the canonical "fixed-array" type marker (tsts).
    function pointerMarkerDeclaration(declaration) {
        const marker = source.sourceFacts.getFact(declaration, sourceMarkerFactKey);
        return marker?.kind === "type-marker" && (marker.marker === "pointer" || marker.marker === "raw-pointer" ||
            marker.marker === "function-pointer");
    }
    function fixedArrayDeclaration(declaration) {
        const marker = source.sourceFacts.getFact(declaration, sourceMarkerFactKey);
        return marker?.kind === "type-marker" && marker.marker === "fixed-array";
    }
    // The extent N of an authored FixedArray<T, N> reference: a non-negative integer literal type (number or bigint),
    // directly or through type aliases. Authored syntax input only.
    function fixedArrayExtent(authored, declaration, queries) {
        let reference = authored;
        while (reference !== undefined && ast.is.IsParenthesizedTypeNode(reference))
            reference = ast.as.AsParenthesizedTypeNode(reference)?.Type;
        if (reference === undefined || !ast.is.IsTypeReferenceNode(reference) ||
            queries.authoredTypeDeclaration(reference) !== declaration)
            return undefined;
        const seen = new Set();
        let current = ast.typeArguments(reference)[1];
        while (current !== undefined && !seen.has(current)) {
            seen.add(current);
            if (ast.is.IsParenthesizedTypeNode(current)) {
                current = ast.as.AsParenthesizedTypeNode(current)?.Type;
                continue;
            }
            const literal = ast.as.AsLiteralTypeNode(current)?.Literal;
            if (literal !== undefined) {
                const length = sourceIntegerLiteralValue(ast, literal);
                if (length === undefined || length < 0n || ast.is.IsPrefixUnaryExpression(literal))
                    return undefined;
                return Object.freeze({ length, lengthRuntimeBase: ast.is.IsBigIntLiteral(literal) ? "bigint" : "number" });
            }
            if (!ast.is.IsTypeReferenceNode(current))
                return undefined;
            const alias = queries.authoredTypeDeclaration(current);
            current = alias !== undefined && ast.is.IsTypeAliasDeclaration(alias) ? ast.typeNode(alias) : undefined;
        }
        return undefined;
    }
    function structure(selectedType, queries, depth, bindings, mappedOrigin) {
        for (const signature of [...queries.signatures(selectedType, "call"), ...queries.signatures(selectedType, "construct")]) {
            const declaration = signature.declaration;
            if (declaration !== undefined && refusedSignature(declaration))
                return undefined;
        }
        let scopes = activeCallables.get(selectedType);
        if (scopes === undefined) {
            scopes = new Set();
            activeCallables.set(selectedType, scopes);
        }
        const scope = active.length;
        if (scopes.has(scope))
            return undefined;
        scopes.add(scope);
        try {
            const selectedMembers = members(selectedType, queries, depth, bindings);
            const selectedIndexes = indexes(selectedType, queries, depth, bindings, mappedOrigin);
            const calls = signatures(selectedType, queries, "call", depth, bindings);
            const constructs = signatures(selectedType, queries, "construct", depth, bindings);
            if (selectedMembers === undefined || selectedIndexes === undefined || calls === undefined || constructs === undefined)
                return undefined;
            return selectedMembers.length === 0 && selectedIndexes.length === 0 && calls.length + constructs.length > 0
                ? { kind: "callable", calls, constructs }
                : { kind: "shape", members: selectedMembers, indexes: selectedIndexes, calls, constructs };
        }
        finally {
            scopes.delete(scope);
            if (scopes.size === 0)
                activeCallables.delete(selectedType);
        }
    }
    function tuple(selectedType, queries, depth, bindings, authored) {
        const elements = [];
        const authoredElements = authored === undefined ? [] : ast.elements(authored);
        for (const [index, element] of queries.tupleElements(selectedType).entries()) {
            const member = authoredElements[index] ?? element.declaration;
            let annotation = member === undefined ? undefined : ast.is.IsNamedTupleMember(member)
                ? ast.as.AsNamedTupleMember(member)?.Type
                : ast.is.IsParameterDeclaration(member) ? ast.typeNode(member) : member;
            if (annotation !== undefined && ast.is.IsOptionalTypeNode(annotation))
                annotation = ast.as.AsOptionalTypeNode(annotation)?.Type;
            if (annotation !== undefined && ast.is.IsRestTypeNode(annotation))
                annotation = ast.as.AsRestTypeNode(annotation)?.Type;
            let value = annotation === undefined ? type(element.type, queries, { selectedType: element.type }, depth + 1, bindings)
                : syntax(annotation, queries, depth + 1, bindings);
            if (value === undefined)
                return undefined;
            const kind = element.elementKind === "variadic" ? "rest" : element.elementKind;
            if (kind === "rest" && value.kind === "array" && !queries.isArrayLike(element.type))
                value = value.element;
            if (queries.isUnion(element.type) && queries.members(element.type).some(selected => queries.isAbsentConstituent(selected))) {
                value = sourceTypeDescriptorOptional(value);
            }
            const declaration = element.declaration ?? (member !== undefined && ast.is.IsNamedTupleMember(member) ? member : undefined);
            elements.push({ kind, type: value, ...(declaration === undefined ? {} : { declaration }) });
        }
        return { kind: "tuple", readonly: queries.indexes(selectedType).some(index => index.readonly), elements };
    }
    function signatures(selectedType, queries, kind, depth, bindings) {
        const result = [];
        for (const signature of queries.signatures(selectedType, kind)) {
            if (signature.returnType === undefined)
                return undefined;
            const declaration = signature.declaration;
            const parameters = [];
            for (const parameter of signature.parameters) {
                const annotation = parameter.declaration === undefined ? undefined : ast.typeNode(parameter.declaration);
                const selected = annotation === undefined ? type(parameter.type, queries, { selectedType: parameter.type,
                    ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }) }, depth + 1, bindings)
                    : syntax(annotation, queries, depth + 1, bindings);
                if (selected === undefined)
                    return undefined;
                parameters.push({ type: selected, kind: parameter.parameterKind,
                    ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }) });
            }
            const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
            const returned = annotation === undefined ? type(signature.returnType, queries, { selectedType: signature.returnType }, depth + 1, bindings)
                : syntax(annotation, queries, depth + 1, bindings);
            if (returned === undefined)
                return undefined;
            result.push({ ...(declaration === undefined ? {} : { declaration }),
                typeParameters: declaration === undefined ? [] : parametersFor(declaration), parameters, result: returned });
        }
        return result;
    }
    function type(selectedType, queries, component, depth = 0, bindings = empty, aliasBodies) {
        if (reads.some(read => read.failure !== undefined))
            return undefined;
        return expand(selectedType, component.authoredTypeNode ?? component.declaration, depth, () => readType(selectedType, queries, component, depth, bindings, aliasBodies));
    }
    function readType(selectedType, queries, component, depth, bindings, aliasBodies) {
        const declaration = queries.typeDeclaration(selectedType, undefined, aliasBodies);
        const substituted = declaration === undefined ? undefined : bindings.get(declaration);
        if (substituted !== undefined)
            return substituted;
        const direct = primitive(queries, { type: selectedType });
        if (direct !== undefined)
            return direct;
        // A named declared type (class, interface, alias, ...) with its described type arguments.
        function declared(declaration) {
            const arguments_ = [];
            // An alias instantiation carries its arguments on the checked alias application.
            const application = ast.is.IsTypeAliasDeclaration(declaration) ? queries.aliasApplication(selectedType) : undefined;
            const declaredBindings = application !== undefined && application.declaration === declaration
                ? application.bindings.map(binding => ({ declaration: binding.declaration, argumentType: binding.argument }))
                : queries.typeArgumentBindings(selectedType);
            const instantiated = new Map(bindings);
            for (const binding of declaredBindings ?? []) {
                const selected = bindings.get(binding.declaration) ?? type(binding.argumentType, queries, {
                    selectedType: binding.argumentType,
                }, depth + 1, bindings);
                if (selected === undefined)
                    return undefined;
                arguments_.push(selected);
                instantiated.set(binding.declaration, selected);
            }
            if (declaredBindings === undefined)
                for (const argument of queries.typeArguments(selectedType)) {
                    const selected = type(argument, queries, { selectedType: argument }, depth + 1, bindings);
                    if (selected === undefined)
                        return undefined;
                    arguments_.push(selected);
                }
            if (declaredBindings === undefined && arguments_.length === 0 && (ast.is.IsClassDeclaration(declaration) ||
                ast.is.IsClassExpression(declaration) || ast.is.IsInterfaceDeclaration(declaration))) {
                const owner = queries.declaredType(declaration);
                const parameters = owner === undefined ? undefined : queries.typeArgumentBindings(owner);
                if (parameters === undefined)
                    return undefined;
                for (const parameter of parameters) {
                    if (parameter.argumentType !== parameter.parameterType ||
                        queries.declaredType(parameter.declaration) !== parameter.parameterType)
                        return undefined;
                    const selected = type(parameter.argumentType, queries, { selectedType: parameter.argumentType }, depth + 1, bindings);
                    if (selected === undefined)
                        return undefined;
                    arguments_.push(selected);
                    instantiated.set(parameter.declaration, selected);
                }
            }
            return nominal(selectedType, declaration, arguments_, queries, component, depth, instantiated, application);
        }
        if (declaration !== undefined && ast.is.IsEnumDeclaration(declaration)) {
            return nominal(selectedType, declaration, [], queries, component, depth, bindings);
        }
        if (queries.isAny(selectedType))
            return { kind: "intrinsic", intrinsic: "any" };
        if (queries.isUnknown(selectedType))
            return { kind: "intrinsic", intrinsic: "unknown" };
        if (queries.isNonPrimitive(selectedType))
            return { kind: "intrinsic", intrinsic: "object" };
        if (queries.isNever(selectedType))
            return { kind: "intrinsic", intrinsic: "never" };
        if (queries.isNullish(selectedType))
            return { kind: "intrinsic", intrinsic: "absence" };
        if (queries.isVoidLike(selectedType))
            return { kind: "intrinsic", intrinsic: "void" };
        if (queries.isBooleanLike(selectedType))
            return { kind: "primitive", primitive: "bool" };
        if (queries.isNumberLike(selectedType))
            return { kind: "primitive", primitive: "float64" };
        if (queries.isStringLike(selectedType))
            return { kind: "string" };
        if (queries.isBigIntLike(selectedType))
            return { kind: "intrinsic", intrinsic: "bigint" };
        if (queries.isSymbolLike(selectedType))
            return { kind: "intrinsic", intrinsic: "symbol" };
        if (declaration !== undefined && (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration)) &&
            queries.signatures(selectedType, "construct").length > 0)
            return structure(selectedType, queries, depth, bindings);
        // A union named by a type alias is published as that alias (declared + definition, C-2263), exactly as an
        // authored alias reference is through syntax(); the declared branch below supplies its arguments and the
        // nominal recursion cut. Only an anonymous union, or an alias's own body, expands its members here.
        const unionAlias = declaration !== undefined && ast.is.IsTypeAliasDeclaration(declaration);
        if (queries.isUnion(selectedType) && unionAlias)
            return declared(declaration);
        if (queries.isUnion(selectedType)) {
            const types = [];
            for (const member of queries.members(selectedType)) {
                const selected = type(member, queries, { selectedType: member }, depth + 1, bindings, aliasBodies);
                if (selected === undefined)
                    return undefined;
                types.push(selected);
            }
            return sourceTypeDescriptorUnion(unions, types);
        }
        if (queries.isIntersection(selectedType)) {
            if (declaration !== undefined)
                return nominal(selectedType, declaration, [], queries, component, depth, bindings);
            // An anonymous intersection of object types is the checker's merged structure: its members and signatures.
            // A marker such as ThisType<T> contributes none. An intersection with a primitive part has no descriptor.
            const parts = queries.members(selectedType);
            return parts.some(part => queries.isStringLike(part) || queries.isNumberLike(part) ||
                queries.isBooleanLike(part) || queries.isBigIntLike(part) || queries.isSymbolLike(part) ||
                queries.isNullish(part) || queries.isVoidLike(part) || queries.isNever(part) ||
                queries.isAny(part) || queries.isUnknown(part))
                ? undefined : structure(selectedType, queries, depth, bindings);
        }
        if (queries.isTuple(selectedType)) {
            return tuple(selectedType, queries, depth, bindings);
        }
        const elementType = queries.arrayElementType(selectedType);
        if (elementType !== undefined) {
            const element = type(elementType, queries, { selectedType: elementType }, depth + 1, bindings);
            return element === undefined ? undefined : { kind: "array", readonly: queries.indexes(selectedType).some(index => index.readonly), element };
        }
        if (declaration !== undefined && !ast.is.IsTypeLiteralNode(declaration))
            return declared(declaration);
        if (queries.signatures(selectedType, "call").length > 0 || queries.signatures(selectedType, "construct").length > 0) {
            return structure(selectedType, queries, depth, bindings);
        }
        const body = aliasBodies === undefined ? undefined : [...aliasBodies].map(declaration => ast.typeNode(declaration))
            .find(body => body !== undefined && ast.is.IsMappedTypeNode(body));
        return structure(selectedType, queries, depth, bindings, body !== undefined && ast.is.IsMappedTypeNode(body) ? body : undefined);
    }
    const reader = Object.freeze({
        inheritedBindings: (selectedType, queries, bindings, authoredBindings = empty) => inheritedBindings(selectedType, queries, 0, bindings, authoredBindings),
        syntax: (node, queries, depth = 0, bindings = empty) => capture(() => syntax(node, queries, depth, bindings)),
        type: (component, queries, depth = 0, bindings = empty) => capture(() => type(component.selectedType, queries, component, depth, bindings)),
    });
    return reader;
}
//# sourceMappingURL=descriptors.js.map