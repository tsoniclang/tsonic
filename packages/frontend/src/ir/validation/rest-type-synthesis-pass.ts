/**
 * Rest Type Synthesis Pass
 *
 * Computes and attaches rest type information to object destructuring patterns.
 * For a pattern like `const { a, b, ...rest } = obj`, this pass:
 * 1. Determines what properties `rest` will contain (all of obj's properties minus a and b)
 * 2. Creates a synthetic type name for the rest object
 * 3. Attaches this info to the pattern for the emitter
 *
 * This pass runs BEFORE soundness validation and emitting.
 */

import { createHash } from "crypto";
import {
  IrModule,
  IrStatement,
  IrType,
  IrPattern,
  IrObjectPattern,
  IrInterfaceMember,
  IrPropertySignature,
  IrParameter,
  IrBlockStatement,
  IrVariableDeclaration,
  IrVariableDeclarator,
  IrClassDeclaration,
  IrClassMember,
  IrPropertyDeclaration,
  IrObjectPatternProperty,
} from "../types.js";

/**
 * Result of rest type synthesis pass
 */
export type RestTypeSynthesisResult = {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
};

/**
 * Context for tracking state during synthesis
 */
type SynthesisContext = {
  /** Generated class declarations for rest types */
  readonly generatedDeclarations: IrClassDeclaration[];
  /** Map from shape signature to generated type name for deduplication */
  readonly shapeToName: Map<string, string>;
  /** Module file path for unique naming */
  readonly moduleFilePath: string;
};

/**
 * Create a fresh synthesis context for a module
 */
const createContext = (moduleFilePath: string): SynthesisContext => ({
  generatedDeclarations: [],
  shapeToName: new Map(),
  moduleFilePath,
});

/**
 * Generate a short hash from module path
 */
const generateModuleHash = (filePath: string): string => {
  return createHash("md5").update(filePath).digest("hex").slice(0, 4);
};

/**
 * Compute shape signature for rest members
 */
const computeRestSignature = (
  members: readonly IrInterfaceMember[]
): string => {
  const sorted = [...members]
    .map((m) => {
      if (m.kind === "propertySignature") {
        return `${m.name}:${m.type.kind}`;
      }
      return `method:${m.name}`;
    })
    .sort()
    .join(";");
  return `rest:{${sorted}}`;
};

/**
 * Generate a short hash from shape signature
 */
const generateShapeHash = (signature: string): string => {
  return createHash("md5").update(signature).digest("hex").slice(0, 8);
};

/**
 * Convert interface members to class property declarations
 */
const membersToClassMembers = (
  members: readonly IrInterfaceMember[]
): readonly IrClassMember[] => {
  return members
    .filter((m): m is IrPropertySignature => m.kind === "propertySignature")
    .map(
      (m): IrPropertyDeclaration => ({
        kind: "propertyDeclaration",
        name: m.name,
        type: m.type,
        initializer: undefined,
        isStatic: false,
        isReadonly: m.isReadonly ?? false,
        accessibility: "public",
        isRequired: !m.isOptional,
      })
    );
};

/**
 * Get or create a generated type name for rest members
 */
const getOrCreateRestTypeName = (
  members: readonly IrInterfaceMember[],
  ctx: SynthesisContext
): string => {
  const signature = computeRestSignature(members);
  const existing = ctx.shapeToName.get(signature);
  if (existing) {
    return existing;
  }

  const moduleHash = generateModuleHash(ctx.moduleFilePath);
  const shapeHash = generateShapeHash(signature);
  const name = `__Rest_${moduleHash}_${shapeHash}`;
  ctx.shapeToName.set(signature, name);

  // Create a class declaration for the rest type
  const declaration: IrClassDeclaration = {
    kind: "classDeclaration",
    name,
    typeParameters: undefined,
    superClass: undefined,
    implements: [],
    members: membersToClassMembers(members),
    isExported: true,
    isStruct: false,
  };

  ctx.generatedDeclarations.push(declaration);
  return name;
};

/**
 * Extract property signatures from a type
 * Works for object types, reference types (resolved to interface), etc.
 */
const extractMembers = (
  type: IrType
): readonly IrInterfaceMember[] | undefined => {
  switch (type.kind) {
    case "objectType":
      return type.members;
    case "referenceType":
      // For reference types, we'd need to resolve to the actual interface
      // For now, check if structuralMembers is available
      return type.structuralMembers;
    default:
      return undefined;
  }
};

/**
 * Compute rest members by removing picked keys from source members
 */
const computeRestMembers = (
  sourceMembers: readonly IrInterfaceMember[],
  pickedKeys: readonly string[]
): readonly IrInterfaceMember[] => {
  const pickedSet = new Set(pickedKeys);
  return sourceMembers.filter((m) => {
    if (m.kind === "propertySignature") {
      return !pickedSet.has(m.name);
    }
    if (m.kind === "methodSignature") {
      return !pickedSet.has(m.name);
    }
    return true;
  });
};

