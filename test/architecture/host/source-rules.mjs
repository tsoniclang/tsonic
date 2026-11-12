import { sourceOwner } from "./catalogue.mjs";
import { publicDeclarations, quarantineReference, sourceSymbol } from "./import-graph.mjs";
const producerMembers = Object.freeze(["builder", "seed", "register", "sealRegistration", "provide", "producer", "seal", "set", "delete", "clear", "resourceScope", "withDepth", "authenticate", "authorize", "lease", "questionView"]);
const scopedOwners = Object.freeze(["KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration", "KindConstructor", "KindGetAccessor", "KindSetAccessor"]);
const opaqueOwners = Object.freeze({ TypeInterner: "ir-types", CheckerExtensions: "front", CheckedProgram: "front", PluginModule: "plugins", TargetSession: "orchestration" });
const rawCaptureTypes = Object.freeze(["RawModule", "RawTypeTable", "RawTypeId", "RawNumericLiteral"]);
const sdkPayloads = Object.freeze({ CompilerExtension: "compiler-extension", SourceDeclarationProvider: "declaration-provider", SourceSemanticsModule: "semantics-module" });
export function sourceFindings(source, files, catalogue, graph, quarantineRoots) {
  const { ast } = source;
  const publicValues = publicDeclarations(source, files, catalogue);
  const owner = path => sourceOwner(catalogue, path);
  const findings = [];
  const add = (code, path, node) => {
    const range = node === undefined || typeof node === "number" ? undefined : ast.authoredRange(node);
    let start = typeof node === "number" ? node : range?.kind === "authored" ? range.start : 0;
    if (node !== undefined && typeof node !== "number") {
      let statement = node;
      while (ast.parent(statement) !== undefined && !ast.is.IsSourceFile(ast.parent(statement))) statement = ast.parent(statement);
      const anchor = ast.authoredRange(statement);
      if (anchor.kind === "authored") start = anchor.start;
    } else if (typeof node === "number") {
      const file = source.sourceFiles.find(candidate => candidate !== undefined && ast.getFileName(candidate) === `/host-gate/${path}`);
      const statement = ast.statements(file).find(candidate => {
        const anchor = ast.authoredRange(candidate);
        return anchor.kind === "authored" && anchor.start <= start && anchor.end > start;
      });
      if (statement !== undefined) start = ast.authoredRange(statement).start;
    }
    const before = files.get(path).slice(0, start).split("\n");
    findings.push(Object.freeze({ code, path, line: before.length, column: before[before.length - 1].length + 1 }));
  };
  const sourceFiles = new Map(source.sourceFiles.filter(file => file !== undefined).map(file =>
    [ast.getFileName(file).slice("/host-gate/".length), file]).filter(([path]) => files.has(path)));
  const closedFiles = new Set([...files.keys()].filter(path => {
    const module = owner(path);
    return path === module?.contract || path.endsWith(".d.ts");
  }));
  for (let previous = -1; previous !== closedFiles.size;) {
    previous = closedFiles.size;
    for (const edge of graph) if (edge.target !== null && closedFiles.has(edge.source) &&
      owner(edge.source) === owner(edge.target)) closedFiles.add(edge.target);
  }
  const memberName = name => {
    if (name !== undefined && ast.is.IsComputedPropertyName(name)) {
      const expression = ast.as.AsComputedPropertyName(name)?.Expression;
      return expression !== undefined && ast.is.IsStringLiteral(expression) ? ast.text(expression) : undefined;
    }
    return name !== undefined && (ast.is.IsIdentifier(name) || ast.is.IsStringLiteral(name) || ast.is.IsNumericLiteral(name))
      ? ast.text(name) : undefined;
  };
  const opaqueBrand = (node, module, file) => {
    const intersection = ast.parent(node);
    const declaration = ast.parent(intersection);
    if (!ast.is.IsIntersectionTypeNode(intersection) || !ast.is.IsTypeAliasDeclaration(declaration) ||
      ![module.contract, module.contract.replace(/\.ts$/u, ".d.ts")].includes(file) ||
      opaqueOwners[ast.text(ast.name(declaration))] !== module.name) return false;
    const children = ast.children(intersection).filter(child => child !== undefined);
    const brand = children.find(child => ast.is.IsTypeLiteralNode(child));
    if (children.length !== 2 || brand === undefined || !children.includes(node)) return false;
    const members = ast.members(brand);
    return members.length > 0 && members.every(member => ast.is.IsPropertySignatureDeclaration(member) &&
      ast.hasModifierKind(member, "readonly") && ast.typeNode(member) !== undefined && ast.is.IsLiteralTypeNode(ast.typeNode(member)));
  };
  const callableType = original => {
    let node = original;
    while (node !== undefined && ast.is.IsParenthesizedTypeNode(node)) node = ast.as.AsParenthesizedTypeNode(node)?.Type;
    return node !== undefined && ast.is.IsFunctionTypeNode(node);
  };
  const productionMember = node => {
    const name = ast.name(node);
    const type = ast.typeNode(node);
    const text = memberName(name);
    return text !== undefined && producerMembers.includes(text) &&
      (ast.is.IsMethodSignatureDeclaration(node) || callableType(type));
  };
  const rawSymbols = new Set();
  const libraryFunctionTypes = new Set();
  const depsTypes = new Set();
  const productionSymbols = new Set();
  const mutableSymbols = new Set();
  const aliases = new Map();
  const sdkSymbols = new Map();
  const sdkPorts = new Set();
  const checker = node => {
    const file = ast.getSourceFile(node);
    if (file === undefined) throw new Error("An architecture reference requires its original source file.");
    return source.getSourceFileQueries(file).checker;
  };
  const symbol = node => sourceSymbol(source, node);
  const contractFunctions = new Map();
  for (const [path, file] of sourceFiles) {
    const module = owner(path);
    if (module === undefined || path !== module.contract) continue;
    const queries = checker(file);
    const identity = symbol(file);
    if (identity === undefined) continue;
    const functions = new Set();
    for (const exported of queries.getExportsOfModule(identity)) {
      const selected = sourceSymbol(source, file, exported);
      const declarations = queries.getSymbolDeclarations(selected);
      if (declarations.length > 0 && declarations.every(declaration => ast.getSourceFile(declaration) === file &&
        ast.is.IsTypeAliasDeclaration(declaration) && ast.typeNode(declaration) !== undefined && ast.is.IsFunctionTypeNode(ast.typeNode(declaration)))) functions.add(selected);
    }
    contractFunctions.set(module, functions);
  }
  const stageTypes = new Set();
  const brandAssertions = new Map();
  const brandValues = new Map(publicValues);
  for (const [declaration, module] of brandValues) {
    if (!ast.is.IsVariableDeclaration(declaration)) continue;
    const initializer = ast.as.AsVariableDeclaration(declaration).Initializer;
    if (initializer === undefined || !ast.is.IsIdentifier(initializer)) continue;
    const selected = symbol(initializer);
    const implementation = selected === undefined ? undefined : checker(initializer).getSymbolValueDeclaration(selected);
    if (implementation === undefined || !ast.is.IsVariableDeclaration(implementation)) continue;
    const path = ast.getFileName(ast.getSourceFile(implementation)).slice("/host-gate/".length);
    if (owner(path) === module) brandValues.set(implementation, module);
  }
  const brandConstructor = (node, module, file) => {
    if (!["ids", "diag"].includes(module.name) || !ast.is.IsAsExpression(node)) return undefined;
    const arrow = ast.parent(node);
    const declaration = ast.parent(arrow);
    if (!ast.is.IsArrowFunction(arrow) || ast.body(arrow) !== node || !ast.is.IsVariableDeclaration(declaration) ||
      brandValues.get(declaration) !== module) return undefined;
    const cast = ast.as.AsAsExpression(node);
    const annotation = ast.typeNode(declaration);
    if (!ast.is.IsTypeReferenceNode(cast.Type) || annotation === undefined || !ast.is.IsTypeReferenceNode(annotation)) return undefined;
    const target = symbol(ast.as.AsTypeReferenceNode(cast.Type).TypeName);
    const constructor = symbol(ast.as.AsTypeReferenceNode(annotation).TypeName);
    if (target === undefined || constructor === undefined || !contractFunctions.get(module)?.has(constructor)) return undefined;
    const targetName = ast.text(ast.as.AsTypeReferenceNode(cast.Type).TypeName);
    const declarationName = ast.text(ast.name(declaration));
    const queries = checker(node);
    const targets = queries.getSymbolDeclarations(target);
    const signatures = queries.getSymbolDeclarations(constructor);
    if (targets.length !== 1 || signatures.length !== 1 || ast.getSourceFile(targets[0]) !== sourceFiles.get(module.contract) ||
      ast.getSourceFile(signatures[0]) !== sourceFiles.get(module.contract)) return undefined;
    const signature = ast.typeNode(signatures[0]);
    const result = ast.as.AsFunctionTypeNode(signature)?.Type;
    const parameters = ast.parameters(arrow);
    const declaredParameters = ast.parameters(signature);
    if (parameters.length !== 1 || declaredParameters.length !== 1 || result === undefined || !ast.is.IsTypeReferenceNode(result) ||
      symbol(ast.as.AsTypeReferenceNode(result).TypeName) !== target ||
      !["KindNumberKeyword", "KindStringKeyword"].includes(ast.kindName(ast.typeNode(declaredParameters[0])))) return undefined;
    const signatureName = ast.text(ast.name(signatures[0]));
    const direct = file === module.entry && signatureName === targetName + "Constructor" &&
      declarationName === targetName.charAt(0).toLowerCase() + targetName.slice(1) &&
      ast.is.IsIdentifier(cast.Expression) && symbol(cast.Expression) === symbol(ast.name(parameters[0]));
    const encoded = module.name === "ids" && signatureName === "Encode" + targetName &&
      declarationName === "encode" + targetName &&
      ast.kindName(ast.typeNode(declaredParameters[0])) === "KindStringKeyword" &&
      ast.is.IsTemplateExpression(cast.Expression);
    if (!direct && !encoded) return undefined;
    return target;
  };
  for (const [declaration, module] of publicValues) {
    const annotation = ast.is.IsVariableDeclaration(declaration) ? ast.typeNode(declaration) : undefined;
    const selected = annotation !== undefined && ast.is.IsTypeReferenceNode(annotation) ? symbol(ast.as.AsTypeReferenceNode(annotation).TypeName) : undefined;
    if (module.kind === "component" && selected !== undefined && contractFunctions.get(module)?.has(selected)) stageTypes.add(selected);
  }
  const canonicalSyntax = node => {
    const file = ast.getSourceFile(node);
    const path = file === undefined ? "" : ast.getFileName(file).slice("/host-gate/".length);
    const module = owner(path);
    return module?.name === "ir-hir" && [module.contract, module.contract.replace(/\.ts$/u, ".d.ts")].includes(path);
  };
  const phaseDeclaration = node => node !== undefined && canonicalSyntax(node) && ast.is.IsInterfaceDeclaration(node) &&
    ast.text(ast.name(node)) === "Phase" && ast.typeParameters(node).length === 0 && ast.heritageElements(node, "extends").length === 0 &&
    ast.members(node).every(member => ast.is.IsPropertySignatureDeclaration(member) && ast.hasModifierKind(member, "readonly") &&
      ast.questionToken(member) === undefined && memberName(ast.name(member)) !== undefined);
  const phaseSlotObject = node => {
    const union = ast.parent(node);
    const slot = ast.parent(union);
    const phase = ast.parent(slot);
    if (!phaseDeclaration(phase) || !ast.is.IsUnionTypeNode(union) || !ast.is.IsPropertySignatureDeclaration(slot) ||
      !ast.hasModifierKind(slot, "readonly") || ast.typeNode(slot) !== union || memberName(ast.name(slot)) === undefined) return false;
    const arms = ast.children(union);
    return arms.length === 2 && arms.includes(node) && arms.some(arm => ast.is.IsLiteralTypeNode(arm) &&
      ast.kindName(ast.as.AsLiteralTypeNode(arm).Literal) === "KindNullKeyword");
  };
  const phaseSlotSelectionData = node => {
    const slot = ast.parent(node);
    const record = ast.parent(slot);
    if (!canonicalSyntax(node) || !ast.is.IsPropertySignatureDeclaration(slot) || !ast.hasModifierKind(slot, "readonly") ||
      ast.questionToken(slot) !== undefined || memberName(ast.name(slot)) !== "tsonic" ||
      ast.typeNode(slot) !== node || !ast.is.IsInterfaceDeclaration(record)) return false;
    const access = ast.as.AsIndexedAccessTypeNode(node);
    if (!ast.is.IsTypeReferenceNode(access.ObjectType) || ast.typeArguments(access.ObjectType).length !== 0 || !ast.is.IsLiteralTypeNode(access.IndexType)) return false;
    const key = ast.as.AsLiteralTypeNode(access.IndexType).Literal;
    if (!ast.is.IsStringLiteral(key)) return false;
    const parameter = ast.typeParameters(record).find(candidate => symbol(ast.name(candidate)) === symbol(ast.as.AsTypeReferenceNode(access.ObjectType).TypeName));
    const constraint = parameter === undefined ? undefined : ast.as.AsTypeParameterDeclaration(parameter).Constraint;
    if (constraint === undefined || !ast.is.IsTypeReferenceNode(constraint)) return false;
    const declarations = checker(node).getSymbolDeclarations(symbol(ast.as.AsTypeReferenceNode(constraint).TypeName));
    if (declarations.length !== 1 || !phaseDeclaration(declarations[0]) ||
      !ast.members(declarations[0]).some(member => ast.is.IsPropertySignatureDeclaration(member) &&
        ast.hasModifierKind(member, "readonly") && memberName(ast.name(member)) === ast.text(key))) return false;
    if (!ast.members(record).some(member => memberName(ast.name(member)) === "kind")) return false;
    return { record, parameter, phase: declarations[0], key: ast.text(key) };
  };
  const phaseSlotSelection = node => {
    const selected = phaseSlotSelectionData(node);
    if (selected === false) return false;
    if (selected.key === ast.text(ast.name(selected.record))) return true;
    const file = ast.getSourceFile(selected.record);
    const family = ast.statements(file).find(statement => ast.is.IsTypeAliasDeclaration(statement) &&
      ast.hasModifierKind(statement, "export") && ast.text(ast.name(statement)) === selected.key);
    const union = family === undefined ? undefined : ast.typeNode(family);
    if (union === undefined || !ast.is.IsUnionTypeNode(union) || ast.typeParameters(family).length !== 1) return false;
    const parameter = ast.typeParameters(family)[0];
    const constraint = ast.as.AsTypeParameterDeclaration(parameter).Constraint;
    if (constraint === undefined || !ast.is.IsTypeReferenceNode(constraint)) return false;
    const phases = checker(family).getSymbolDeclarations(symbol(ast.as.AsTypeReferenceNode(constraint).TypeName));
    if (phases.length !== 1 || phases[0] !== selected.phase) return false;
    let containsRecord = false;
    const complete = ast.children(union).every(arm => {
      if (!ast.is.IsTypeReferenceNode(arm) || ast.typeArguments(arm).length !== 1) return false;
      const argument = ast.typeArguments(arm)[0];
      if (!ast.is.IsTypeReferenceNode(argument) || ast.typeArguments(argument).length !== 0 ||
        symbol(ast.as.AsTypeReferenceNode(argument).TypeName) !== symbol(ast.name(parameter))) return false;
      const identity = symbol(ast.as.AsTypeReferenceNode(arm).TypeName);
      if (identity === undefined) return false;
      const declarations = checker(arm).getSymbolDeclarations(identity);
      const record = declarations.length === 1 ? declarations[0] : undefined;
      if (record === undefined || !ast.is.IsInterfaceDeclaration(record) || ast.getSourceFile(record) !== file ||
        ast.typeParameters(record).length !== 1) return false;
      const slot = ast.members(record).find(member => ast.is.IsPropertySignatureDeclaration(member) && memberName(ast.name(member)) === "tsonic");
      const type = slot === undefined ? undefined : ast.typeNode(slot);
      if (type === undefined || !ast.is.IsIndexedAccessTypeNode(type)) return false;
      const member = phaseSlotSelectionData(type);
      if (member === false || member.key !== selected.key || member.phase !== selected.phase ||
        member.parameter !== ast.typeParameters(record)[0]) return false;
      if (record === selected.record) containsRecord = true;
      return true;
    });
    return complete && containsRecord;
  };
  const typeShape = node => {
    const file = ast.getSourceFile(node);
    if (file === undefined) throw new Error("An architecture type requires its original source file.");
    return source.getSourceFileQueries(file).typeShape;
  };
  const mappedDeclarations = new Map();
  const argumentBearingType = node => ast.is.IsTypeReferenceNode(node) || ast.is.IsImportTypeNode(node);
  const mappedDeclaration = node => {
    if (mappedDeclarations.has(node)) return mappedDeclarations.get(node);
    if (ast.is.IsMappedTypeNode(node)) return node;
    if (!argumentBearingType(node)) return undefined;
    const queries = checker(node);
    const type = typeShape(node).getTypeFromTypeNode(node);
    const name = ast.is.IsTypeReferenceNode(node) ? ast.as.AsTypeReferenceNode(node)?.TypeName : undefined;
    const candidates = [...queries.getSymbolDeclarations(queries.getTypeSymbol(type)),
      ...queries.getSymbolDeclarations(symbol(name)).map(candidate => ast.typeNode(candidate))];
    const declaration = candidates.find(candidate => candidate !== undefined && ast.is.IsMappedTypeNode(candidate));
    mappedDeclarations.set(node, declaration);
    return declaration;
  };
  const mappedInputs = new Map();
  const mappedInput = node => {
    const cached = mappedInputs.get(node);
    if (cached !== undefined) return cached;
    let child = node;
    let parent = ast.parent(child);
    while (parent !== undefined) {
      if (argumentBearingType(parent) && ast.typeArguments(parent).includes(child) && mappedDeclaration(parent) !== undefined) {
        let operand = child;
        while (ast.is.IsParenthesizedTypeNode(operand)) {
          const inner = ast.as.AsParenthesizedTypeNode(operand)?.Type;
          if (inner === undefined) break;
          operand = inner;
        }
        const name = ast.is.IsTypeReferenceNode(operand) ? ast.as.AsTypeReferenceNode(operand)?.TypeName : undefined;
        let entity = node;
        while (ast.parent(entity) !== undefined && ast.is.IsQualifiedName(ast.parent(entity))) entity = ast.parent(entity) ?? entity;
        const transformed = node === operand || entity === name ||
          ast.parent(node) === operand && (ast.is.IsPropertySignatureDeclaration(node) || ast.is.IsIndexSignatureDeclaration(node));
        mappedInputs.set(node, transformed);
        return transformed;
      }
      child = parent;
      parent = ast.parent(parent);
    }
    mappedInputs.set(node, false);
    return false;
  };
  const mappedKeySource = node => {
    const mapped = ast.as.AsMappedTypeNode(node);
    let constraint = mapped?.TypeParameter === undefined ? undefined : ast.as.AsTypeParameterDeclaration(mapped.TypeParameter)?.Constraint;
    const active = new Set();
    while (constraint !== undefined && !active.has(constraint)) {
      active.add(constraint);
      if (ast.is.IsParenthesizedTypeNode(constraint)) {
        constraint = ast.as.AsParenthesizedTypeNode(constraint)?.Type;
        continue;
      }
      if (ast.is.IsTypeOperatorNode(constraint))
        return ast.operatorKindName(constraint) === "KindKeyOfKeyword" ? ast.as.AsTypeOperatorNode(constraint)?.Type : undefined;
      const name = ast.is.IsTypeReferenceNode(constraint) ? ast.as.AsTypeReferenceNode(constraint)?.TypeName : undefined;
      const selected = symbol(name);
      const declaration = selected === undefined ? undefined : aliases.get(selected);
      constraint = declaration !== undefined && ast.is.IsTypeAliasDeclaration(declaration) ? ast.typeNode(declaration) : undefined;
    }
    return undefined;
  };
  const mutableMapped = node => {
    const shape = typeShape(node);
    const queries = checker(node);
    const parameter = type => queries.getSymbolDeclarations(queries.getTypeSymbol(type))
      .some(declaration => declaration !== undefined && ast.is.IsTypeParameterDeclaration(declaration));
    const input = ast.is.IsMappedTypeNode(node) ? mappedKeySource(node) : undefined;
    if (input !== undefined && parameter(shape.getTypeFromTypeNode(input)) ||
      argumentBearingType(node) && ast.typeArguments(node).some(argument => argument !== undefined && parameter(shape.getTypeFromTypeNode(argument)))) return false;
    const active = new Set();
    const completed = new Map();
    const visit = type => {
      if (type === undefined || active.has(type) || parameter(type)) return false;
      const cached = completed.get(type);
      if (cached !== undefined) return cached;
      if (shape.isStringLike(type) || shape.isNumberLike(type) || shape.isBooleanLike(type) ||
        shape.isBigIntLike(type) || shape.isSymbolLike(type) || shape.isNullish(type)) return false;
      active.add(type);
      const mutable = shape.isUnion(type) || shape.isIntersection(type)
        ? shape.getUnionOrIntersectionTypes(type).some(visit)
        : shape.getPropertyInfos(type).some(property => {
          const declarations = property.rootSymbols.flatMap(root => queries.getSymbolDeclarations(root));
          const method = declarations.length > 0 && declarations.every(declaration => declaration !== undefined &&
            (ast.is.IsMethodSignatureDeclaration(declaration) || ast.is.IsMethodDeclaration(declaration)));
          return !method && (!property.readonly || visit(property.type));
        }) || shape.getIndexInfos(type).some(index => !index.readonly || visit(index.valueType));
      active.delete(type);
      completed.set(type, mutable);
      return mutable;
    };
    return visit(shape.getTypeFromTypeNode(node));
  };
  const readonlySequence = original => {
    let parent = ast.parent(original);
    while (parent !== undefined && ast.is.IsParenthesizedTypeNode(parent)) parent = ast.parent(parent);
    if (parent !== undefined && ast.is.IsTypeOperatorNode(parent))
      return ast.operatorKindName(parent) === "KindReadonlyKeyword";
    if (parent !== undefined && (ast.is.IsRestTypeNode(parent) || ast.is.IsNamedTupleMember(parent) &&
      ast.as.AsNamedTupleMember(parent)?.DotDotDotToken !== undefined)) {
      const tuple = ast.parent(parent);
      return tuple !== undefined && ast.is.IsTupleTypeNode(tuple) && readonlySequence(tuple);
    }
    return false;
  };
  const mutableCollection = node => {
    const name = ast.is.IsTypeReferenceNode(node) ? ast.as.AsTypeReferenceNode(node)?.TypeName
      : ast.is.IsExpressionWithTypeArguments(node) ? ast.as.AsExpressionWithTypeArguments(node)?.Expression : undefined;
    const terminal = name !== undefined && ast.is.IsQualifiedName(name) ? ast.as.AsQualifiedName(name)?.Right
      : name !== undefined && ast.is.IsPropertyAccessExpression(name) ? ast.name(name) : name;
    const text = terminal !== undefined && ast.is.IsIdentifier(terminal) ? ast.text(terminal) : undefined;
    if (text === undefined || !["Array", "Map", "Set", "WeakMap", "WeakSet", "ReadonlyMap", "ReadonlySet"].includes(text)) return false;
    const declaration = symbol(name);
    if (declaration !== undefined && checker(node).getSymbolDeclarations(declaration).length > 0) return false;
    return text !== "Array" || !readonlySequence(node);
  };
  const mutableData = node => {
    if (mutableCollection(node)) return true;
    if (mappedInput(node)) return false;
    if (ast.is.IsSetAccessorDeclaration(node)) return true;
    const mapped = mappedDeclaration(node);
    if (mapped !== undefined) {
      const original = ast.as.AsMappedTypeNode(mapped);
      const modifier = ast.kindName(original?.ReadonlyToken);
      if (modifier === "KindMinusToken") return true;
      if (mutableMapped(node)) return true;
      if (ast.is.IsMappedTypeNode(node) && original?.ReadonlyToken === undefined) return mappedKeySource(node) === undefined;
      return false;
    }
    if (ast.is.IsPropertySignatureDeclaration(node) || ast.is.IsIndexSignatureDeclaration(node))
      return !ast.hasModifierKind(node, "readonly");
    return (ast.is.IsArrayTypeNode(node) || ast.is.IsTupleTypeNode(node)) && !readonlySequence(node);
  };
  for (const [file, node] of sourceFiles) {
    const module = owner(file);
    if (module === undefined && file.startsWith("packages/"))
      add("unknown-module", file);
    if (module === undefined) continue;
    for (const finding of moduleLifetimeFindings(source, node)) add("module-state", file, finding.start);
    const collect = current => {
      if (current === undefined) return;
      const range = ast.authoredRange(current);
      if (module.name === "front" && closedFiles.has(file) && range.kind === "authored" &&
        (ast.is.IsImportDeclaration(current) || ast.is.IsExportDeclaration(current) || ast.is.IsImportTypeNode(current)) &&
        graph.some(edge => edge.source === file && edge.start === range.start && edge.specifier === "@tsonic/tsts")) {
        if (!ast.is.IsImportDeclaration(current)) add("forbidden-import", file, current);
        let count = 0;
        const gather = child => {
          if (ast.is.IsImportSpecifier(child)) {
            const imported = ast.as.AsImportSpecifier(child);
            const name = ast.text(imported.PropertyName ?? ast.name(child));
            const selected = symbol(ast.name(child));
            if (selected !== undefined && Object.hasOwn(sdkPayloads, name)) { sdkSymbols.set(selected, name); count += 1; }
            else add("forbidden-import", file, current);
          }
          ast.forEachChild(child, nested => { if (nested !== undefined) gather(nested); });
        };
        gather(current);
        if (count === 0) add("forbidden-import", file, current);
      }
      if (module.kind === "library" && publicValues.has(current) && ast.is.IsVariableDeclaration(current)) {
        const annotation = ast.typeNode(current);
        const selected = annotation !== undefined && ast.is.IsTypeReferenceNode(annotation) ? symbol(ast.as.AsTypeReferenceNode(annotation).TypeName) : undefined;
        if (selected !== undefined) libraryFunctionTypes.add(selected);
      }
      if (module.kind === "component" && (ast.is.IsFunctionTypeNode(current) || ast.is.IsFunctionDeclaration(current))) {
        const parameter = ast.parameters(current)[0];
        const annotation = ast.typeNode(parameter);
        const selected = annotation !== undefined && ast.is.IsTypeReferenceNode(annotation) ? symbol(ast.as.AsTypeReferenceNode(annotation).TypeName) : undefined;
        if (ast.text(ast.name(parameter)) === "deps" && selected !== undefined) depsTypes.add(selected);
      }
      if (ast.is.IsTypeAliasDeclaration(current) || ast.is.IsInterfaceDeclaration(current) || ast.is.IsClassDeclaration(current)) {
        const selected = symbol(ast.name(current));
        if (selected !== undefined) aliases.set(selected, current);
        if (selected !== undefined && module.name === "front" &&
          [module.contract, module.contract.replace(/\.ts$/u, ".d.ts")].includes(file) && rawCaptureTypes.includes(ast.text(ast.name(current))))
          rawSymbols.add(selected);
      }
      ast.forEachChild(current, collect);
    };
    collect(node);
  }
  for (const selected of rawSymbols) {
    const declaration = aliases.get(selected);
    if (declaration === undefined) continue;
    const captureFile = ast.getSourceFile(declaration);
    const visit = node => {
      if (ast.is.IsIdentifier(node)) {
        const reference = symbol(node);
        const target = aliases.get(reference);
        if (target !== undefined && ast.getSourceFile(target) === captureFile) rawSymbols.add(reference);
      }
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(declaration);
  }
  for (let previous = -1; previous !== rawSymbols.size + productionSymbols.size + mutableSymbols.size + libraryFunctionTypes.size;) {
    previous = rawSymbols.size + productionSymbols.size + mutableSymbols.size + libraryFunctionTypes.size;
    for (const [selected, node] of aliases) {
      let raw = false, production = false, mutable = false;
      const visit = current => {
        if (current === undefined) return;
        const reference = symbol(current);
        if (ast.is.IsIdentifier(current) && reference !== undefined && rawSymbols.has(reference)) raw = true;
        if (ast.is.IsIdentifier(current) && reference !== undefined && productionSymbols.has(reference)) production = true;
        if (productionMember(current)) production = true;
        if (mutableData(current) || ast.is.IsIdentifier(current) && reference !== undefined &&
          mutableSymbols.has(reference) && !mappedInput(current)) mutable = true;
        ast.forEachChild(current, visit);
      };
      const type = ast.typeNode(node);
      if (type !== undefined) visit(type);
      else ast.forEachChild(node, visit);
      if (raw) rawSymbols.add(selected);
      if (production) productionSymbols.add(selected);
      if (mutable) mutableSymbols.add(selected);
      const annotation = ast.typeNode(node);
      if (annotation !== undefined && ast.is.IsTypeReferenceNode(annotation) && libraryFunctionTypes.has(symbol(ast.as.AsTypeReferenceNode(annotation).TypeName)))
        libraryFunctionTypes.add(selected);
    }
  }
  const resolveType = original => {
    let node = original;
    const active = new Set();
    while (node !== undefined && ast.is.IsTypeReferenceNode(node)) {
      const declaration = aliases.get(symbol(ast.as.AsTypeReferenceNode(node).TypeName));
      if (declaration === undefined || active.has(declaration)) break;
      active.add(declaration); node = ast.typeNode(declaration);
    }
    return node;
  };
  const providerRoles = member => {
    const annotation = ast.typeNode(member);
    if (annotation === undefined || !ast.is.IsTypeOperatorNode(annotation) || ast.operatorKindName(annotation) !== "KindReadonlyKeyword") return false;
    const array = ast.as.AsTypeOperatorNode(annotation).Type;
    if (!ast.is.IsArrayTypeNode(array)) return false;
    const element = ast.as.AsArrayTypeNode(array).ElementType;
    if (!ast.is.IsTypeReferenceNode(element) || ast.typeArguments(element).length !== 0) return false;
    const declarations = checker(element).getSymbolDeclarations(symbol(ast.as.AsTypeReferenceNode(element).TypeName));
    return declarations.length === 1 && declarations.every(declaration => {
      const path = ast.getFileName(ast.getSourceFile(declaration)).slice("/host-gate/".length);
      const module = owner(path);
      return module?.name === "snapshot" && [module.contract, module.contract.replace(/\.ts$/u, ".d.ts")].includes(path) &&
        ast.is.IsInterfaceDeclaration(declaration) && ast.text(ast.name(declaration)) === "LibraryRoleEntry";
    });
  };
  for (const declaration of aliases.values()) {
    const path = ast.getFileName(ast.getSourceFile(declaration)).slice("/host-gate/".length);
    const module = owner(path);
    if (module?.name !== "front" || ![module.contract, module.contract.replace(/\.ts$/u, ".d.ts")].includes(path) ||
      ast.text(ast.name(declaration)) !== "ExtensionOf") continue;
    const callable = ast.typeNode(declaration);
    const result = callable !== undefined && ast.is.IsFunctionTypeNode(callable) ? resolveType(ast.typeNode(callable)) : undefined;
    if (result === undefined || !ast.is.IsUnionTypeNode(result)) continue;
    const arms = ast.children(result);
    const admitted = [];
    const seen = new Set();
    for (const arm of arms) {
      if (!ast.is.IsTypeLiteralNode(arm)) break;
      const members = ast.members(arm);
      const tag = members.find(member => memberName(ast.name(member)) === "kind");
      const value = members.find(member => memberName(ast.name(member)) === "value");
      const payload = ast.typeNode(value);
      const name = payload !== undefined && ast.is.IsTypeReferenceNode(payload) ? ast.as.AsTypeReferenceNode(payload).TypeName : undefined;
      const imported = sdkSymbols.get(symbol(name));
      const literal = ast.typeNode(tag);
      const provider = imported === "SourceDeclarationProvider";
      const roles = members.find(member => memberName(ast.name(member)) === "roles");
      if (members.length !== (provider ? 3 : 2) || !members.every(member => ast.is.IsPropertySignatureDeclaration(member) &&
        ast.hasModifierKind(member, "readonly") && ast.questionToken(member) === undefined) || imported === undefined ||
        provider && !providerRoles(roles) ||
        literal === undefined || !ast.is.IsLiteralTypeNode(literal) || ast.text(ast.children(literal)[0]) !== sdkPayloads[imported] || seen.has(imported)) break;
      seen.add(imported); admitted.push(name);
    }
    if (arms.length === 3 && seen.size === 3) for (const node of admitted) sdkPorts.add(node);
  }
  for (const [file, node] of sourceFiles) {
    const module = owner(file);
    if (module === undefined) continue;
    const isContract = closedFiles.has(file);
    const rawAllowed = module.name === "front" || module.name === "pipeline" && !isContract;
    const pluginLoading = module.name === "plugins" && module.effects.some(effect => effect.path === file && effect.role === "plugin-loading");
    const visit = current => {
      const kind = ast.kindName(current);
      if (!pluginLoading && (ast.is.IsIdentifier(current) && ["require", "process", "globalThis", "eval"].includes(ast.text(current)) ||
        ast.is.IsNewExpression(current) && ast.text(ast.as.AsNewExpression(current).Expression) === "Function")) add("unsafe-type-escape", file, current);
      if (module.name !== "query" && ast.is.IsTryStatement(current)) add("impure-component", file, current);
      if (ast.is.IsThrowStatement(current)) {
        const expression = ast.as.AsThrowStatement(current).Expression;
        const declarations = ast.is.IsIdentifier(expression) ? checker(expression).getSymbolDeclarations(symbol(expression)) : [];
        const rethrow = declarations.some(declaration => ast.is.IsVariableDeclaration(declaration) &&
          ast.is.IsCatchClause(ast.parent(declaration)));
        const nativeConstruction = value => {
          if (value === undefined || !ast.is.IsNewExpression(value)) return false;
          const constructor = ast.as.AsNewExpression(value).Expression;
          return ast.is.IsIdentifier(constructor) && symbol(constructor) === undefined &&
            ["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "EvalError", "AggregateError"].includes(ast.text(constructor));
        };
        const constructed = nativeConstruction(expression) || declarations.some(declaration => ast.is.IsVariableDeclaration(declaration) &&
          nativeConstruction(ast.as.AsVariableDeclaration(declaration).Initializer));
        const queries = checker(expression);
        const thrownType = queries.getTypeAtLocation(expression);
        const errorType = queries.typeToString(thrownType);
        const nativeType = queries.getSymbolDeclarations(queries.getTypeSymbol(thrownType)).length === 0 &&
          queries.getSymbolDeclarations(queries.getTypeAliasSymbol(thrownType)).length === 0 &&
          ["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "EvalError", "AggregateError"].includes(errorType);
        if (!rethrow && !constructed && !nativeType)
          add("non-error-throw", file, current);
      }
      if (module.kind === "component" && ast.is.IsPropertySignatureDeclaration(current)) {
        const annotation = ast.typeNode(current);
        if (annotation !== undefined && ast.is.IsTypeReferenceNode(annotation) && libraryFunctionTypes.has(symbol(ast.as.AsTypeReferenceNode(annotation).TypeName))) {
          let container = ast.parent(current);
          while (container !== undefined && !ast.is.IsInterfaceDeclaration(container) && !ast.is.IsTypeAliasDeclaration(container)) container = ast.parent(container);
          if (container !== undefined && depsTypes.has(symbol(ast.name(container)))) add("impure-component", file, current);
        }
      }
      if (["KindClassDeclaration", "KindClassExpression"].includes(kind)) add("class", file, current);
      const brand = brandConstructor(current, module, file);
      if (brand !== undefined) {
        const previous = brandAssertions.get(brand);
        if (previous !== undefined) {
          add("unsafe-type-escape", previous.file, previous.node);
          add("unsafe-type-escape", file, current);
        } else brandAssertions.set(brand, { file, node: current });
      }
      if (["KindAnyKeyword", "KindTypeAssertionExpression", "KindNonNullExpression",
        "KindEnumDeclaration", "KindModuleDeclaration", "KindImportEqualsDeclaration", "KindExportAssignment"].includes(kind))
        add("unsafe-type-escape", file, current);
      if (kind === "KindAsExpression" && brand === undefined) add("unsafe-type-escape", file, current);
      if (isContract && (ast.is.IsFunctionDeclaration(current) && ast.body(current) !== undefined ||
        ast.is.IsArrowFunction(current) || ast.is.IsFunctionExpression(current) ||
        ast.is.IsCallExpression(current) || ast.is.IsNewExpression(current))) add("contract-shape", file, current);
      if (isContract && ast.is.IsVariableDeclaration(current) && ast.as.AsVariableDeclaration(current).Initializer !== undefined)
        add("contract-shape", file, current);
      if ((file === module.contract || file === module.contract.replace(/\.ts$/u, ".d.ts")) && ast.is.IsFunctionDeclaration(current))
        add("contract-shape", file, current);
      const selected = ast.is.IsIdentifier(current) ? symbol(current) : undefined;
      if (isContract && selected !== undefined && sdkSymbols.has(selected) && !sdkPorts.has(current) &&
        !ast.is.IsImportSpecifier(ast.parent(current))) add("forbidden-import", file, current);
      if (selected !== undefined && !rawAllowed && rawSymbols.has(selected)) add("forbidden-import", file, current);
      if (isContract && (mutableData(current) || selected !== undefined && mutableSymbols.has(selected) && !mappedInput(current)))
        add("contract-shape", file, current);
      if (isContract && selected !== undefined && productionSymbols.has(selected)) add("removed-concept", file, current);
      if (productionMember(current)) add("removed-concept", file, current);
      if (isContract && ast.is.IsTypeReferenceNode(current)) {
        const name = ast.as.AsTypeReferenceNode(current).TypeName;
        if (ast.is.IsIdentifier(name) && ["ReturnType", "Parameters", "InstanceType"].includes(ast.text(name)))
          add("contract-shape", file, current);
        const operator = ast.is.IsIdentifier(name) ? ast.text(name) : "";
        if (["Omit", "Pick"].includes(operator)) add("contract-shape", file, current);
        if (operator === "Exclude") {
          const argument = ast.typeArguments(current)[0];
          const shape = typeShape(current);
          const literalUnion = type => shape.getStringLiteralTypeValue(type) !== undefined ||
            shape.isUnion(type) && shape.getUnionOrIntersectionTypes(type).every(literalUnion);
          if (argument === undefined || !literalUnion(shape.getTypeFromTypeNode(argument))) add("contract-shape", file, current);
        }
      }
      if (isContract && (ast.is.IsMappedTypeNode(current) || ast.is.IsConditionalTypeNode(current) ||
        ast.is.IsIndexedAccessTypeNode(current) && !phaseSlotSelection(current)))
        add("contract-shape", file, current);
      if (isContract && ["KindUnknownKeyword", "KindObjectKeyword"].includes(kind)) {
        const parent = ast.parent(current);
        const condition = ast.is.IsConditionalTypeNode(parent) ? ast.as.AsConditionalTypeNode(parent) : undefined;
        const parameter = ast.is.IsTypeParameterDeclaration(parent) ? ast.as.AsTypeParameterDeclaration(parent) : undefined;
        if (condition?.CheckType !== current && condition?.ExtendsType !== current && parameter?.Constraint !== current &&
          !(kind === "KindObjectKeyword" && (opaqueBrand(current, module, file) || phaseSlotObject(current))))
          add("contract-shape", file, current);
      }
      const publicValue = publicValues.get(current);
      if (publicValue !== undefined) {
        const annotation = ast.is.IsVariableDeclaration(current) ? ast.typeNode(current) : undefined;
        const reference = annotation !== undefined && ast.is.IsTypeReferenceNode(annotation) ? symbol(ast.as.AsTypeReferenceNode(annotation).TypeName) : undefined;
        if (reference === undefined || !contractFunctions.get(module)?.has(reference)) add("contract-shape", file, current);
      }
      if (ast.is.IsTypeAliasDeclaration(current) && stageTypes.has(symbol(ast.name(current)))) {
        const parameters = ast.parameters(ast.typeNode(current));
        const first = ast.typeNode(parameters[0]);
        const identity = first !== undefined && ast.is.IsTypeReferenceNode(first) ? symbol(ast.as.AsTypeReferenceNode(first).TypeName) : undefined;
        const declarations = checker(current).getSymbolDeclarations(identity);
        if (parameters.length < 2 || declarations.length === 0 || !declarations.every(declaration =>
          ast.getFileName(ast.getSourceFile(declaration)) === `/host-gate/${module.contract}` &&
          ast.text(ast.name(declaration)).endsWith("Deps") && (ast.is.IsInterfaceDeclaration(declaration) ||
            ast.is.IsTypeAliasDeclaration(declaration) && ast.typeNode(declaration) !== undefined && ast.is.IsTypeLiteralNode(ast.typeNode(declaration)))))
          add("impure-component", file, current);
      }
      if (["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(kind) &&
        quarantineReference(ast.text(current), quarantineRoots)) add("forbidden-import", file, current);
      ast.forEachChild(current, child => { if (child !== undefined) visit(child); });
    };
    visit(node);
    for (const directive of node.CommentDirectives ?? []) add("unsafe-type-escape", file, directive.Loc.pos);
    if (node.CheckJsDirective !== undefined && node.CheckJsDirective.Enabled === false)
      add("unsafe-type-escape", file, node.CheckJsDirective.Range.pos);
  }
  return Object.freeze(findings);
}
function moduleLifetimeFindings(source, file) {
  const immutableData = true;
  const ast = source.ast;
  if (ast.isDeclarationFile(file)) return [];
  const findings = [];
  const checker = source.getSourceFileQueries(file).checker;
  const active = new Set();
  const classifications = new Map();
  const transparent = node => {
    if (ast.is.IsParenthesizedExpression(node)) return ast.as.AsParenthesizedExpression(node).Expression;
    if (ast.is.IsAsExpression(node)) return ast.as.AsAsExpression(node).Expression;
    if (ast.is.IsSatisfiesExpression(node)) return ast.as.AsSatisfiesExpression(node).Expression;
    if (ast.is.IsTypeAssertion(node)) return ast.as.AsTypeAssertion(node).Expression;
    if (ast.is.IsNonNullExpression(node)) return ast.as.AsNonNullExpression(node).Expression;
    return undefined;
  };
  const unwrap = original => {
    let node = original;
    for (let child = node === undefined ? undefined : transparent(node); child !== undefined; child = transparent(node)) node = child;
    return node;
  };
  const invoked = node => {
    let current = node;
    while (ast.parent(current) !== undefined && transparent(ast.parent(current)) === current) current = ast.parent(current);
    const parent = ast.parent(current);
    return parent !== undefined && ast.is.IsCallExpression(parent) && ast.as.AsCallExpression(parent).Expression === current;
  };
  const moduleOwned = node => {
    for (let parent = ast.parent(node); parent !== undefined; parent = ast.parent(parent)) {
      if (scopedOwners.includes(ast.kindName(parent)) && !invoked(parent)) return false;
      if (ast.is.IsPropertyDeclaration(parent) && !ast.hasModifierKind(parent, "static")) return false;
    }
    return true;
  };
  const classify = original => {
    const node = unwrap(original);
    if (node === undefined) return undefined;
    if (classifications.has(node)) return classifications.get(node);
    const result = classifyNode(node);
    classifications.set(node, result);
    return result;
  };
  const classifyNode = node => {
    const kind = ast.kindName(node);
    if (["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(kind)) return { kind: "string" };
    if (["KindNumericLiteral", "KindBigIntLiteral", "KindTrueKeyword", "KindFalseKeyword", "KindNullKeyword",
      "KindArrowFunction", "KindFunctionExpression"].includes(kind)) return { kind: "value" };
    if (ast.is.IsIdentifier(node)) {
      const parent = ast.parent(node);
      let symbol = ast.is.IsShorthandPropertyAssignment(parent)
        ? checker.getLexicallyResolvedSymbol(node) : checker.getSymbolAtLocation(node);
      if (symbol !== undefined && checker.getSymbolDeclarations(symbol).some(declaration =>
        ["KindImportSpecifier", "KindImportClause", "KindExportSpecifier", "KindNamespaceImport", "KindNamespaceExport"]
          .includes(ast.kindName(declaration)))) symbol = checker.getAliasedSymbol(symbol);
      if (symbol === undefined || active.has(symbol)) return immutableData ? undefined : { kind: "value" };
      const declaration = checker.getSymbolValueDeclaration(symbol);
      if (declaration !== undefined && ast.is.IsFunctionDeclaration(declaration)) return { kind: "value" };
      if (declaration === undefined || !ast.is.IsVariableDeclaration(declaration) ||
        ast.variableDeclarationKind(declaration) !== "const") return immutableData ? undefined : { kind: "value" };
      active.add(symbol);
      const result = classify(ast.as.AsVariableDeclaration(declaration).Initializer);
      active.delete(symbol);
      return result ?? (immutableData ? undefined : { kind: "value" });
    }
    if (!immutableData && ast.is.IsArrayLiteralExpression(node))
      return ast.elements(node).every(element => classify(element) !== undefined) ? { kind: "value" } : undefined;
    if (!immutableData && ast.is.IsObjectLiteralExpression(node)) return ast.properties(node).every(property =>
      ast.is.IsPropertyAssignment(property) && classify(ast.as.AsPropertyAssignment(property).Initializer) !== undefined)
      ? { kind: "value" } : undefined;
    if (ast.is.IsPrefixUnaryExpression(node)) return classify(ast.as.AsPrefixUnaryExpression(node).Operand) === undefined
      ? undefined : { kind: "value" };
    if (ast.is.IsElementAccessExpression(node)) {
      const selection = ast.as.AsElementAccessExpression(node);
      if (!ast.is.IsNumericLiteral(selection.ArgumentExpression)) return undefined;
      const index = Number(ast.text(selection.ArgumentExpression));
      if (!Number.isInteger(index) || index < 0) return undefined;
      let vector = classify(selection.Expression);
      let remaining = BigInt(index);
      if (vector?.kind !== "vector" || remaining >= vector.length) return undefined;
      while (vector.kind === "vector") {
        let selected;
        for (const segment of vector.segments) {
          const length = segment.spread ? segment.value.length : 1n;
          if (remaining < length) {
            selected = segment;
            break;
          }
          remaining -= length;
        }
        if (selected === undefined) return undefined;
        if (!selected.spread) return selected.value;
        vector = selected.value;
      }
      return undefined;
    }
    if (ast.is.IsTemplateExpression(node)) {
      const spans = ast.as.AsTemplateExpression(node).TemplateSpans?.Nodes;
      return spans !== undefined && spans.every(span => span !== undefined && ast.is.IsTemplateSpan(span) &&
        classify(ast.as.AsTemplateSpan(span).Expression)?.kind === "string") ? { kind: "string" } : undefined;
    }
    if (ast.is.IsBinaryExpression(node)) {
      const operation = ast.as.AsBinaryExpression(node);
      return ast.operatorKindName(node) === "KindPlusToken" && classify(operation.Left)?.kind === "string" &&
        classify(operation.Right)?.kind === "string" ? { kind: "string" } : undefined;
    }
    if (!ast.is.IsCallExpression(node)) return undefined;
    const selected = ast.as.AsCallExpression(node);
    if (!ast.is.IsPropertyAccessExpression(selected.Expression)) return undefined;
    const callee = ast.as.AsPropertyAccessExpression(selected.Expression);
    if (ast.text(callee.Expression) !== "Object" || ast.text(ast.name(selected.Expression)) !== "freeze") return undefined;
    const arguments_ = ast.arguments(node);
    if (arguments_.length !== 1) return undefined;
    const value = unwrap(arguments_[0]);
    if (ast.is.IsArrayLiteralExpression(value)) {
      const segments = [];
      let length = 0n;
      for (const element of ast.elements(value)) {
        if (ast.is.IsSpreadElement(element)) {
          const vector = classify(ast.as.AsSpreadElement(element).Expression);
          if (vector?.kind !== "vector") return undefined;
          segments.push({ spread: true, value: vector });
          length += vector.length;
        } else {
          const item = classify(element);
          if (item === undefined) return undefined;
          segments.push({ spread: false, value: item });
          length += 1n;
        }
      }
      return { kind: "vector", length, segments };
    }
    if (!ast.is.IsObjectLiteralExpression(value)) return classify(value);
    return ast.properties(value).every(property => ast.is.IsPropertyAssignment(property)
      ? classify(ast.as.AsPropertyAssignment(property).Initializer) !== undefined
      : ast.is.IsShorthandPropertyAssignment(property) && classify(ast.name(property)) !== undefined)
      ? { kind: "value" } : undefined;
  };
  const visit = node => {
    const declaration = ast.is.IsVariableDeclaration(node) ? ast.as.AsVariableDeclaration(node)
      : ast.is.IsPropertyDeclaration(node) && ast.hasModifierKind(node, "static") ? ast.as.AsPropertyDeclaration(node) : undefined;
    if (declaration !== undefined && moduleOwned(node)) {
      for (let parent = node; parent !== undefined; parent = ast.parent(parent)) {
        if (ast.hasModifierKind(parent, "ambient")) return;
      }
      const initializer = declaration.Initializer;
      const name = ast.name(node);
      const mutableBinding = immutableData && (ast.is.IsVariableDeclaration(node)
        ? ast.variableDeclarationKind(node) !== "const" : !ast.hasModifierKind(node, "readonly"));
      if (mutableBinding || initializer === undefined || classify(initializer) === undefined) {
        findings.push({ start: ast.authoredRange(name ?? node).start });
      }
    }
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  return findings;
}
