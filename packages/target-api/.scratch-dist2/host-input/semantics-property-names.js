import { sourceClassFieldIsTypeOnly } from "../source-model/class-members.js";
import { isSourceCallableBodyBoundary } from "../source-model/callable-boundaries.js";
import { parseSourceNumericLiteral, sourceLiteralToken } from "../source-semantics/literal-token.js";
import { sourceIntegerConstantValue } from "../source-semantics/integer-constant.js";
const unavailable = Object.freeze({
    kind: "rejected",
    failure: "source",
    reason: "Computed property names require an exact string or finite numeric literal, a const binding of one literal type, an enum member, or a selected well-known symbol. Dynamic or effectful keys have no static native field representation.",
});
export function analyzeSourcePropertyNames(ast, files, navigation, enumConstants) {
    const entries = [];
    const issues = [];
    const facts = new WeakMap();
    const declarations = new WeakMap();
    const drafts = [];
    const inventory = [];
    const inputs = new Map(files.map(file => [file.sourceFile, file.semantics]));
    // On-demand fact computation (RC1 #2): a fact reads the facts of its operands and of referenced declarations through
    // factOf, so cross-file and forward references resolve whatever the file order. A reference cycle yields no fact.
    const computed = new WeakSet();
    const computing = new Set();
    const pending = files.map(file => file.sourceFile).reverse();
    while (pending.length > 0) {
        const current = pending.pop();
        inventory.push(current);
        const children = [];
        ast.forEachChild(current, child => { if (child !== undefined)
            children.push(child); });
        for (let index = children.length - 1; index >= 0; index -= 1)
            pending.push(children[index]);
    }
    for (const node of inventory)
        factOf(node);
    const validating = new Set();
    const validated = new Set();
    for (const fact of drafts)
        validateFact(fact);
    for (const fact of drafts)
        Object.freeze(fact);
    for (const node of inventory) {
        const parent = ast.parent(node);
        if (ast.is.IsComputedPropertyName(node) || isOrdinaryPropertyName(node, parent)) {
            record(node, admitName(node, ast.is.IsComputedPropertyName(node) ? select(node)
                : ast.is.IsNumericLiteral(node) ? selectedNumeric(node) : selectedString(ast.text(node))));
        }
        else if (ast.is.IsElementAccessExpression(node)) {
            const semantics = semanticsFor(node);
            const access = semantics.operations.elementAccess(node);
            if (access !== undefined && access.selectedElementIndex === undefined &&
                (access.selectedSymbol !== undefined || access.selectedDeclaration !== undefined) &&
                !onlyNumericIndexes(node, access.receiver.type, access.argument.type)) {
                const argument = access.argument.expression;
                const numeric = exactNumeric(argument);
                const member = numeric === undefined ? checkedEnumMember(argument) : undefined;
                if (numeric !== undefined) {
                    const selected = selectedLiteral(argument);
                    if (selected.kind === "resolved") {
                        const admitted = admitNumericName(selected, numericName(numeric));
                        if (admitted.kind === "rejected")
                            record(argument, admitted);
                    }
                }
                else if (member !== undefined) {
                    const entry = enumConstants.get(member);
                    if (entry?.kind === "rejected")
                        record(argument, rejected(entry.reason, entry.failure));
                }
            }
        }
    }
    const entriesByFile = new Map(files.map(file => [file.sourceFile, []]));
    const issuesByFile = new Map(files.map(file => [file.sourceFile, []]));
    for (const entry of entries)
        entriesByFile.get(ast.getSourceFile(entry.node)).push(entry);
    for (const issue of issues)
        issuesByFile.get(ast.getSourceFile(issue.node)).push(issue);
    return Object.freeze(files.map(({ sourceFile }) => {
        const selectedEntries = Object.freeze(entriesByFile.get(sourceFile));
        const values = new WeakMap(selectedEntries.map(entry => [entry.node, entry.selection]));
        return Object.freeze({ sourceFile, propertyNames: Object.freeze({
                entries: selectedEntries,
                issues: Object.freeze(issuesByFile.get(sourceFile)),
                get: (name) => values.get(name),
            }) });
    }));
    function semanticsFor(node) {
        const file = ast.getSourceFile(node);
        const semantics = file === undefined ? undefined : inputs.get(file);
        if (semantics === undefined)
            throw new Error("Property-name facts require the original checked source-file owner.");
        return semantics;
    }
    function record(node, selection) {
        entries.push(Object.freeze({ node, selection }));
        if (selection.kind === "rejected")
            issues.push(Object.freeze({ node, reason: selection.reason, failure: selection.failure }));
    }
    function admitName(node, selection) {
        if (selection.kind !== "resolved")
            return selection;
        const semantics = semanticsFor(node);
        const checked = semantics.operations.propertyName(node);
        if (checked === undefined || checked.kind === "unique-symbol")
            return rejected("The property key has no completed checked string or numeric member identity.");
        const parent = ast.parent(node);
        const element = parent === undefined ? undefined : semantics.operations.objectLiteralElement(parent);
        if (element?.contextualType !== undefined && element.sourceSelectedSymbol === undefined &&
            element.sourceSelectedDeclarations.length === 0 && onlyNumericIndexes(node, element.contextualType, checked.type)) {
            return Object.freeze({ ...selection, name: checked.name });
        }
        const admitted = admitNumericName(selection, checked.name);
        if (admitted.kind !== "resolved")
            return admitted;
        return Object.freeze({ ...admitted, name: checked.name });
    }
    function admitNumericName(selection, checked) {
        const numeric = selection.constant.kind === "numeric" || selection.constant.kind === "enum-member" && typeof selection.constant.entry.value === "bigint";
        return numeric && (selection.name !== String(Number(selection.name)) || selection.name !== checked) ? rejected(`Numeric property key ${selection.name} has checker key ${checked}; use the exact string key ${JSON.stringify(selection.name)} instead of a conflicting numeric named member.`) : selection;
    }
    function onlyNumericIndexes(node, owner, key) {
        const semantics = semanticsFor(node);
        const selection = semantics.types.selectIndexedAccess(owner, key);
        return selection?.kind === "resolved" && selection.members.length > 0 && selection.members.every(member => member.kind === "index" && member.index.keyType !== undefined && numberBacked(node, member.index.keyType));
    }
    function numberBacked(node, type) {
        const semantics = semanticsFor(node);
        return semantics.types.isNumberLike(type) || semantics.types.isIntersection(type) &&
            semantics.types.unionOrIntersectionTypes(type).some(part => semantics.types.isNumberLike(part));
    }
    function isOrdinaryPropertyName(node, parent) {
        if (parent === undefined || !ast.is.IsIdentifier(node) && !ast.is.IsStringLiteral(node) && !ast.is.IsNumericLiteral(node))
            return false;
        if (ast.is.IsBindingElement(parent)) {
            const pattern = ast.parent(parent);
            const binding = ast.as.AsBindingElement(parent);
            return pattern !== undefined && ast.is.IsObjectBindingPattern(pattern) &&
                (binding.PropertyName ?? ast.name(parent)) === node;
        }
        return ast.name(parent) === node && (ast.is.IsPropertyAssignment(parent) || ast.is.IsShorthandPropertyAssignment(parent) ||
            ast.is.IsPropertyDeclaration(parent) || ast.is.IsPropertySignatureDeclaration(parent) || ast.is.IsMethodDeclaration(parent) ||
            ast.is.IsMethodSignatureDeclaration(parent) || ast.is.IsGetAccessorDeclaration(parent) || ast.is.IsSetAccessorDeclaration(parent));
    }
    function select(name) {
        const selection = classify(name);
        if (selection.kind !== "resolved")
            return selection;
        const expression = (ast.is.IsComputedPropertyName(name) ? ast.as.AsComputedPropertyName(name) : undefined)?.Expression;
        const evidence = expression === undefined ? undefined : facts.get(expression);
        if (evidence?.valid === false)
            return rejected("A literal type assertion cannot turn an unproven runtime value into an exact static property key.");
        const numeric = expression === undefined ? undefined : exactNumeric(expression);
        if (numeric !== undefined && !finiteNumeric(numeric))
            return rejected("The numeric property key exceeds finite native literal bounds.");
        return selection;
    }
    function classify(name) {
        const semantics = semanticsFor(name);
        const expression = unwrap((ast.is.IsComputedPropertyName(name) ? ast.as.AsComputedPropertyName(name) : undefined)?.Expression);
        if (expression === undefined)
            return unavailable;
        const parent = ast.parent(name);
        const typeOnly = parent !== undefined && (ast.is.IsPropertySignatureDeclaration(parent) ||
            ast.is.IsMethodSignatureDeclaration(parent) || sourceClassFieldIsTypeOnly(ast, parent));
        const symbol = semantics.operations.wellKnownSymbol(name);
        if (symbol !== undefined) {
            return typeOnly || pureReference(expression) ? Object.freeze({ kind: "well-known-symbol", symbol: symbol.kind }) : rejected("A well-known-symbol property key must be a non-effectful reference; calls and getter evaluation cannot be erased.");
        }
        if (typeOnly) {
            const checked = semantics.operations.propertyName(name);
            if (checked?.kind === "unique-symbol") {
                const symbol = semantics.declarations.typeSymbol(checked.type);
                const declaration = symbol === undefined ? undefined : semantics.declarations.primarySymbolDeclaration(symbol);
                if (declaration === undefined)
                    throw new Error("A unique-symbol property key requires the declaration of its unique symbol.");
                return Object.freeze({ kind: "unique-symbol", declaration });
            }
            const declaration = ast.is.IsIdentifier(expression) ? navigation.sourceReferenceFor(expression)?.declaration
                : ast.is.IsPropertyAccessExpression(expression) ? semantics.operations.propertyAccess(expression)?.selectedDeclaration
                    : ast.is.IsElementAccessExpression(expression) ? semantics.operations.elementAccess(expression)?.selectedDeclaration : undefined;
            if (declaration !== undefined && ast.is.IsEnumMember(declaration))
                return selectedEnum(declaration);
            // RC1 #1d: a type-only key in a declaration file names a declared member only (no runtime key is evaluated) and the
            // Host reference model covers project files only, so the member name the checker binds the declaration to (the
            // effective property name, a selection witness) is the key. An authored literal key keeps its own fact.
            const file = ast.getSourceFile(name);
            if (file !== undefined && ast.isDeclarationFile(file) && !ast.is.IsStringLiteral(expression) &&
                !ast.is.IsNoSubstitutionTemplateLiteral(expression) && !ast.is.IsNumericLiteral(expression)) {
                return declarationMemberName(name);
            }
            return selectedLiteral(expression);
        }
        if (ast.is.IsStringLiteral(expression) || ast.is.IsNoSubstitutionTemplateLiteral(expression)) {
            return selectedString(ast.text(expression));
        }
        if (ast.is.IsNumericLiteral(expression) || signedNumericLiteral(expression))
            return selectedLiteral(expression);
        if (ast.is.IsIdentifier(expression)) {
            const declaration = navigation.sourceReferenceFor(expression)?.declaration;
            if (declaration !== undefined && constBinding(declaration))
                return selectedLiteral(expression);
            if (declaration !== undefined && ast.is.IsEnumMember(declaration))
                return selectedEnum(declaration);
            return rejected(declaration !== undefined && (ast.is.IsVariableDeclaration(declaration) || ast.is.IsBindingElement(declaration))
                ? "A mutable binding cannot define a static native field name; the key requires one exact const literal value."
                : "The computed key is not a const singleton binding or an exact enum constant.");
        }
        if (ast.is.IsCallExpression(expression))
            return rejected("A computed property key call must retain its effects and cannot be replaced with a static native field name.");
        const access = ast.is.IsPropertyAccessExpression(expression)
            ? semantics.operations.propertyAccess(expression)
            : ast.is.IsElementAccessExpression(expression) ? semantics.operations.elementAccess(expression) : undefined;
        // RC1 #1a: a pure read of a member whose declaration fixes one literal (an `as const` property, a literal-typed or
        // readonly literal-initialized property) is a key through that declaration's fact.
        if (access?.selectedDeclaration !== undefined && !ast.is.IsEnumMember(access.selectedDeclaration) &&
            memberFact(access.selectedDeclaration)?.constant !== undefined) {
            return pureReference(expression) ? selectedLiteral(expression)
                : rejected("A computed property key member read cannot contain calls or getter evaluation.");
        }
        if (access?.selectedDeclaration === undefined || !ast.is.IsEnumMember(access.selectedDeclaration))
            return rejected(access?.selectedDeclaration !== undefined && ast.is.IsGetAccessorDeclaration(access.selectedDeclaration)
                ? "A computed property key getter must retain its effects and cannot be replaced with a static native field name."
                : "The computed key has no exact literal, const binding, enum member or selected native symbol identity.");
        if (!pureReference(expression))
            return rejected("An enum property key receiver cannot contain calls or getter evaluation.");
        return selectedEnum(access.selectedDeclaration);
    }
    function unwrap(node) {
        let current = node;
        while (current !== undefined) {
            if (ast.is.IsParenthesizedExpression(current))
                current = ast.as.AsParenthesizedExpression(current)?.Expression;
            else if (ast.is.IsAsExpression(current))
                current = ast.as.AsAsExpression(current)?.Expression;
            else if (ast.is.IsTypeAssertion(current))
                current = ast.as.AsTypeAssertion(current)?.Expression;
            else if (ast.is.IsSatisfiesExpression(current))
                current = ast.as.AsSatisfiesExpression(current)?.Expression;
            else if (ast.is.IsNonNullExpression(current))
                current = ast.as.AsNonNullExpression(current)?.Expression;
            else
                break;
        }
        return current;
    }
    function signedNumericLiteral(node) {
        if (!ast.is.IsPrefixUnaryExpression(node))
            return false;
        const operator = ast.operatorKindName(node);
        const operand = unwrap(ast.as.AsPrefixUnaryExpression(node)?.Operand);
        return (operator === "KindPlusToken" || operator === "KindMinusToken") &&
            operand !== undefined && ast.is.IsNumericLiteral(operand);
    }
    function selectedLiteral(node) {
        const constant = facts.get(node)?.constant;
        if (constant?.kind === "enum-member")
            return selectedEnum(constant.entry.declaration);
        const member = checkedEnumMember(node);
        if (member !== undefined)
            return selectedEnum(member);
        if (constant?.kind === "numeric")
            return selectedNumeric(node);
        if (constant?.kind === "string")
            return selectedString(constant.value);
        return rejected("The computed key has no exact authored literal origin: a string or numeric literal, a const binding of one, or an enum member.");
    }
    function declarationMemberName(name) {
        const checked = semanticsFor(name).operations.propertyName(name);
        if (checked?.kind === "string")
            return selectedString(checked.name);
        const numeric = checked?.kind === "numeric" ? numericTokenFromText(checked.name) : undefined;
        return numeric === undefined ? unavailable
            : Object.freeze({ kind: "resolved", name: numericName(numeric), constant: Object.freeze({ kind: "numeric", token: numeric }) });
    }
    function selectedNumeric(node) {
        const numeric = exactNumeric(node);
        if (numeric !== undefined && !finiteNumeric(numeric))
            return rejected("The numeric property key exceeds finite native literal bounds.");
        return numeric === undefined ? rejected("The numeric key has no exact authored literal origin corresponding to its checked constant value.")
            : Object.freeze({ kind: "resolved", name: numericName(numeric), constant: Object.freeze({ kind: "numeric", token: numeric }) });
    }
    function selectedString(value) {
        return Object.freeze({ kind: "resolved", name: value, constant: Object.freeze({ kind: "string", value }) });
    }
    function selectedEnum(node) {
        const constant = enumConstants.get(node);
        if (constant === undefined)
            throw new Error("A selected checked enum member requires its completed source constant entry.");
        if (constant.kind === "rejected")
            return Object.freeze({ kind: "rejected", reason: constant.reason, failure: constant.failure });
        const numeric = typeof constant.value === "bigint" ? numericTokenFromText(constant.value.toString()) : undefined;
        return Object.freeze({ kind: "resolved", name: typeof constant.value === "string" ? constant.value : numericName(numeric),
            constant: Object.freeze({ kind: "enum-member", entry: constant }) });
    }
    function checkedEnumMember(node) {
        const semantics = semanticsFor(node);
        const current = unwrap(node);
        if (current === undefined)
            return undefined;
        const declaration = ast.is.IsIdentifier(current) ? navigation.sourceReferenceFor(current)?.declaration
            : ast.is.IsPropertyAccessExpression(current) ? semantics.operations.propertyAccess(current)?.selectedDeclaration
                : ast.is.IsElementAccessExpression(current) ? semantics.operations.elementAccess(current)?.selectedDeclaration : undefined;
        return declaration !== undefined && ast.is.IsEnumMember(declaration) ? declaration : undefined;
    }
    function finiteNumeric(token) {
        return Number.isFinite(Number(token.decimalText));
    }
    /** A tuple type node whose every element is required (no optional, rest or variadic element). */
    function requiredTupleType(node) {
        return ast.elements(node).every(element => {
            if (element === undefined)
                return false;
            const kind = ast.kindName(element);
            if (kind === "KindOptionalType" || kind === "KindRestType")
                return false;
            if (kind !== "KindNamedTupleMember")
                return true;
            const member = ast.as.AsNamedTupleMember(element);
            return member?.QuestionToken === undefined && member?.DotDotDotToken === undefined;
        });
    }
    /**
     * A spread operand that is a fixed tuple by its authored syntax: an `as const` array literal without spreads, or a
     * reference to a const binding annotated with a required-element tuple type (optionally readonly) or initialized by one.
     */
    function fixedTupleOperand(expression) {
        const current = ast.is.IsParenthesizedExpression(expression) ? unwrap(expression) : expression;
        if (current === undefined)
            return false;
        if (constArrayLiteral(current))
            return true;
        if (!ast.is.IsIdentifier(current))
            return false;
        const declaration = navigation.sourceReferenceFor(current)?.declaration;
        if (declaration === undefined || !ast.is.IsVariableDeclaration(declaration) || ast.variableDeclarationKind(declaration) !== "const")
            return false;
        let annotation = ast.typeNode(declaration);
        if (annotation !== undefined && ast.is.IsTypeOperatorNode(annotation))
            annotation = ast.as.AsTypeOperatorNode(annotation)?.Type;
        if (annotation !== undefined)
            return ast.is.IsTupleTypeNode(annotation) && requiredTupleType(annotation);
        const initializer = ast.as.AsVariableDeclaration(declaration)?.Initializer;
        return initializer !== undefined && constArrayLiteral(initializer);
    }
    function constArrayLiteral(node) {
        if (!ast.is.IsAsExpression(node))
            return false;
        const assertion = ast.as.AsAsExpression(node);
        const type = assertion?.Type;
        const value = assertion?.Expression === undefined ? undefined : unwrap(assertion.Expression);
        return type !== undefined && ast.is.IsTypeReferenceNode(type) && ast.text(type) === "const" &&
            value !== undefined && ast.is.IsArrayLiteralExpression(value) &&
            ast.elements(value).every(element => element !== undefined && !ast.is.IsSpreadElement(element));
    }
    function exactNumeric(node) {
        const fact = facts.get(node);
        const constant = fact?.constant;
        if (constant?.kind === "numeric")
            return constant.token;
        if (constant?.kind === "enum-member" && typeof constant.entry.value === "bigint") {
            return numericTokenFromText(constant.entry.value.toString());
        }
        return undefined;
    }
    function createFact(input) {
        const fact = { ...input, contracts: input.contracts ?? [], declarationOnly: input.declarationOnly ?? false,
            valid: input.valid ?? true };
        drafts.push(fact);
        return fact;
    }
    function constantName(constant) {
        return constant.kind === "string" ? constant.value : constant.kind === "numeric" ? numericName(constant.token)
            : typeof constant.entry.value === "string" ? constant.entry.value : constant.entry.value.toString();
    }
    function literalFact(node) {
        if (ast.is.IsStringLiteral(node) || ast.is.IsNoSubstitutionTemplateLiteral(node)) {
            return createFact({ constant: Object.freeze({ kind: "string", value: ast.text(node) }) });
        }
        if (!ast.is.IsNumericLiteral(node))
            return undefined;
        const token = sourceLiteralToken(ast, node);
        const numeric = token.kind === "authored" ? parseSourceNumericLiteral(token.text)?.token
            : numericTokenFromText(ast.text(node));
        return numeric === undefined ? undefined : createFact({ constant: Object.freeze({ kind: "numeric", token: numeric }) });
    }
    function enumFact(member) {
        const existing = declarations.get(member);
        if (existing !== undefined)
            return existing;
        const entry = enumConstants.get(member);
        if (entry?.kind !== "resolved")
            return undefined;
        const fact = createFact({ constant: Object.freeze({ kind: "enum-member", entry }) });
        declarations.set(member, fact);
        return fact;
    }
    function declaredFact(node, active = new Set()) {
        if (node === undefined || active.has(node))
            return undefined;
        const file = ast.getSourceFile(node);
        if (file === undefined || !inputs.has(file))
            return undefined;
        active.add(node);
        try {
            if (ast.is.IsLiteralTypeNode(node)) {
                const literal = ast.as.AsLiteralTypeNode(node)?.Literal;
                return literal === undefined ? undefined : facts.get(literal) ?? literalFact(literal);
            }
            if (ast.is.IsParenthesizedTypeNode(node))
                return declaredFact(ast.as.AsParenthesizedTypeNode(node)?.Type, active);
            if (ast.is.IsTypeOperatorNode(node) && ast.operatorKindName(node) === "KindReadonlyKeyword") {
                return declaredFact(ast.as.AsTypeOperatorNode(node)?.Type, active);
            }
            if (ast.is.IsTypeQueryNode(node)) {
                const name = ast.as.AsTypeQueryNode(node)?.ExprName;
                const declaration = name === undefined ? undefined : navigation.sourceReferenceFor(name)?.declaration;
                return declaration === undefined ? undefined : ast.is.IsEnumMember(declaration) ? enumFact(declaration) : declarationFact(declaration);
            }
            if (ast.is.IsTypeReferenceNode(node)) {
                const name = ast.as.AsTypeReferenceNode(node)?.TypeName;
                const declaration = name === undefined ? undefined : navigation.sourceReferenceFor(name)?.declaration;
                if (declaration !== undefined && ast.is.IsEnumMember(declaration))
                    return enumFact(declaration);
                return declaration !== undefined && ast.is.IsTypeAliasDeclaration(declaration)
                    ? declaredFact(ast.typeNode(declaration), active) : undefined;
            }
            if (ast.is.IsTupleTypeNode(node)) {
                if (!requiredTupleType(node))
                    return undefined;
                return createFact({ elements: Object.freeze(ast.elements(node).map(element => element === undefined ? undefined : declaredFact(ast.typeNode(element) ?? element, active))), declarationOnly: true });
            }
            return undefined;
        }
        finally {
            active.delete(node);
        }
    }
    function validateFact(fact) {
        if (validated.has(fact))
            return fact.valid;
        if (validating.has(fact))
            return false;
        validating.add(fact);
        fact.valid = fact.valid && (fact.input === undefined || validateFact(fact.input)) &&
            (fact.owner === undefined || validateFact(fact.owner));
        for (const node of fact.contracts) {
            const contract = declaredFact(node);
            if (contract === undefined)
                continue;
            fact.valid = fact.valid && validateFact(contract);
            if (fact.declarationOnly && fact.constant === undefined && fact.elements === undefined && fact.members === undefined) {
                if (contract.constant !== undefined)
                    fact.constant = contract.constant;
                if (contract.elements !== undefined)
                    fact.elements = contract.elements;
                if (contract.members !== undefined)
                    fact.members = contract.members;
            }
            else
                fact.valid = fact.valid && contractAgrees(contract, fact);
        }
        validating.delete(fact);
        validated.add(fact);
        return fact.valid;
    }
    function contractAgrees(contract, actual) {
        if (contract.constant !== undefined)
            return actual.constant !== undefined &&
                constantName(contract.constant) === constantName(actual.constant);
        if (contract.elements !== undefined)
            return actual.elements !== undefined &&
                contract.elements.length === actual.elements.length && contract.elements.every((element, position) => element === undefined || actual.elements?.[position] !== undefined &&
                validateFact(element) && contractAgrees(element, actual.elements[position]));
        return true;
    }
    function bindFact(name, declaration, input) {
        if (ast.is.IsIdentifier(name)) {
            const annotation = ast.typeNode(declaration);
            const fact = annotation === undefined && input !== undefined ? input : createFact({
                ...(input === undefined ? {} : { ...input, input }),
                contracts: annotation === undefined ? [] : [annotation], declarationOnly: input === undefined
            });
            facts.set(name, fact);
            declarations.set(declaration, fact);
            return;
        }
        if (!ast.is.IsArrayBindingPattern(name) && !ast.is.IsObjectBindingPattern(name))
            return;
        for (const [position, element] of ast.elements(name).entries()) {
            if (element === undefined || !ast.is.IsBindingElement(element))
                continue;
            const binding = ast.as.AsBindingElement(element);
            const target = ast.name(element);
            if (target === undefined || binding.DotDotDotToken !== undefined)
                continue;
            const property = binding.PropertyName ?? target;
            const selected = ast.is.IsArrayBindingPattern(name) ? input?.elements?.[position]
                : ast.is.IsIdentifier(property) || ast.is.IsStringLiteral(property) ? input?.members?.get(ast.text(property)) : undefined;
            const value = selected ?? (binding.Initializer === undefined ? undefined : factOf(binding.Initializer));
            bindFact(target, element, value === undefined ? undefined : createFact({ ...value, input: value,
                ...(input === undefined ? {} : { owner: input }) }));
        }
    }
    function callFact(node) {
        const semantics = semanticsFor(node);
        const call = semantics.operations.call(node);
        const result = call === undefined ? undefined : semantics.operations.callResult(call);
        const authoredType = result?.authoredTypeNode;
        if (call !== undefined && authoredType === undefined)
            return returnedFact(semantics.declarations.signatureDeclaration(call.selectedSignature));
        const file = authoredType === undefined ? undefined : ast.getSourceFile(authoredType);
        if (authoredType === undefined || file === undefined || !inputs.has(file))
            return undefined;
        const declared = declaredFact(authoredType);
        if (declared !== undefined || call === undefined)
            return declared;
        const typeName = ast.is.IsTypeReferenceNode(authoredType) ? ast.as.AsTypeReferenceNode(authoredType)?.TypeName : undefined;
        const parameter = typeName === undefined ? undefined : navigation.sourceReferenceFor(typeName)?.declaration;
        if (parameter === undefined || !ast.is.IsTypeParameterDeclaration(parameter))
            return undefined;
        const selected = call.sourceSelectedMethodTypeArguments?.find(candidate => {
            const symbol = semantics.declarations.typeSymbol(candidate.typeParameter);
            return symbol !== undefined && semantics.declarations.symbolDeclarations(symbol).includes(parameter);
        });
        const explicit = declaredFact(selected?.explicitTypeNode);
        if (explicit !== undefined)
            return explicit;
        const argumentExpressions = call.sourceSelectedSignatureParameters.filter(candidate => {
            const name = candidate.authoredTypeNode !== undefined && ast.is.IsTypeReferenceNode(candidate.authoredTypeNode)
                ? ast.as.AsTypeReferenceNode(candidate.authoredTypeNode)?.TypeName : undefined;
            return name !== undefined && navigation.sourceReferenceFor(name)?.declaration === parameter;
        }).flatMap(candidate => call.sourceArgumentBindings.filter(argument => argument.sourceParameterIndex === candidate.parameterIndex).map(argument => call.sourceArguments[argument.sourceArgumentIndex]?.expression));
        const arguments_ = argumentExpressions.map(input => input === undefined ? undefined : factOf(input));
        const first = arguments_[0];
        return first?.constant !== undefined && arguments_.every(argument => argument?.constant !== undefined &&
            constantName(argument.constant) === constantName(first.constant)) ? first : undefined;
    }
    // The memoized, cycle-guarded fact of a node (RC1 #2). Nodes outside the input files have no fact.
    function factOf(node) {
        if (!computed.has(node)) {
            const file = ast.getSourceFile(node);
            if (computing.has(node) || file === undefined || !inputs.has(file))
                return facts.get(node);
            computing.add(node);
            try {
                completeFact(node);
            }
            finally {
                computing.delete(node);
            }
            computed.add(node);
        }
        return facts.get(node);
    }
    // The fact a declaration binds: its enclosing variable or parameter declaration is completed first (a binding
    // element binds through its pattern root).
    function declarationFact(declaration) {
        let root = declaration;
        while (root !== undefined && (ast.is.IsBindingElement(root) || ast.is.IsArrayBindingPattern(root) || ast.is.IsObjectBindingPattern(root))) {
            root = ast.parent(root);
        }
        if (root !== undefined && (ast.is.IsVariableDeclaration(root) || ast.is.IsParameterDeclaration(root)))
            factOf(root);
        return declarations.get(declaration);
    }
    // The member declaration a property or element access selected (a checker selection witness).
    function selectedMemberDeclaration(node) {
        const semantics = semanticsFor(node);
        const access = ast.is.IsPropertyAccessExpression(node) ? semantics.operations.propertyAccess(node)
            : ast.is.IsElementAccessExpression(node) ? semantics.operations.elementAccess(node) : undefined;
        return access?.selectedDeclaration;
    }
    /**
     * RC1 #1a: the key fact of a read of a member whose declaration fixes one literal value: a property of an `as const`
     * object literal (its authored initializer), a property declared with a literal type annotation (declaration input),
     * or a readonly class property initialized by a literal (its declared type is that literal). undefined otherwise.
     */
    function memberFact(declaration) {
        if (ast.is.IsPropertyAssignment(declaration) || ast.is.IsShorthandPropertyAssignment(declaration)) {
            const literal = ast.parent(declaration);
            if (literal === undefined || !constAssertedLiteral(literal))
                return undefined;
            const value = ast.is.IsPropertyAssignment(declaration) ? ast.as.AsPropertyAssignment(declaration)?.Initializer : ast.name(declaration);
            return value === undefined ? undefined : factOf(value);
        }
        if (!ast.is.IsPropertyDeclaration(declaration) && !ast.is.IsPropertySignatureDeclaration(declaration))
            return undefined;
        const annotation = ast.typeNode(declaration);
        if (annotation !== undefined)
            return declaredFact(annotation);
        const initializer = ast.is.IsPropertyDeclaration(declaration) && ast.hasModifierKind(declaration, "readonly")
            ? ast.as.AsPropertyDeclaration(declaration)?.Initializer : undefined;
        return initializer === undefined ? undefined : factOf(initializer);
    }
    /** An object or array literal that is (an element or member of) the operand of an `as const` assertion. */
    function constAssertedLiteral(literal) {
        let current = literal;
        while (current !== undefined) {
            const parent = ast.parent(current);
            if (parent === undefined)
                return false;
            if (ast.is.IsParenthesizedExpression(parent) || ast.is.IsArrayLiteralExpression(parent) || ast.is.IsObjectLiteralExpression(parent) ||
                ast.is.IsPropertyAssignment(parent)) {
                current = parent;
                continue;
            }
            if (!ast.is.IsAsExpression(parent))
                return false;
            const type = ast.as.AsAsExpression(parent)?.Type;
            return type !== undefined && ast.is.IsTypeReferenceNode(type) && ast.text(type) === "const";
        }
        return false;
    }
    /**
     * RC1 #1b: the key fact of a call whose selected callee has no authored return type: the one constant every returned
     * expression of its body states with a non-widening assertion (`return "x" as const`, `return "x" as "x"`). A returned
     * value without such an assertion widens in the inferred return type, so it fixes no key.
     */
    function returnedFact(callee) {
        const body = callee === undefined ? undefined : ast.body(callee);
        if (body === undefined)
            return undefined;
        const returned = [];
        let open = false;
        const pending = [body];
        while (pending.length > 0) {
            const node = pending.pop();
            if (node !== body && isSourceCallableBodyBoundary(ast, node))
                continue;
            if (node === body && !ast.is.IsBlock(node))
                returned.push(node);
            else if (ast.is.IsReturnStatement(node)) {
                const expression = ast.as.AsReturnStatement(node)?.Expression;
                if (expression === undefined)
                    open = true;
                else
                    returned.push(expression);
            }
            else
                ast.forEachChild(node, child => { if (child !== undefined)
                    pending.push(child); });
        }
        if (open || returned.length === 0)
            return undefined;
        const selected = returned.map(expression => {
            let current = expression;
            while (current !== undefined && ast.is.IsParenthesizedExpression(current))
                current = ast.as.AsParenthesizedExpression(current)?.Expression;
            return current !== undefined && (ast.is.IsAsExpression(current) || ast.is.IsTypeAssertion(current)) ? factOf(current) : undefined;
        });
        const first = selected[0];
        return first?.constant !== undefined && selected.every(fact => fact?.constant !== undefined && fact.valid &&
            fact.constant.kind === first.constant.kind && constantName(fact.constant) === constantName(first.constant)) ? first : undefined;
    }
    function completeFact(node) {
        const literal = literalFact(node);
        if (literal !== undefined) {
            facts.set(node, literal);
            return;
        }
        if (ast.is.IsEnumMember(node)) {
            const fact = enumFact(node);
            if (fact !== undefined)
                facts.set(node, fact);
            return;
        }
        if (ast.is.IsVariableDeclaration(node)) {
            const name = ast.name(node);
            const initializer = ast.as.AsVariableDeclaration(node)?.Initializer;
            if (name !== undefined)
                bindFact(name, node, initializer === undefined ? declaredFact(ast.typeNode(node)) : factOf(initializer));
            return;
        }
        if (ast.is.IsParameterDeclaration(node)) {
            const name = ast.name(node);
            if (name !== undefined)
                bindFact(name, node, declaredFact(ast.typeNode(node)));
            return;
        }
        if (ast.is.IsIdentifier(node)) {
            const declaration = navigation.sourceReferenceFor(node)?.declaration;
            const fact = declaration === undefined ? undefined : ast.is.IsEnumMember(declaration) ? enumFact(declaration)
                : declarationFact(declaration) ?? declaredFact(ast.typeNode(declaration));
            if (fact !== undefined)
                facts.set(node, fact);
            return;
        }
        if (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node)) {
            const member = checkedEnumMember(node);
            const declaration = member === undefined ? selectedMemberDeclaration(node) : undefined;
            const fact = member !== undefined ? enumFact(member) : declaration === undefined ? undefined : memberFact(declaration);
            if (fact !== undefined)
                facts.set(node, fact);
            return;
        }
        if (ast.is.IsConditionalExpression(node)) {
            // RC1 #1c: both branches of one constant (`c ? "x" : "x"`) are that constant.
            const conditional = ast.as.AsConditionalExpression(node);
            const whenTrue = conditional?.WhenTrue === undefined ? undefined : factOf(conditional.WhenTrue);
            const whenFalse = conditional?.WhenFalse === undefined ? undefined : factOf(conditional.WhenFalse);
            if (whenTrue?.constant !== undefined && whenFalse?.constant !== undefined &&
                constantName(whenTrue.constant) === constantName(whenFalse.constant) &&
                whenTrue.constant.kind === whenFalse.constant.kind) {
                facts.set(node, createFact({ constant: whenTrue.constant, input: whenTrue, owner: whenFalse }));
            }
            return;
        }
        const wrapper = ast.is.IsParenthesizedExpression(node) ? ast.as.AsParenthesizedExpression(node)
            : ast.is.IsAsExpression(node) ? ast.as.AsAsExpression(node)
                : ast.is.IsTypeAssertion(node) ? ast.as.AsTypeAssertion(node)
                    : ast.is.IsSatisfiesExpression(node) ? ast.as.AsSatisfiesExpression(node)
                        : ast.is.IsNonNullExpression(node) ? ast.as.AsNonNullExpression(node) : undefined;
        if (wrapper !== undefined) {
            const input = wrapper.Expression === undefined ? undefined : factOf(wrapper.Expression);
            const annotation = ast.is.IsAsExpression(node) ? ast.as.AsAsExpression(node)?.Type
                : ast.is.IsTypeAssertion(node) ? ast.as.AsTypeAssertion(node)?.Type : undefined;
            facts.set(node, annotation === undefined && input !== undefined ? input : createFact({
                ...(input === undefined ? {} : { ...input, input }), contracts: annotation === undefined ? [] : [annotation],
                declarationOnly: false, valid: input !== undefined
            }));
            return;
        }
        if (ast.is.IsPrefixUnaryExpression(node)) {
            const expression = ast.as.AsPrefixUnaryExpression(node);
            const input = expression?.Operand === undefined ? undefined : factOf(expression.Operand);
            const constant = input?.constant;
            const operator = ast.operatorKindName(node);
            if (constant?.kind === "numeric" && (operator === "KindPlusToken" || operator === "KindMinusToken")) {
                facts.set(node, createFact({ constant: Object.freeze({ kind: "numeric", token: operator === "KindPlusToken" ? constant.token
                            : Object.freeze({ ...constant.token, negative: !constant.token.negative }) }), input }));
            }
            return;
        }
        if (ast.is.IsBinaryExpression(node)) {
            const value = sourceIntegerConstantValue(ast, node);
            const token = value === undefined ? undefined : numericTokenFromText(value.toString());
            if (token !== undefined)
                facts.set(node, createFact({ constant: Object.freeze({ kind: "numeric", token }) }));
            return;
        }
        if (ast.is.IsCallExpression(node)) {
            const fact = callFact(node);
            if (fact !== undefined)
                facts.set(node, fact);
            return;
        }
        if (ast.is.IsArrayLiteralExpression(node)) {
            const elements = [];
            for (const element of ast.elements(node)) {
                if (element !== undefined && ast.is.IsSpreadElement(element)) {
                    const expression = ast.as.AsSpreadElement(element)?.Expression;
                    if (expression === undefined || !fixedTupleOperand(expression))
                        return;
                    const selected = expression === undefined ? undefined : factOf(expression)?.elements;
                    if (selected === undefined)
                        return;
                    elements.push(...selected);
                }
                else
                    elements.push(element === undefined ? undefined : factOf(element));
            }
            facts.set(node, createFact({ elements: Object.freeze(elements) }));
            return;
        }
        if (ast.is.IsObjectLiteralExpression(node)) {
            const members = new Map();
            for (const property of ast.properties(node)) {
                if (property === undefined)
                    continue;
                const name = ast.name(property);
                if (name === undefined || !ast.is.IsIdentifier(name) && !ast.is.IsStringLiteral(name))
                    continue;
                const value = ast.is.IsPropertyAssignment(property) ? ast.as.AsPropertyAssignment(property)?.Initializer
                    : ast.is.IsShorthandPropertyAssignment(property) ? name : undefined;
                const fact = value === undefined ? undefined : factOf(value);
                if (fact !== undefined)
                    members.set(ast.text(name), fact);
            }
            facts.set(node, createFact({ members }));
        }
    }
    function rejected(reason, failure = "source") {
        return Object.freeze({ kind: "rejected", reason, failure });
    }
    function constBinding(declaration) {
        let current = declaration;
        while (current !== undefined && ast.is.IsBindingElement(current)) {
            const pattern = ast.parent(current);
            current = pattern === undefined ? undefined : ast.parent(pattern);
        }
        return current !== undefined && ast.is.IsVariableDeclaration(current) && ast.variableDeclarationKind(current) === "const";
    }
    function pureReference(node) {
        const semantics = semanticsFor(node);
        const current = unwrap(node);
        if (current === undefined)
            return false;
        if (ast.is.IsIdentifier(current))
            return true;
        if (ast.is.IsPropertyAccessExpression(current)) {
            const access = ast.as.AsPropertyAccessExpression(current);
            const declaration = semantics.operations.propertyAccess(current)?.selectedDeclaration;
            return declaration !== undefined && !ast.is.IsGetAccessorDeclaration(declaration) && !ast.is.IsSetAccessorDeclaration(declaration) &&
                access?.QuestionDotToken === undefined && access?.Expression !== undefined && pureReference(access.Expression);
        }
        if (ast.is.IsElementAccessExpression(current)) {
            const access = ast.as.AsElementAccessExpression(current);
            const key = unwrap(access?.ArgumentExpression);
            const declaration = semantics.operations.elementAccess(current)?.selectedDeclaration;
            return declaration !== undefined && !ast.is.IsGetAccessorDeclaration(declaration) && !ast.is.IsSetAccessorDeclaration(declaration) &&
                access?.QuestionDotToken === undefined && access?.Expression !== undefined && pureReference(access.Expression) &&
                key !== undefined && (ast.is.IsStringLiteral(key) || ast.is.IsNumericLiteral(key));
        }
        return false;
    }
}
function numericTokenFromText(text) {
    const negative = text.startsWith("-");
    const token = parseSourceNumericLiteral(negative ? text.slice(1) : text)?.token;
    return token === undefined ? undefined : negative ? Object.freeze({ ...token, negative }) : token;
}
function numericName(token) {
    if (token.coefficient === 0n)
        return "0";
    const coefficient = token.coefficient.toString();
    const digits = coefficient.replace(/0+$/u, "");
    const point = BigInt(coefficient.length) + token.exponent;
    const prefix = token.negative ? "-" : "";
    if (point > 0n && point <= 21n) {
        const position = Number(point);
        return prefix + (position >= digits.length ? digits.padEnd(position, "0")
            : `${digits.slice(0, position)}.${digits.slice(position)}`);
    }
    if (point <= 0n && point >= -5n)
        return `${prefix}0.${"0".repeat(Number(-point))}${digits}`;
    const exponent = point - 1n;
    return `${prefix}${digits[0]}${digits.length === 1 ? "" : `.${digits.slice(1)}`}e${exponent < 0n ? "" : "+"}${exponent}`;
}
//# sourceMappingURL=semantics-property-names.js.map