/**
 * Get picked keys from object pattern properties (non-rest properties)
 */
const getPickedKeys = (
  properties: readonly IrObjectPatternProperty[]
): readonly string[] => {
  return properties
    .filter(
      (p): p is Extract<typeof p, { kind: "property" }> => p.kind === "property"
    )
    .map((p) => p.key);
};

/**
 * Synthesize rest type info for an object pattern
 */
const synthesizeObjectPattern = (
  pattern: IrObjectPattern,
  rhsType: IrType | undefined,
  ctx: SynthesisContext
): IrObjectPattern => {
  // Find if there's a rest property
  const restProp = pattern.properties.find((p) => p.kind === "rest");
  if (!restProp) {
    // No rest property, just recursively process nested patterns
    return {
      ...pattern,
      properties: pattern.properties.map((p) => {
        if (p.kind === "property" && p.value.kind === "objectPattern") {
          // Would need RHS type drilling - skip for now
          return p;
        }
        return p;
      }),
    };
  }

  // We have a rest property, compute its type
  if (!rhsType) {
    // No type info available, can't synthesize
    return pattern;
  }

  const sourceMembers = extractMembers(rhsType);
  if (!sourceMembers || sourceMembers.length === 0) {
    // Can't determine source members
    return pattern;
  }

  const pickedKeys = getPickedKeys(pattern.properties);
  const restMembers = computeRestMembers(sourceMembers, pickedKeys);

  if (restMembers.length === 0) {
    // Rest is empty - could use empty object
    return pattern;
  }

  // Generate or reuse a type name for the rest shape
  const restTypeName = getOrCreateRestTypeName(restMembers, ctx);

  // Update the rest property with shape info
  const updatedProperties = pattern.properties.map((p) => {
    if (p.kind === "rest") {
      return {
        ...p,
        restShapeMembers: restMembers,
        restSynthTypeName: restTypeName,
      };
    }
    return p;
  });

  return {
    ...pattern,
    properties: updatedProperties,
  };
};

/**
 * Synthesize rest types in a pattern, given the RHS type
 */
const synthesizePattern = (
  pattern: IrPattern,
  rhsType: IrType | undefined,
  ctx: SynthesisContext
): IrPattern => {
  switch (pattern.kind) {
    case "identifierPattern":
      return pattern;
    case "objectPattern":
      return synthesizeObjectPattern(pattern, rhsType, ctx);
    case "arrayPattern":
      // Array patterns don't need rest type synthesis
      // (rest is just slicing the array, no new type needed)
      return pattern;
    default:
      return pattern;
  }
};

/**
 * Process a variable declarator to synthesize rest types
 */
const processDeclarator = (
  decl: IrVariableDeclarator,
  ctx: SynthesisContext
): IrVariableDeclarator => {
  if (decl.name.kind === "identifierPattern") {
    // Simple variable, no destructuring
    return decl;
  }

  // Get the RHS type - either from annotation or inferred
  const rhsType = decl.type ?? decl.initializer?.inferredType;

  const synthesizedPattern = synthesizePattern(decl.name, rhsType, ctx);
  if (synthesizedPattern === decl.name) {
    return decl;
  }

  return {
    ...decl,
    name: synthesizedPattern,
  };
};

/**
 * Process a statement to synthesize rest types
 */
