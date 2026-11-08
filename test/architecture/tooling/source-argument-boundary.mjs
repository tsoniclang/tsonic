import { posix } from "node:path";
import { readArchitectureTypeScript } from "./typescript-source.mjs";

const syntaxAccessors = new Set([
  "BinaryExpression_Left", "BinaryExpression_Right", "BinaryExpression_OperatorToken",
  "ConditionalExpression_Condition", "ConditionalExpression_WhenTrue", "ConditionalExpression_WhenFalse",
  "PrefixUnaryExpression_Operand", "Node_Operand", "Node_Expression", "sourceTransparentExpressionOperand",
  "CallExpression_Arguments", "NewExpression_Arguments",
]);
const meaningFields = new Set(["operator", "category", "presence", "disposition", "argumentDisposition", "optionalCall", "optionalChain", "chainContinuation"]);
const meaningTypes = new Set(["SourceCategory", "SourceCategoryDomain", "SourceValueSelection", "SourcePrimitiveOperator", "SourceOperation"]);
const factsTypes = new Set(["SourceProgramFacts", "SourceDescriptorView", "SourceValueFacts", "SourceApplicationFacts"]);
const functionKinds = new Set(["KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration", "KindGetAccessor", "KindSetAccessor"]);

export function sourceMeaningSyntaxFindings(sources) {
  const source = readArchitectureTypeScript(sources);
  const ast = source.ast;
  const findings = [];
  for (const file of source.sourceFiles) {
    const path = ast.getFileName(file).slice("/architecture/".length);
    if (!sources.has(path)) continue;
    const checker = source.getSourceFileQueries(file).checker;
    const readerTypes = new Set();
    const readers = new Set();
    const argumentReaders = new Set();
    const syntaxModules = new Set();
    const syntaxReaders = new Set();
    const syntaxValues = new Set();
    const factReaders = new Set();
    const factTypes = new Set();
    const sourceMeaningTypes = new Set();
    const retiredOperatorImports = new Set();
    const operatorModules = new Set();
    const declarations = [];
    const nodes = [];
    const visit = node => {
      nodes.push(node);
      if (ast.is.IsImportDeclaration(node)) {
        const declaration = ast.as.AsImportDeclaration(node);
        const specifier = declaration.ModuleSpecifier === undefined ? undefined : ast.text(declaration.ModuleSpecifier);
        if (specifier !== undefined && specifier.startsWith(".") &&
          posix.normalize(posix.join(posix.dirname(path), specifier)).replace(/\.js$/u, ".ts") === "target-model/syntax/operators.ts") {
          const inspect = child => {
            if (ast.is.IsNamespaceImport(child)) {
              const symbol = checker.getSymbolAtLocation(ast.name(child));
              if (symbol === undefined) throw new Error("The Native operator boundary requires its original namespace binding.");
              operatorModules.add(symbol);
            }
            if (ast.is.IsImportSpecifier(child)) {
              const selected = ast.as.AsImportSpecifier(child);
              if (ast.text(selected.PropertyName ?? ast.name(child)) === "sourceOperatorFromKindName") retiredOperatorImports.add(child);
            }
            ast.forEachChild(child, nested => { if (nested !== undefined) inspect(nested); });
          };
          inspect(node);
        }
        if (declaration.ModuleSpecifier !== undefined &&
          ["@tsonic/tsts", "@tsonic/target-api/source"].includes(ast.text(declaration.ModuleSpecifier))) {
          const inspect = child => {
            if (ast.is.IsNamespaceImport(child)) {
              const symbol = checker.getSymbolAtLocation(ast.name(child));
              if (symbol === undefined) throw new Error("A Source syntax gate requires its original namespace import binding.");
              syntaxModules.add(symbol);
            }
            if (ast.is.IsImportSpecifier(child)) {
              const selected = ast.as.AsImportSpecifier(child);
              const original = selected.PropertyName ?? ast.name(child);
              if (original !== undefined) {
                const name = ast.text(original);
                const symbol = checker.getSymbolAtLocation(ast.name(child));
                if (symbol === undefined) throw new Error("A Source syntax gate requires its original import binding.");
                if (name === "AstReader") readerTypes.add(symbol);
                if (syntaxAccessors.has(name)) syntaxReaders.add(symbol);
                if (name === "CallExpression_Arguments" || name === "NewExpression_Arguments") argumentReaders.add(symbol);
                if (meaningTypes.has(name)) sourceMeaningTypes.add(symbol);
                if (factsTypes.has(name)) factTypes.add(symbol);
              }
            }
            ast.forEachChild(child, nested => { if (nested !== undefined) inspect(nested); });
          };
          inspect(node);
        }
      }
      if (ast.is.IsVariableDeclaration(node) || ast.is.IsParameterDeclaration(node) || ast.is.IsBindingElement(node) ||
        ast.is.IsTypeAliasDeclaration(node)) declarations.push(node);
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
    const unwrap = original => {
      let node = original;
      while (node !== undefined) {
        if (ast.is.IsParenthesizedExpression(node)) node = ast.as.AsParenthesizedExpression(node).Expression;
        else if (ast.is.IsAsExpression(node)) node = ast.as.AsAsExpression(node).Expression;
        else if (ast.is.IsTypeAssertion(node)) node = ast.as.AsTypeAssertion(node).Expression;
        else if (ast.is.IsSatisfiesExpression(node)) node = ast.as.AsSatisfiesExpression(node).Expression;
        else if (ast.is.IsNonNullExpression(node)) node = ast.as.AsNonNullExpression(node).Expression;
        else break;
      }
      return node;
    };
    const isReader = original => {
      const node = unwrap(original);
      return node !== undefined && (ast.is.IsIdentifier(node) && readers.has(checker.getSymbolAtLocation(node)) ||
        ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)) === "ast");
    };
    const isArgumentReader = original => {
      const node = unwrap(original);
      return node !== undefined && (ast.is.IsIdentifier(node) && argumentReaders.has(checker.getSymbolAtLocation(node)) ||
        ast.is.IsPropertyAccessExpression(node) && (ast.text(ast.name(node)) === "arguments" && isReader(ast.as.AsPropertyAccessExpression(node).Expression) ||
          ["CallExpression_Arguments", "NewExpression_Arguments"].includes(ast.text(ast.name(node))) &&
          syntaxModules.has(checker.getSymbolAtLocation(ast.as.AsPropertyAccessExpression(node).Expression))));
    };
    const isSyntaxReader = original => {
      const node = unwrap(original);
      return node !== undefined && (ast.is.IsIdentifier(node) && syntaxReaders.has(checker.getSymbolAtLocation(node)) ||
        ast.is.IsPropertyAccessExpression(node) && (isReader(ast.as.AsPropertyAccessExpression(node).Expression) ||
          syntaxAccessors.has(ast.text(ast.name(node))) && syntaxModules.has(checker.getSymbolAtLocation(ast.as.AsPropertyAccessExpression(node).Expression)) ||
          isSyntaxReader(ast.as.AsPropertyAccessExpression(node).Expression)));
    };
    const isFactReader = original => {
      const node = unwrap(original);
      return node !== undefined && (ast.is.IsIdentifier(node) && factReaders.has(checker.getSymbolAtLocation(node)) ||
        ast.is.IsPropertyAccessExpression(node) && (ast.text(ast.name(node)) === "facts" ||
          isFactReader(ast.as.AsPropertyAccessExpression(node).Expression)));
    };
    const hasMeaningType = node => {
      if (node === undefined) return false;
      if (ast.is.IsTypeReferenceNode(node) &&
        sourceMeaningTypes.has(checker.getSymbolAtLocation(ast.as.AsTypeReferenceNode(node).TypeName))) return true;
      let found = false;
      ast.forEachChild(node, child => { if (child !== undefined && hasMeaningType(child)) found = true; });
      return found;
    };
    const hasSyntax = original => {
      const pending = [original];
      while (pending.length > 0) {
        const node = unwrap(pending.pop());
        if (node === undefined) continue;
        if (ast.is.IsIdentifier(node) && syntaxValues.has(checker.getSymbolAtLocation(node))) return true;
        if (ast.is.IsCallExpression(node)) {
          const callee = ast.as.AsCallExpression(node).Expression;
          if (isSyntaxReader(callee) || isArgumentReader(callee)) return true;
          if (ast.is.IsPropertyAccessExpression(callee) && isFactReader(ast.as.AsPropertyAccessExpression(callee).Expression)) continue;
        }
        ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
      }
      return false;
    };
    const size = () => readers.size + argumentReaders.size + syntaxModules.size + syntaxReaders.size + syntaxValues.size + factReaders.size + sourceMeaningTypes.size + operatorModules.size;
    for (let previous = -1; previous !== size();) {
      previous = size();
      for (const node of declarations) {
        const name = ast.name(node);
        if (name === undefined || !ast.is.IsIdentifier(name)) continue;
        const symbol = checker.getSymbolAtLocation(name);
        if (symbol === undefined) continue;
        const type = ast.is.IsBindingElement(node) ? undefined : ast.typeNode(node);
        if (ast.is.IsTypeAliasDeclaration(node) && hasMeaningType(type)) sourceMeaningTypes.add(symbol);
        if (type !== undefined && ast.is.IsTypeReferenceNode(type) &&
          readerTypes.has(checker.getSymbolAtLocation(ast.as.AsTypeReferenceNode(type).TypeName))) readers.add(symbol);
        if (type !== undefined && ast.is.IsTypeReferenceNode(type) &&
          factTypes.has(checker.getSymbolAtLocation(ast.as.AsTypeReferenceNode(type).TypeName))) factReaders.add(symbol);
        const initializer = ast.is.IsVariableDeclaration(node) ? ast.as.AsVariableDeclaration(node).Initializer
          : ast.is.IsParameterDeclaration(node) ? ast.as.AsParameterDeclaration(node).Initializer : undefined;
        if (initializer !== undefined && ast.is.IsIdentifier(initializer) &&
          syntaxModules.has(checker.getSymbolAtLocation(initializer))) syntaxModules.add(symbol);
        if (initializer !== undefined && ast.is.IsIdentifier(initializer) &&
          operatorModules.has(checker.getSymbolAtLocation(initializer))) operatorModules.add(symbol);
        if (isReader(initializer)) readers.add(symbol);
        if (isArgumentReader(initializer)) argumentReaders.add(symbol);
        if (isSyntaxReader(initializer)) syntaxReaders.add(symbol);
        if (hasSyntax(initializer)) syntaxValues.add(symbol);
        if (isFactReader(initializer)) factReaders.add(symbol);
        if (ast.is.IsBindingElement(node)) {
          const selected = ast.as.AsBindingElement(node);
          const property = ast.text(selected.PropertyName ?? name);
          if (property === "ast") readers.add(symbol);
          const owner = ast.parent(ast.parent(node));
          if (property === "arguments" && owner !== undefined && ast.is.IsVariableDeclaration(owner) &&
            isReader(ast.as.AsVariableDeclaration(owner).Initializer)) argumentReaders.add(symbol);
        }
      }
    }
    for (const node of nodes) {
      let rule;
      if (retiredOperatorImports.has(node) ||
        (ast.is.IsFunctionDeclaration(node) || ast.is.IsVariableDeclaration(node)) && path === "target-model/syntax/operators.ts" &&
          ast.text(ast.name(node)) === "sourceOperatorFromKindName" ||
        ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)) === "sourceOperatorFromKindName" &&
          operatorModules.has(checker.getSymbolAtLocation(ast.as.AsPropertyAccessExpression(node).Expression))) {
        rule = "native-rechooses-source-meaning-from-syntax";
      }
      if (ast.is.IsCallExpression(node) && isArgumentReader(ast.as.AsCallExpression(node).Expression)) rule = "native-reconstructs-application-arguments";
      if (ast.is.IsPropertyAccessExpression(node) && ast.text(ast.name(node)) === "Arguments") rule = "native-reads-raw-call-arguments";
      if (ast.is.IsElementAccessExpression(node)) {
        const access = ast.as.AsElementAccessExpression(node);
        const key = access.ArgumentExpression;
        if (key !== undefined && ast.kindName(key) === "KindStringLiteral" &&
          (ast.text(key) === "Arguments" || ast.text(key) === "arguments" && isReader(access.Expression))) rule = "native-reads-raw-call-arguments";
        if (key !== undefined && ast.kindName(key) === "KindStringLiteral" && ast.text(key) === "sourceOperatorFromKindName" &&
          operatorModules.has(checker.getSymbolAtLocation(access.Expression))) rule = "native-rechooses-source-meaning-from-syntax";
      }
      if (ast.is.IsBindingElement(node)) {
        const binding = ast.as.AsBindingElement(node);
        const owner = ast.parent(ast.parent(node));
        if (ast.text(binding.PropertyName ?? ast.name(node)) === "sourceOperatorFromKindName" &&
          owner !== undefined && ast.is.IsVariableDeclaration(owner) &&
          operatorModules.has(checker.getSymbolAtLocation(ast.as.AsVariableDeclaration(owner).Initializer))) {
          rule = "native-rechooses-source-meaning-from-syntax";
        }
      }
      if ((ast.is.IsPropertyAssignment(node) || ast.is.IsShorthandPropertyAssignment(node)) &&
        meaningFields.has(ast.text(ast.name(node)))) {
        const value = ast.is.IsPropertyAssignment(node) ? ast.as.AsPropertyAssignment(node).Initializer : ast.name(node);
        if (hasSyntax(value)) rule = "native-rechooses-source-meaning-from-syntax";
      }
      if (ast.is.IsBinaryExpression(node) && ast.operatorKindName(node) === "KindEqualsToken") {
        const assignment = ast.as.AsBinaryExpression(node);
        if (ast.is.IsPropertyAccessExpression(assignment.Left) && meaningFields.has(ast.text(ast.name(assignment.Left))) &&
          hasSyntax(assignment.Right)) rule = "native-rechooses-source-meaning-from-syntax";
      }
      if (ast.is.IsArrowFunction(node) && hasMeaningType(ast.typeNode(node))) {
        const body = ast.as.AsArrowFunction(node).Body;
        if (!ast.is.IsBlock(body) && hasSyntax(body)) rule = "native-rechooses-source-meaning-from-syntax";
      }
      if (ast.is.IsReturnStatement(node)) {
        let owner = ast.parent(node);
        let syntaxControl = false;
        while (owner !== undefined && !functionKinds.has(ast.kindName(owner))) {
          if (ast.is.IsIfStatement(owner)) syntaxControl ||= hasSyntax(ast.as.AsIfStatement(owner).Expression);
          if (ast.is.IsSwitchStatement(owner)) syntaxControl ||= hasSyntax(ast.as.AsSwitchStatement(owner).Expression);
          owner = ast.parent(owner);
        }
        if (owner !== undefined && hasMeaningType(ast.typeNode(owner)) &&
          (syntaxControl || hasSyntax(ast.as.AsReturnStatement(node).Expression))) rule = "native-rechooses-source-meaning-from-syntax";
      }
      if (rule !== undefined) {
        const range = ast.authoredRange(node);
        findings.push(Object.freeze({ file: path, line: ast.getSourceText(file).slice(0, range.start).split("\n").length, rule }));
      }
    }
  }
  return Object.freeze(findings);
}
