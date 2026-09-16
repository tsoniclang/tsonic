import type { Node, SourceFile } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer } from "./ast.js";
import type { TargetSourceProgram } from "../source-semantics/target-source-program.js";

export interface SourceArrayDensityQueries {
  array(expression: Node): boolean;
  entries(expression: Node): boolean;
}

export interface SourceArrayMemberEffect {
  readonly kind: "length" | "copy" | "entries" | "method";
  readonly mayShrink?: boolean;
  readonly callbackReceiverIndex?: number;
}

export interface SourceArrayDensityOptions {
  readonly closedSourceFiles: ReadonlySet<SourceFile>;
  intrinsicallyDense?(expression: Node): boolean;
  memberEffect(declaration: Node): SourceArrayMemberEffect | undefined;
}

export function createSourceArrayDensityQuery(
  source: TargetSourceProgram,
  options: SourceArrayDensityOptions,
): SourceArrayDensityQueries {
  const { ast, navigation } = source;
  const semanticsFor = source.semantics.forNode;
  const safeDeclarations = new WeakSet<Node>();
  const denseDeclarations = new WeakMap<Node, boolean>();
  const activeDeclarations = new Set<Node>();
  const trackedCallables = new WeakMap<Node, boolean>();
  const freshCallables = new WeakMap<Node, boolean>();
  const activeFreshCalls = new Set<Node>();
  const maximumProofNodes = 16_384;

  const enclosingCallable = (node: Node): Node | undefined => {
    for (let parent = ast.parent(node); parent !== undefined; parent = ast.parent(parent)) {
      if (["KindFunctionDeclaration", "KindArrowFunction", "KindFunctionExpression", "KindMethodDeclaration"].includes(ast.kindName(parent))) return parent;
    }
    return undefined;
  };

  const trackedCallable = (declaration: Node): boolean => {
    const previous = trackedCallables.get(declaration);
    if (previous !== undefined) return previous;
    const pending = [declaration];
    let accepted = true;
    for (let index = 0; accepted && index < pending.length; index++) {
      if (pending.length >= maximumProofNodes) { accepted = false; break; }
      const node = pending[index]!;
      if (ast.kindName(node) === "KindIdentifier" && navigation.sourceReferenceFor(node) === undefined) {
        const types = semanticsFor(node).types;
        const type = types.expressionType(node);
        if (type === undefined || !(types.isNullish(type) || types.isNumberLike(type) ||
          types.isBooleanLike(type) || types.isStringLike(type) || types.isBigIntLike(type) || types.isSymbolLike(type))) {
          accepted = false;
          break;
        }
      }
      ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
    }
    trackedCallables.set(declaration, accepted);
    return accepted;
  };

  const unwrap = (node: Node): Node => {
    let current = node;
    for (;;) {
      const kind = ast.kindName(current);
      if (kind !== "KindParenthesizedExpression" && kind !== "KindAsExpression" &&
        kind !== "KindSatisfiesExpression" && kind !== "KindNonNullExpression") return current;
      const inner = Node_Expression(ast, current);
      if (inner === undefined) return current;
      current = inner;
    }
  };
  const outer = (node: Node): Node => {
    let current = node;
    for (;;) {
      const parent = ast.parent(current);
      if (parent === undefined || unwrap(parent) !== unwrap(current)) return current;
      current = parent;
    }
  };
  const arrayMember = (node: Node): SourceArrayMemberEffect | undefined => {
    const semantics = semanticsFor(node);
    const property = semantics.operations.propertyAccess(node);
    if (property === undefined) return undefined;
    const declarations = property.selectedDeclaration !== undefined ? [property.selectedDeclaration]
      : property.selectedSymbol === undefined ? [] : [property.selectedSymbol, ...semantics.declarations.rootSymbols(property.selectedSymbol)]
        .flatMap(symbol => semantics.declarations.symbolDeclarations(symbol));
    const effects = declarations.map(declaration => options.memberEffect(declaration));
    const first = effects[0];
    return first !== undefined && effects.every(effect => effect !== undefined &&
      effect.kind === first.kind && effect.mayShrink === first.mayShrink &&
      effect.callbackReceiverIndex === first.callbackReceiverIndex) ? first : undefined;
  };
  const literalLength = (declaration: Node): number | undefined => {
    const visited = new Set<Node>();
    let subject: Node | undefined = declaration;
    while (subject !== undefined && !visited.has(subject) && visited.size < 256) {
      visited.add(subject);
      const initializer = Node_Initializer(ast, subject);
      if (initializer === undefined) return undefined;
      const value = unwrap(initializer);
      if (ast.kindName(value) === "KindArrayLiteralExpression") {
        const elements = ast.elements(value);
        return elements.every(element => element !== undefined && ast.kindName(element) !== "KindSpreadElement" &&
          ast.kindName(element) !== "KindOmittedExpression") ? elements.length : undefined;
      }
      subject = ast.kindName(value) === "KindIdentifier" ? navigation.sourceReferenceFor(value)?.declaration : undefined;
    }
    return undefined;
  };
  const implementation = (call: Node): Node | undefined => {
    if (ast.kindName(call) !== "KindCallExpression" ||
      ast.arguments(call).some(argument => argument === undefined || ast.kindName(argument) === "KindSpreadElement")) return undefined;
    const semantics = semanticsFor(call);
    const selected = semantics.operations.call(call);
    const signature = selected === undefined ? undefined : semantics.declarations.signatureDeclaration(selected.selectedSignature);
    if (signature === undefined || !navigation.isProjectDeclaration(signature)) return undefined;
    const target = navigation.callableImplementation(signature);
    if (target?.kind !== "resolved" || ast.kindName(target.implementation.declaration) !== "KindFunctionDeclaration") return undefined;
    const declaration = target.implementation.declaration;
    if (!trackedCallable(declaration)) return undefined;
    return ast.parameters(declaration).some(parameter => parameter === undefined || ast.kindName(parameter) !== "KindParameter" ||
      ast.as.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined)
      ? undefined : declaration;
  };
  const copiedArrayArgument = (reference: Node): boolean => {
    const argument = outer(reference);
    const call = ast.parent(argument);
    if (call === undefined || ast.kindName(call) !== "KindCallExpression" ||
      (ast.arguments(call).length !== 1 && ast.arguments(call).length !== 2) || ast.arguments(call)[0] !== argument) return false;
    const callee = Node_Expression(ast, call);
    if (callee === undefined || ast.kindName(callee) !== "KindPropertyAccessExpression") return false;
    const selected = semanticsFor(callee).operations.propertyAccess(callee);
    const effect = selected?.selectedDeclaration === undefined ? undefined
      : options.memberEffect(selected.selectedDeclaration);
    return effect?.kind === "copy";
  };
  const forwardedParameter = (reference: Node): Node | undefined => {
    const argument = outer(reference);
    const call = ast.parent(argument);
    if (call === undefined) return undefined;
    const selected = implementation(call);
    const index = ast.arguments(call).indexOf(argument);
    return selected === undefined || index < 0 ? undefined : ast.parameters(selected)[index];
  };
  const safe = (declaration: Node, returnOwner?: Node): boolean => {
    if (safeDeclarations.has(declaration)) return true;
    const pending = [declaration];
    const visited = new Set<Node>();
    let indexedWrites = false;
    let shrinking = false;
    for (let index = 0; index < pending.length; index++) {
      const subject = pending[index]!;
      if (visited.has(subject)) continue;
      if (visited.size >= maximumProofNodes) return false;
      visited.add(subject);
      const summary = navigation.declarationUseSummary(subject);
      if (summary.bindingWritten || summary.exported) return false;
      for (const use of summary.uses) {
        if (pending.length >= maximumProofNodes) return false;
        if (use.kind === "type-only") continue;
        const reference = outer(use.reference);
        const parent = ast.parent(reference);
        if (parent === undefined) return false;
        if (returnOwner !== undefined && ast.kindName(parent) === "KindReturnStatement" &&
          Node_Expression(ast, parent) === reference && enclosingCallable(parent) === returnOwner) continue;
        if (ast.kindName(parent) === "KindVariableDeclaration" && Node_Initializer(ast, parent) === reference &&
          ast.kindName(ast.name(parent)) === "KindIdentifier") {
          pending.push(parent);
          continue;
        }
        if (use.role === "argument") {
          if (copiedArrayArgument(reference)) continue;
          const parameter = forwardedParameter(reference);
          if (parameter === undefined) return false;
          pending.push(parameter);
          continue;
        }
        if (ast.kindName(parent) === "KindPropertyAccessExpression" && Node_Expression(ast, parent) === reference) {
          const member = arrayMember(parent);
          if (member?.kind === "length" && use.role !== "write") continue;
          const call = ast.parent(parent);
          if (member === undefined || (member.kind !== "method" && member.kind !== "entries") || call === undefined ||
            ast.kindName(call) !== "KindCallExpression" || Node_Expression(ast, call) !== parent) return false;
          const receiverIndex = member.callbackReceiverIndex;
          if (receiverIndex !== undefined) {
            if (!Number.isSafeInteger(receiverIndex) || receiverIndex < 0) return false;
            const callback = ast.arguments(call)[0];
            if (callback === undefined || ast.kindName(callback) !== "KindArrowFunction") return false;
            const parameters = ast.parameters(callback);
            if (parameters.some(parameter => parameter === undefined || ast.kindName(parameter) !== "KindParameter" ||
              ast.as.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined)) return false;
            const receiver = parameters[receiverIndex];
            if (receiver !== undefined) {
              if (ast.kindName(ast.name(receiver)) !== "KindIdentifier") return false;
              pending.push(receiver);
            }
          }
          if (member.mayShrink === true) shrinking = true;
          continue;
        }
        if (ast.kindName(parent) === "KindElementAccessExpression" && Node_Expression(ast, parent) === reference) {
          if (use.role !== "write") continue;
          const access = semanticsFor(parent).operations.elementAccess(parent);
          const assignment = ast.parent(parent);
          const index = access === undefined ? undefined : semanticsFor(parent).types.numericLiteralValue(access.argument.type);
          const length = literalLength(subject);
          if (assignment === undefined || ast.kindName(assignment) !== "KindBinaryExpression" ||
            ast.as.AsBinaryExpression(assignment)?.Left !== parent || ast.operatorKindName(assignment) !== "KindEqualsToken" ||
            typeof index !== "number" || !Number.isSafeInteger(index) || index < 0 || length === undefined || index >= length) return false;
          indexedWrites = true;
          continue;
        }
        if (ast.kindName(parent) === "KindForOfStatement" && Node_Expression(ast, parent) === reference) continue;
        if (use.role === "comparison" || use.role === "condition") continue;
        return false;
      }
    }
    if (indexedWrites && shrinking) return false;
    if (returnOwner === undefined) for (const subject of visited) safeDeclarations.add(subject);
    return true;
  };
  const freshCall = (expression: Node): boolean => {
    const declaration = implementation(expression);
    if (declaration === undefined || activeFreshCalls.has(declaration) || activeFreshCalls.size >= 256) return false;
    const previous = freshCallables.get(declaration);
    if (previous !== undefined) return previous;
    activeFreshCalls.add(declaration);
    const active = new Set<Node>();
    const fresh = (expression: Node): boolean => {
      const node = unwrap(expression);
      if (ast.kindName(node) === "KindArrayLiteralExpression") return ast.elements(node).every(element =>
        element !== undefined && ast.kindName(element) !== "KindOmittedExpression" && ast.kindName(element) !== "KindSpreadElement");
      if (ast.kindName(node) === "KindCallExpression") return freshCall(node);
      if (ast.kindName(node) !== "KindIdentifier") return false;
      const binding = navigation.sourceReferenceFor(node)?.declaration;
      if (binding === undefined || ast.kindName(binding) !== "KindVariableDeclaration" ||
        enclosingCallable(binding) !== declaration || active.has(binding) || active.size >= 256 || !safe(binding, declaration)) return false;
      const initializer = Node_Initializer(ast, binding);
      if (initializer === undefined) return false;
      active.add(binding);
      try { return fresh(initializer); }
      finally { active.delete(binding); }
    };
    let accepted = true;
    let returns = 0;
    try {
      const pending = [declaration];
      for (let index = 0; accepted && index < pending.length; index++) {
        if (pending.length >= maximumProofNodes) { accepted = false; break; }
        const node = pending[index]!;
        if (node !== declaration && ["KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindClassDeclaration"].includes(ast.kindName(node))) continue;
        if (ast.kindName(node) === "KindReturnStatement") {
          const result = Node_Expression(ast, node);
          returns++;
          if (result === undefined || !fresh(result)) accepted = false;
        }
        ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
      }
    } finally { activeFreshCalls.delete(declaration); }
    accepted &&= returns > 0;
    freshCallables.set(declaration, accepted);
    return accepted;
  };
  const dense = (expression: Node): boolean => {
    const node = unwrap(expression);
    if (options.intrinsicallyDense?.(node) === true) return true;
    if (ast.kindName(node) === "KindCallExpression") return freshCall(node);
    if (ast.kindName(node) === "KindArrayLiteralExpression") {
      return ast.elements(node).every(element => element !== undefined && ast.kindName(element) !== "KindOmittedExpression" &&
        (ast.kindName(element) !== "KindSpreadElement" ||
          (Node_Expression(ast, element) !== undefined && dense(Node_Expression(ast, element)!))));
    }
    if (ast.kindName(node) !== "KindIdentifier") return false;
    const declaration = navigation.sourceReferenceFor(node)?.declaration;
    if (declaration === undefined || activeDeclarations.has(declaration) || activeDeclarations.size >= 256) return false;
    const previous = denseDeclarations.get(declaration);
    if (previous !== undefined) return previous;
    if (!safe(declaration)) return false;
    activeDeclarations.add(declaration);
    let result = false;
    try {
      const initializer = Node_Initializer(ast, declaration);
      if (ast.kindName(declaration) === "KindVariableDeclaration" && initializer !== undefined) result = dense(initializer);
      else if (ast.kindName(declaration) === "KindParameter") {
        const callable = ast.parent(declaration);
        const sourceFile = callable === undefined ? undefined : ast.getSourceFile(callable);
        if (callable === undefined || sourceFile === undefined ||
          navigation.declarationUseSummary(callable).exported && !options.closedSourceFiles.has(sourceFile)) return false;
        const index = callable === undefined ? -1 : ast.parameters(callable).indexOf(declaration);
        const uses = callable === undefined ? [] : navigation.declarationUses(callable)
          .filter(use => use.kind !== "type-only" && use.kind !== "source-linkage");
        result = index >= 0 && uses.length > 0 && uses.every(use => {
          const callee = outer(use.reference);
          const call = ast.parent(callee);
          if (use.kind !== "direct-call" || call === undefined || Node_Expression(ast, call) !== callee ||
            implementation(call) !== callable) return false;
          const argument = ast.arguments(call)[index] ?? initializer;
          return argument !== undefined && dense(argument);
        });
      }
    } finally { activeDeclarations.delete(declaration); }
    denseDeclarations.set(declaration, result);
    return result;
  };
  const entries = (expression: Node): boolean => {
    const seen = new Set<Node>();
    let node = unwrap(expression);
    while (ast.kindName(node) === "KindIdentifier") {
      const declaration = navigation.sourceReferenceFor(node)?.declaration;
      if (declaration === undefined || seen.has(declaration) || seen.size >= maximumProofNodes ||
        navigation.declarationUseSummary(declaration).bindingWritten) return false;
      seen.add(declaration);
      const initializer = Node_Initializer(ast, declaration);
      if (initializer === undefined) return false;
      node = unwrap(initializer);
    }
    if (ast.kindName(node) !== "KindCallExpression" || ast.arguments(node).length !== 0) return false;
    const member = Node_Expression(ast, node);
    if (member === undefined || ast.kindName(member) !== "KindPropertyAccessExpression" || arrayMember(member)?.kind !== "entries") return false;
    const receiver = Node_Expression(ast, member);
    return receiver !== undefined && dense(receiver);
  };
  return Object.freeze({ array: dense, entries });
}