const processStatement = (
  stmt: IrStatement,
  ctx: SynthesisContext
): IrStatement => {
  switch (stmt.kind) {
    case "variableDeclaration": {
      const updatedDecls = stmt.declarations.map((d) =>
        processDeclarator(d, ctx)
      );
      const hasChanges = updatedDecls.some(
        (d, i) => d !== stmt.declarations[i]
      );
      if (!hasChanges) {
        return stmt;
      }
      return {
        ...stmt,
        declarations: updatedDecls,
      };
    }

    case "functionDeclaration": {
      // Process function body and parameters
      const bodyStmts = stmt.body.statements.map((s) =>
        processStatement(s, ctx)
      );
      const hasBodyChanges = bodyStmts.some(
        (s, i) => s !== stmt.body.statements[i]
      );

      // Process parameters for destructuring patterns
      const params = stmt.parameters.map((p) => processParameter(p, ctx));
      const hasParamChanges = params.some((p, i) => p !== stmt.parameters[i]);

      if (!hasBodyChanges && !hasParamChanges) {
        return stmt;
      }

      return {
        ...stmt,
        parameters: hasParamChanges ? params : stmt.parameters,
        body: hasBodyChanges
          ? { ...stmt.body, statements: bodyStmts }
          : stmt.body,
      };
    }

    case "classDeclaration": {
      // Process class methods
      const members = stmt.members.map((m) => {
        if (m.kind === "methodDeclaration" && m.body) {
          const bodyStmts = m.body.statements.map((s) =>
            processStatement(s, ctx)
          );
          const hasChanges = bodyStmts.some(
            (s, i) => s !== m.body?.statements[i]
          );
          if (!hasChanges) {
            return m;
          }
          return {
            ...m,
            body: { ...m.body, statements: bodyStmts } as IrBlockStatement,
          };
        }
        if (m.kind === "constructorDeclaration" && m.body) {
          const bodyStmts = m.body.statements.map((s) =>
            processStatement(s, ctx)
          );
          const hasChanges = bodyStmts.some(
            (s, i) => s !== m.body?.statements[i]
          );
          if (!hasChanges) {
            return m;
          }
          return {
            ...m,
            body: { ...m.body, statements: bodyStmts } as IrBlockStatement,
          };
        }
        return m;
      });
      const hasChanges = members.some((m, i) => m !== stmt.members[i]);
      if (!hasChanges) {
        return stmt;
      }
      return { ...stmt, members };
    }

    case "ifStatement": {
      const thenStatement = processStatement(stmt.thenStatement, ctx);
      const elseStatement = stmt.elseStatement
        ? processStatement(stmt.elseStatement, ctx)
        : undefined;
      if (
        thenStatement === stmt.thenStatement &&
        elseStatement === stmt.elseStatement
      ) {
        return stmt;
      }
      return { ...stmt, thenStatement, elseStatement };
    }

    case "whileStatement": {
      const body = processStatement(stmt.body, ctx);
      if (body === stmt.body) {
        return stmt;
      }
      return { ...stmt, body };
    }

    case "forStatement": {
      let initializer = stmt.initializer;
      if (initializer?.kind === "variableDeclaration") {
        initializer = processStatement(
          initializer,
          ctx
        ) as IrVariableDeclaration;
      }
      const body = processStatement(stmt.body, ctx);
      if (initializer === stmt.initializer && body === stmt.body) {
        return stmt;
      }
      return { ...stmt, initializer, body };
    }

    case "forOfStatement": {
      // Process the variable pattern for rest types
      const variable = synthesizePattern(
        stmt.variable,
        stmt.expression.inferredType
          ? extractElementType(stmt.expression.inferredType)
          : undefined,
        ctx
      );
      const body = processStatement(stmt.body, ctx);
      if (variable === stmt.variable && body === stmt.body) {
        return stmt;
      }
      return { ...stmt, variable, body };
    }

    case "blockStatement": {
      const statements = stmt.statements.map((s) => processStatement(s, ctx));
      const hasChanges = statements.some((s, i) => s !== stmt.statements[i]);
      if (!hasChanges) {
        return stmt;
      }
      return { ...stmt, statements };
    }

    case "tryStatement": {
      const tryBlock: IrBlockStatement = {
        ...stmt.tryBlock,
        statements: stmt.tryBlock.statements.map((s) =>
          processStatement(s, ctx)
        ),
      };
      const catchClause = stmt.catchClause
        ? {
            ...stmt.catchClause,
            body: {
              ...stmt.catchClause.body,
              statements: stmt.catchClause.body.statements.map((s) =>
                processStatement(s, ctx)
              ),
            },
          }
        : undefined;
      const finallyBlock = stmt.finallyBlock
        ? {
            ...stmt.finallyBlock,
            statements: stmt.finallyBlock.statements.map((s) =>
              processStatement(s, ctx)
            ),
          }
        : undefined;
      return { ...stmt, tryBlock, catchClause, finallyBlock };
    }

    default:
      return stmt;
  }
};

/**
 * Process a parameter for destructuring patterns
 */
const processParameter = (
  param: IrParameter,
  ctx: SynthesisContext
): IrParameter => {
  if (param.pattern.kind === "identifierPattern") {
    return param;
  }

  const synthesizedPattern = synthesizePattern(param.pattern, param.type, ctx);
  if (synthesizedPattern === param.pattern) {
    return param;
  }

  return {
    ...param,
    pattern: synthesizedPattern,
  };
};

/**
 * Extract element type from array/iterable type
 */
const extractElementType = (type: IrType): IrType | undefined => {
  if (type.kind === "arrayType") {
    return type.elementType;
  }
  // Could handle other iterables here
  return undefined;
};

/**
 * Process a module to synthesize rest types
 */
const processModule = (module: IrModule): IrModule => {
  const ctx = createContext(module.filePath);

  const body = module.body.map((s) => processStatement(s, ctx));
  const hasChanges = body.some((s, i) => s !== module.body[i]);

  if (!hasChanges && ctx.generatedDeclarations.length === 0) {
    return module;
  }

  // Prepend generated declarations to the module
  const allStatements = [
    ...ctx.generatedDeclarations,
    ...(hasChanges ? body : module.body),
  ];

  return {
    ...module,
    body: allStatements,
  };
};

/**
 * Run the rest type synthesis pass on a set of modules
 */
export const runRestTypeSynthesisPass = (
  modules: readonly IrModule[]
): RestTypeSynthesisResult => {
  const processedModules = modules.map(processModule);
  return {
    ok: true,
    modules: processedModules,
  };
};
