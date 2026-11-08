var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _CallableIntegerRanges_options, _CallableIntegerRanges_ranges, _CallableIntegerRanges_safeBindings, _CallableIntegerRanges_remaining, _CallableIntegerRanges_abandoned;
import { Node_Expression, Node_Initializer } from "../../source-model/ast.js";
import { sourceNodeHasRole } from "../../source-model/callable-boundaries.js";
import { binaryIntegerRange, integerRange, joinIntegerRanges } from "./domain.js";
export function analyzeSourceIntegerRanges(options) {
    const ranges = new WeakMap();
    const candidates = [];
    const { ast } = options;
    const callables = new Set();
    const pending = options.sourceFiles.map(node => ({ node }));
    while (pending.length > 0) {
        const current = pending.pop();
        const { node } = current;
        // The analysis unit is a callable body (E13 callable-body: functions, methods, constructors, accessors).
        const owner = sourceNodeHasRole(ast, node, "callable-body") ? node : current.owner;
        if (owner !== undefined && ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindPercentToken")
            callables.add(owner);
        ast.forEachChild(node, child => { if (child !== undefined)
            pending.push({ node: child, owner }); });
    }
    for (const callable of callables) {
        const analysis = new CallableIntegerRanges(options);
        for (const [expression, range] of analysis.analyze(callable)) {
            ranges.set(expression, range);
            if (ast.is.IsBinaryExpression(expression) && ast.operatorKindName(expression) === "KindPercentToken")
                candidates.push(expression);
        }
    }
    const exactInt32Remainders = candidates.filter(expression => {
        const binary = ast.as.AsBinaryExpression(expression);
        const left = binary?.Left === undefined ? undefined : ranges.get(binary.Left);
        const right = binary?.Right === undefined ? undefined : ranges.get(binary.Right);
        return ranges.has(expression) && left !== undefined && right !== undefined &&
            left.minimum >= 0 && left.maximum <= 2147483647 &&
            right.minimum > 0 && right.maximum <= 2147483647;
    });
    return Object.freeze({
        range: (expression) => ranges.get(expression),
        exactInt32Remainders: Object.freeze(exactInt32Remainders),
    });
}
class CallableIntegerRanges {
    constructor(options) {
        _CallableIntegerRanges_options.set(this, void 0);
        _CallableIntegerRanges_ranges.set(this, new Map());
        _CallableIntegerRanges_safeBindings.set(this, new Map());
        _CallableIntegerRanges_remaining.set(this, 16384);
        _CallableIntegerRanges_abandoned.set(this, false);
        __classPrivateFieldSet(this, _CallableIntegerRanges_options, options, "f");
    }
    analyze(callable) {
        const body = __classPrivateFieldGet(this, _CallableIntegerRanges_options, "f").ast.body(callable);
        if (body !== undefined) {
            if (__classPrivateFieldGet(this, _CallableIntegerRanges_options, "f").ast.is.IsBlock(body))
                this.statement(body, new Map(), 0);
            else
                this.expression(body, new Map(), 0);
        }
        return __classPrivateFieldGet(this, _CallableIntegerRanges_abandoned, "f") ? new Map() : __classPrivateFieldGet(this, _CallableIntegerRanges_ranges, "f");
    }
    enter(depth) {
        var _a;
        if (depth > 128 || __classPrivateFieldSet(this, _CallableIntegerRanges_remaining, (_a = __classPrivateFieldGet(this, _CallableIntegerRanges_remaining, "f"), --_a), "f") < 0)
            __classPrivateFieldSet(this, _CallableIntegerRanges_abandoned, true, "f");
        return !__classPrivateFieldGet(this, _CallableIntegerRanges_abandoned, "f");
    }
    safeBinding(declaration) {
        const cached = __classPrivateFieldGet(this, _CallableIntegerRanges_safeBindings, "f").get(declaration);
        if (cached !== undefined)
            return cached;
        const parent = __classPrivateFieldGet(this, _CallableIntegerRanges_options, "f").ast.parent(declaration);
        const declarationKind = parent === undefined ? undefined : __classPrivateFieldGet(this, _CallableIntegerRanges_options, "f").ast.variableDeclarationKind(parent);
        const summary = __classPrivateFieldGet(this, _CallableIntegerRanges_options, "f").navigation.declarationUseSummary(declaration);
        const safe = __classPrivateFieldGet(this, _CallableIntegerRanges_options, "f").ast.is.IsVariableDeclaration(declaration) &&
            (declarationKind === "let" || declarationKind === "const") &&
            !summary.captured && !summary.exported && !summary.memberWritten &&
            !summary.uses.some(use => use.role === "argument" || use.role === "yield");
        __classPrivateFieldGet(this, _CallableIntegerRanges_safeBindings, "f").set(declaration, safe);
        return safe;
    }
    declaration(reference) {
        const { ast } = __classPrivateFieldGet(this, _CallableIntegerRanges_options, "f");
        while (reference !== undefined && transparentKinds.has(ast.kindName(reference)))
            reference = Node_Expression(ast, reference);
        return reference === undefined || !ast.is.IsIdentifier(reference)
            ? undefined : __classPrivateFieldGet(this, _CallableIntegerRanges_options, "f").navigation.sourceReferenceFor(reference)?.declaration;
    }
    bind(declaration, range, environment) {
        if (declaration === undefined)
            return;
        if (range !== undefined && this.safeBinding(declaration))
            environment.set(declaration, range);
        else
            environment.delete(declaration);
    }
    expression(node, environment, depth) {
        if (!this.enter(depth))
            return undefined;
        const { ast } = __classPrivateFieldGet(this, _CallableIntegerRanges_options, "f");
        const kind = ast.kindName(node);
        if (sourceNodeHasRole(ast, node, "callable-signature"))
            return undefined;
        let range;
        if (ast.is.IsNumericLiteral(node)) {
            const text = ast.text(node);
            range = text === undefined ? undefined : integerRange(Number(text.replace(/_/gu, "")));
        }
        else if (ast.is.IsIdentifier(node)) {
            const declaration = this.declaration(node);
            range = declaration === undefined ? undefined : environment.get(declaration);
        }
        else if (transparentKinds.has(kind)) {
            const inner = Node_Expression(ast, node);
            range = inner === undefined ? undefined : this.expression(inner, environment, depth + 1);
        }
        else if (ast.is.IsBinaryExpression(node)) {
            const binary = ast.as.AsBinaryExpression(node);
            const operator = ast.operatorKindName(node);
            if (binary?.Left === undefined || binary.Right === undefined)
                return undefined;
            if (conditionalKinds.has(operator ?? "")) {
                this.expression(binary.Left, environment, depth + 1);
                const optional = new Map(environment);
                this.expression(binary.Right, optional, depth + 1);
                this.merge(environment, optional, environment);
                if (assignmentKinds.has(operator ?? ""))
                    this.bind(this.declaration(binary.Left), undefined, environment);
                return undefined;
            }
            const left = this.expression(binary.Left, environment, depth + 1);
            const right = this.expression(binary.Right, environment, depth + 1);
            if (operator === "KindEqualsToken") {
                const declaration = this.declaration(binary.Left);
                if (declaration === undefined)
                    environment.clear();
                else
                    this.bind(declaration, right, environment);
                range = right;
            }
            else if (assignmentKinds.has(operator ?? "")) {
                const declaration = this.declaration(binary.Left);
                if (declaration === undefined)
                    environment.clear();
                else
                    this.bind(declaration, undefined, environment);
            }
            else if (left !== undefined && right !== undefined && operator !== undefined) {
                range = binaryIntegerRange(operator, left, right);
            }
        }
        else if (ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) {
            const operand = ast.is.IsPrefixUnaryExpression(node)
                ? ast.as.AsPrefixUnaryExpression(node)?.Operand : ast.as.AsPostfixUnaryExpression(node)?.Operand;
            const value = operand === undefined ? undefined : this.expression(operand, environment, depth + 1);
            const operator = ast.operatorKindName(node);
            if (operator === "KindPlusPlusToken" || operator === "KindMinusMinusToken") {
                const next = value === undefined ? undefined : binaryIntegerRange(operator === "KindPlusPlusToken" ? "KindPlusToken" : "KindMinusToken", value, integerRange(1));
                this.bind(this.declaration(operand), next, environment);
                range = ast.is.IsPrefixUnaryExpression(node) ? next : value;
            }
            else if (operator === "KindPlusToken")
                range = value;
            else if (operator === "KindMinusToken" && value !== undefined && (value.minimum > 0 || value.maximum < 0)) {
                range = integerRange(-value.maximum, -value.minimum);
            }
        }
        else {
            this.invalidateWrites(node, environment, depth + 1);
            return undefined;
        }
        if (range !== undefined && __classPrivateFieldGet(this, _CallableIntegerRanges_options, "f").isNumber(node))
            __classPrivateFieldGet(this, _CallableIntegerRanges_ranges, "f").set(node, range);
        else
            range = undefined;
        return range;
    }
    statement(node, environment, depth) {
        if (!this.enter(depth))
            return false;
        const { ast } = __classPrivateFieldGet(this, _CallableIntegerRanges_options, "f");
        if (ast.is.IsBlock(node)) {
            for (const statement of ast.statements(node))
                if (statement !== undefined && !this.statement(statement, environment, depth + 1))
                    return false;
            return true;
        }
        if (ast.is.IsVariableStatement(node)) {
            const list = ast.as.AsVariableStatement(node)?.DeclarationList;
            if (list !== undefined && ast.is.IsVariableDeclarationList(list))
                for (const declaration of ast.as.AsVariableDeclarationList(list)?.Declarations?.Nodes ?? []) {
                    const name = ast.name(declaration);
                    if (name === undefined || !ast.is.IsIdentifier(name)) {
                        environment.clear();
                        continue;
                    }
                    const initializer = Node_Initializer(ast, declaration);
                    this.bind(declaration, initializer === undefined ? undefined : this.expression(initializer, environment, depth + 1), environment);
                }
        }
        else if (ast.is.IsExpressionStatement(node)) {
            const expression = Node_Expression(ast, node);
            if (expression !== undefined)
                this.expression(expression, environment, depth + 1);
        }
        else if (ast.is.IsReturnStatement(node) || ast.is.IsThrowStatement(node)) {
            const expression = Node_Expression(ast, node);
            if (expression !== undefined)
                this.expression(expression, environment, depth + 1);
            return false;
        }
        else if (ast.is.IsIfStatement(node)) {
            const conditional = ast.as.AsIfStatement(node);
            if (conditional?.Expression !== undefined)
                this.expression(conditional.Expression, environment, depth + 1);
            const yes = new Map(environment);
            const no = new Map(environment);
            const yesContinues = conditional?.ThenStatement === undefined || this.statement(conditional.ThenStatement, yes, depth + 1);
            const noContinues = conditional?.ElseStatement === undefined || this.statement(conditional.ElseStatement, no, depth + 1);
            if (yesContinues && noContinues)
                this.merge(yes, no, environment);
            else if (yesContinues || noContinues)
                this.replace(environment, yesContinues ? yes : no);
            else
                return false;
        }
        else if (ast.is.IsForStatement(node)) {
            this.loop(node, environment, depth + 1);
        }
        else if (!sourceNodeHasRole(ast, node, "callable-signature") && ast.kindName(node) !== "KindEmptyStatement") {
            environment.clear();
        }
        return true;
    }
    loop(node, environment, depth) {
        const { ast } = __classPrivateFieldGet(this, _CallableIntegerRanges_options, "f");
        const loop = ast.as.AsForStatement(node);
        const bodyEnvironment = new Map(environment);
        this.invalidateWrites(node, bodyEnvironment, depth + 1);
        this.invalidateWrites(node, environment, depth + 1);
        if (loop?.Initializer === undefined || loop.Condition === undefined || loop.Incrementor === undefined ||
            loop.Statement === undefined || !ast.is.IsVariableDeclarationList(loop.Initializer) ||
            ast.variableDeclarationKind(loop.Initializer) !== "let")
            return;
        const declarations = ast.as.AsVariableDeclarationList(loop.Initializer)?.Declarations?.Nodes;
        const counter = declarations?.length === 1 ? declarations[0] : undefined;
        const startNode = counter === undefined ? undefined : Node_Initializer(ast, counter);
        const start = startNode === undefined ? undefined : this.expression(startNode, bodyEnvironment, depth + 1);
        this.invalidateWrites(loop.Condition, bodyEnvironment, depth + 1);
        this.invalidateWrites(loop.Statement, bodyEnvironment, depth + 1);
        const increment = ast.is.IsPostfixUnaryExpression(loop.Incrementor)
            ? ast.as.AsPostfixUnaryExpression(loop.Incrementor)?.Operand
            : ast.is.IsPrefixUnaryExpression(loop.Incrementor) ? ast.as.AsPrefixUnaryExpression(loop.Incrementor)?.Operand : undefined;
        if (counter === undefined || !this.safeBinding(counter) || start === undefined || start.minimum !== start.maximum ||
            start.minimum < 0 || ast.operatorKindName(loop.Incrementor) !== "KindPlusPlusToken" ||
            this.declaration(increment) !== counter || !ast.is.IsBinaryExpression(loop.Condition))
            return;
        const condition = ast.as.AsBinaryExpression(loop.Condition);
        const operator = ast.operatorKindName(loop.Condition);
        if (condition?.Left === undefined || condition.Right === undefined ||
            (operator !== "KindLessThanToken" && operator !== "KindLessThanEqualsToken"))
            return;
        const bound = this.expression(condition.Right, bodyEnvironment, depth + 1);
        if (bound === undefined || bound.maximum >= Number.MAX_SAFE_INTEGER)
            return;
        let maximum = bound.maximum - (operator === "KindLessThanToken" ? 1 : 0);
        if (this.declaration(condition.Left) !== counter) {
            const square = ast.is.IsBinaryExpression(condition.Left) ? ast.as.AsBinaryExpression(condition.Left) : undefined;
            if (square === undefined || ast.operatorKindName(condition.Left) !== "KindAsteriskToken" ||
                this.declaration(square.Left) !== counter || this.declaration(square.Right) !== counter || maximum > 2147483647)
                return;
            maximum = Math.floor(Math.sqrt(maximum));
        }
        const range = integerRange(start.minimum, maximum);
        if (range === undefined)
            return;
        const writes = new Map([[counter, range]]);
        this.invalidateWrites(loop.Condition, writes, depth + 1);
        this.invalidateWrites(loop.Statement, writes, depth + 1);
        if (!writes.has(counter))
            return;
        bodyEnvironment.set(counter, range);
        this.statement(loop.Statement, bodyEnvironment, depth + 1);
    }
    invalidateWrites(node, environment, depth) {
        if (!this.enter(depth))
            return;
        const { ast } = __classPrivateFieldGet(this, _CallableIntegerRanges_options, "f");
        if (sourceNodeHasRole(ast, node, "callable-signature"))
            return;
        if (ast.is.IsVariableDeclaration(node) && Node_Initializer(ast, node) !== undefined) {
            const parent = ast.parent(node);
            if (parent === undefined || ast.variableDeclarationKind(parent) === "var")
                environment.clear();
            else
                environment.delete(node);
        }
        const operator = ast.operatorKindName(node);
        const target = ast.is.IsForOfStatement(node) || ast.is.IsForInStatement(node)
            ? ast.as.AsForInOrOfStatement(node)?.Initializer
            : ast.is.IsBinaryExpression(node) && assignmentKinds.has(operator ?? "")
                ? ast.as.AsBinaryExpression(node)?.Left
                : operator === "KindPlusPlusToken" || operator === "KindMinusMinusToken"
                    ? ast.is.IsPrefixUnaryExpression(node) ? ast.as.AsPrefixUnaryExpression(node)?.Operand
                        : ast.is.IsPostfixUnaryExpression(node) ? ast.as.AsPostfixUnaryExpression(node)?.Operand : undefined
                    : undefined;
        if (target !== undefined) {
            if (ast.is.IsIdentifier(target)) {
                const declaration = this.declaration(target);
                if (declaration !== undefined)
                    environment.delete(declaration);
            }
            else
                environment.clear();
        }
        ast.forEachChild(node, child => { if (child !== undefined)
            this.invalidateWrites(child, environment, depth + 1); });
    }
    merge(left, right, output) {
        const merged = new Map();
        for (const [declaration, value] of left) {
            const joined = joinIntegerRanges(value, right.get(declaration));
            if (joined !== undefined)
                merged.set(declaration, joined);
        }
        this.replace(output, merged);
    }
    replace(output, input) {
        output.clear();
        for (const [declaration, value] of input)
            output.set(declaration, value);
    }
}
_CallableIntegerRanges_options = new WeakMap(), _CallableIntegerRanges_ranges = new WeakMap(), _CallableIntegerRanges_safeBindings = new WeakMap(), _CallableIntegerRanges_remaining = new WeakMap(), _CallableIntegerRanges_abandoned = new WeakMap();
const transparentKinds = new Set(["KindParenthesizedExpression", "KindAsExpression", "KindSatisfiesExpression", "KindNonNullExpression", "KindTypeAssertion"]);
const conditionalKinds = new Set(["KindAmpersandAmpersandToken", "KindBarBarToken", "KindQuestionQuestionToken",
    "KindAmpersandAmpersandEqualsToken", "KindBarBarEqualsToken", "KindQuestionQuestionEqualsToken"]);
const assignmentKinds = new Set(["KindEqualsToken", "KindPlusEqualsToken", "KindMinusEqualsToken", "KindAsteriskEqualsToken",
    "KindAsteriskAsteriskEqualsToken", "KindSlashEqualsToken", "KindPercentEqualsToken", "KindLessThanLessThanEqualsToken",
    "KindGreaterThanGreaterThanEqualsToken", "KindGreaterThanGreaterThanGreaterThanEqualsToken", "KindAmpersandEqualsToken",
    "KindBarEqualsToken", "KindCaretEqualsToken", "KindBarBarEqualsToken", "KindAmpersandAmpersandEqualsToken", "KindQuestionQuestionEqualsToken"]);
//# sourceMappingURL=analysis.js.map