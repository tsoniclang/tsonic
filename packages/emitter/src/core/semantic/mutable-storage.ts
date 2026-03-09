import {
  IrClassDeclaration,
  IrExpression,
  IrInterfaceDeclaration,
  IrModule,
  IrPattern,
  IrStatement,
  IrType,
} from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveTypeAlias, stripNullish } from "./type-resolution.js";

type MutableStorageAnalysis = {
  readonly mutableModuleBindings: ReadonlySet<string>;
  readonly mutablePropertySlots: ReadonlySet<string>;
};

const nativeArrayMutationMembers = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
]);

const propertySlotKey = (typeName: string, propertyName: string): string =>
  `${typeName}::${propertyName}`;

const collectPatternNames = (pattern: IrPattern): readonly string[] => {
  switch (pattern.kind) {
    case "identifierPattern":
      return [pattern.name];
    case "arrayPattern":
      return pattern.elements.flatMap((element) =>
        element ? collectPatternNames(element.pattern) : []
      );
    case "objectPattern":
      return pattern.properties.flatMap((property) =>
        property.kind === "property"
          ? collectPatternNames(property.value)
          : collectPatternNames(property.pattern)
      );
  }
};

const collectTopLevelConstBindings = (
  module: IrModule
): ReadonlySet<string> => {
  const result = new Set<string>();
  for (const stmt of module.body) {
    if (stmt.kind !== "variableDeclaration") continue;
    if (stmt.declarationKind !== "const") continue;
    for (const decl of stmt.declarations) {
      for (const name of collectPatternNames(decl.name)) {
        result.add(name);
      }
    }
  }
  return result;
};

const normalizeLocalTypeNameCandidates = (
  typeName: string
): readonly string[] => {
  const candidates = new Set<string>([typeName]);
  if (typeName.endsWith("$instance")) {
    candidates.add(typeName.slice(0, -"$instance".length));
  }
  if (typeName.startsWith("__") && typeName.endsWith("$views")) {
    candidates.add(typeName.slice("__".length, -"$views".length));
  }
  return Array.from(candidates);
};

const buildClassMap = (
  module: IrModule
): ReadonlyMap<string, IrClassDeclaration> =>
  new Map(
    module.body
      .filter(
        (stmt): stmt is IrClassDeclaration => stmt.kind === "classDeclaration"
      )
      .map((stmt) => [stmt.name, stmt])
  );

const buildInterfaceMap = (
  module: IrModule
): ReadonlyMap<string, IrInterfaceDeclaration> =>
  new Map(
    module.body
      .filter(
        (stmt): stmt is IrInterfaceDeclaration =>
          stmt.kind === "interfaceDeclaration"
      )
      .map((stmt) => [stmt.name, stmt])
  );

const collectLocalNominalTypes = (
  type: IrType | undefined,
  context: EmitterContext,
  classes: ReadonlyMap<string, IrClassDeclaration>,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>,
  seen: Set<string> = new Set<string>()
): ReadonlySet<string> => {
  if (!type) return new Set<string>();

  const resolved = resolveTypeAlias(stripNullish(type), context);
  switch (resolved.kind) {
    case "referenceType": {
      const result = new Set<string>();
      for (const candidate of normalizeLocalTypeNameCandidates(resolved.name)) {
        if (seen.has(candidate)) continue;
        if (classes.has(candidate) || interfaces.has(candidate)) {
          result.add(candidate);
        }
      }
      return result;
    }
    case "unionType":
    case "intersectionType": {
      const result = new Set<string>();
      for (const entry of resolved.types) {
        for (const candidate of collectLocalNominalTypes(
          entry,
          context,
          classes,
          interfaces,
          seen
        )) {
          result.add(candidate);
        }
      }
      return result;
    }
    default:
      return new Set<string>();
  }
};

const findPropertyOwnersInClassChain = (
  className: string,
  propertyName: string,
  classes: ReadonlyMap<string, IrClassDeclaration>,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>,
  context: EmitterContext,
  seen: Set<string> = new Set<string>()
): ReadonlySet<string> => {
  if (seen.has(className)) return new Set<string>();
  seen.add(className);

  const decl = classes.get(className);
  if (!decl) return new Set<string>();
  if (
    decl.members.some(
      (member) =>
        member.kind === "propertyDeclaration" && member.name === propertyName
    )
  ) {
    return new Set<string>([className]);
  }

  const result = new Set<string>();
  if (decl.superClass) {
    for (const parentName of collectLocalNominalTypes(
      decl.superClass,
      context,
      classes,
      interfaces
    )) {
      for (const owner of findPropertyOwnersInClassChain(
        parentName,
        propertyName,
        classes,
        interfaces,
        context,
        seen
      )) {
        result.add(owner);
      }
    }
  }

  return result;
};

const findPropertyOwnersInInterfaceChain = (
  interfaceName: string,
  propertyName: string,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>,
  classes: ReadonlyMap<string, IrClassDeclaration>,
  context: EmitterContext,
  seen: Set<string> = new Set<string>()
): ReadonlySet<string> => {
  if (seen.has(interfaceName)) return new Set<string>();
  seen.add(interfaceName);

  const decl = interfaces.get(interfaceName);
  if (!decl) return new Set<string>();
  if (
    decl.members.some(
      (member) =>
        member.kind === "propertySignature" && member.name === propertyName
    )
  ) {
    return new Set<string>([interfaceName]);
  }

  const result = new Set<string>();
  for (const ext of decl.extends) {
    for (const parentName of collectLocalNominalTypes(
      ext,
      context,
      classes,
      interfaces
    )) {
      for (const owner of findPropertyOwnersInInterfaceChain(
        parentName,
        propertyName,
        interfaces,
        classes,
        context,
        seen
      )) {
        result.add(owner);
      }
    }
  }

  return result;
};

const collectPropertyOwners = (
  receiverType: IrType | undefined,
  propertyName: string,
  context: EmitterContext,
  classes: ReadonlyMap<string, IrClassDeclaration>,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>
): ReadonlySet<string> => {
  const result = new Set<string>();
  for (const typeName of collectLocalNominalTypes(
    receiverType,
    context,
    classes,
    interfaces
  )) {
    if (classes.has(typeName)) {
      for (const owner of findPropertyOwnersInClassChain(
        typeName,
        propertyName,
        classes,
        interfaces,
        context
      )) {
        result.add(owner);
      }
      continue;
    }
    if (interfaces.has(typeName)) {
      for (const owner of findPropertyOwnersInInterfaceChain(
        typeName,
        propertyName,
        interfaces,
        classes,
        context
      )) {
        result.add(owner);
      }
    }
  }
  return result;
};

type ScopeStack = Set<string>[];

const isShadowed = (name: string, scopes: ScopeStack): boolean => {
  for (let i = scopes.length - 1; i >= 0; i -= 1) {
    if (scopes[i]?.has(name)) return true;
  }
  return false;
};

const pushScope = (scopes: ScopeStack, names: readonly string[] = []): void => {
  scopes.push(new Set<string>(names));
};

const popScope = (scopes: ScopeStack): void => {
  scopes.pop();
};

const declarePattern = (pattern: IrPattern, scopes: ScopeStack): void => {
  const current = scopes[scopes.length - 1];
  if (!current) return;
  for (const name of collectPatternNames(pattern)) {
    current.add(name);
  }
};

const visitExpression = (
  expr: IrExpression,
  context: EmitterContext,
  classes: ReadonlyMap<string, IrClassDeclaration>,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>,
  topLevelConstBindings: ReadonlySet<string>,
  mutableModuleBindings: Set<string>,
  mutablePropertySlots: Set<string>,
  scopes: ScopeStack
): void => {
  if (
    expr.kind === "call" &&
    expr.callee.kind === "memberAccess" &&
    !expr.callee.isComputed &&
    typeof expr.callee.property === "string" &&
    nativeArrayMutationMembers.has(expr.callee.property)
  ) {
    const receiver = expr.callee.object;
    const receiverType = receiver.inferredType
      ? resolveTypeAlias(stripNullish(receiver.inferredType), context)
      : undefined;
    if (receiverType?.kind === "arrayType") {
      if (receiver.kind === "identifier") {
        if (
          topLevelConstBindings.has(receiver.name) &&
          !isShadowed(receiver.name, scopes)
        ) {
          mutableModuleBindings.add(receiver.name);
        }
      } else if (
        receiver.kind === "memberAccess" &&
        !receiver.isComputed &&
        typeof receiver.property === "string"
      ) {
        for (const owner of collectPropertyOwners(
          receiver.object.inferredType,
          receiver.property,
          context,
          classes,
          interfaces
        )) {
          mutablePropertySlots.add(propertySlotKey(owner, receiver.property));
        }
      }
    }
  }

  switch (expr.kind) {
    case "literal":
    case "identifier":
    case "this":
    case "defaultof":
    case "nameof":
    case "sizeof":
      return;
    case "array":
      for (const element of expr.elements) {
        if (!element) continue;
        if (element.kind === "spread") {
          visitExpression(
            element.expression,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
          continue;
        }
        visitExpression(
          element,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      return;
    case "object":
      for (const property of expr.properties) {
        if (property.kind === "spread") {
          visitExpression(
            property.expression,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
          continue;
        }
        if (typeof property.key !== "string") {
          visitExpression(
            property.key,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
        }
        visitExpression(
          property.value,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      return;
    case "functionExpression": {
      const names = [
        ...(expr.name ? [expr.name] : []),
        ...expr.parameters.flatMap((param) =>
          collectPatternNames(param.pattern)
        ),
      ];
      pushScope(scopes, names);
      visitStatement(
        expr.body,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      popScope(scopes);
      return;
    }
    case "arrowFunction": {
      pushScope(
        scopes,
        expr.parameters.flatMap((param) => collectPatternNames(param.pattern))
      );
      if (expr.body.kind === "blockStatement") {
        visitStatement(
          expr.body,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      } else {
        visitExpression(
          expr.body,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      popScope(scopes);
      return;
    }
    case "memberAccess":
      visitExpression(
        expr.object,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      if (expr.isComputed && typeof expr.property !== "string") {
        visitExpression(
          expr.property,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      return;
    case "call":
    case "new":
      visitExpression(
        expr.callee,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      for (const arg of expr.arguments) {
        const value = arg.kind === "spread" ? arg.expression : arg;
        visitExpression(
          value,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      return;
    case "update":
    case "unary":
    case "await":
      visitExpression(
        expr.expression,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      return;
    case "binary":
    case "logical":
      visitExpression(
        expr.left,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      visitExpression(
        expr.right,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      return;
    case "conditional":
      visitExpression(
        expr.condition,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      visitExpression(
        expr.whenTrue,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      visitExpression(
        expr.whenFalse,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      return;
    case "assignment":
      if ("kind" in expr.left) {
        if (expr.left.kind === "identifierPattern") {
          declarePattern(expr.left, scopes);
        } else if (
          expr.left.kind !== "objectPattern" &&
          expr.left.kind !== "arrayPattern"
        ) {
          visitExpression(
            expr.left,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
        }
      }
      visitExpression(
        expr.right,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      return;
    case "templateLiteral":
      for (const nested of expr.expressions) {
        visitExpression(
          nested,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      return;
    case "spread":
    case "numericNarrowing":
    case "typeAssertion":
    case "asinterface":
    case "trycast":
      visitExpression(
        expr.expression,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      return;
    case "yield":
      if (!expr.expression) return;
      visitExpression(
        expr.expression,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      return;
    case "stackalloc":
      visitExpression(
        expr.size,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      return;
  }
};

const visitVariableDeclaration = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  context: EmitterContext,
  classes: ReadonlyMap<string, IrClassDeclaration>,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>,
  topLevelConstBindings: ReadonlySet<string>,
  mutableModuleBindings: Set<string>,
  mutablePropertySlots: Set<string>,
  scopes: ScopeStack
): void => {
  for (const decl of stmt.declarations) {
    if (decl.initializer) {
      visitExpression(
        decl.initializer,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
    }
  }
  if (scopes.length === 0) return;
  for (const decl of stmt.declarations) {
    declarePattern(decl.name, scopes);
  }
};

const visitStatement = (
  stmt: IrStatement,
  context: EmitterContext,
  classes: ReadonlyMap<string, IrClassDeclaration>,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>,
  topLevelConstBindings: ReadonlySet<string>,
  mutableModuleBindings: Set<string>,
  mutablePropertySlots: Set<string>,
  scopes: ScopeStack
): void => {
  switch (stmt.kind) {
    case "variableDeclaration":
      visitVariableDeclaration(
        stmt,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      return;
    case "functionDeclaration": {
      if (scopes.length > 0) {
        scopes[scopes.length - 1]?.add(stmt.name);
      }
      pushScope(
        scopes,
        stmt.parameters.flatMap((param) => collectPatternNames(param.pattern))
      );
      visitStatement(
        stmt.body,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      popScope(scopes);
      return;
    }
    case "classDeclaration":
      if (scopes.length > 0) {
        scopes[scopes.length - 1]?.add(stmt.name);
      }
      for (const member of stmt.members) {
        if (member.kind === "propertyDeclaration" && member.initializer) {
          visitExpression(
            member.initializer,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
          continue;
        }

        if (member.kind === "methodDeclaration" && member.body) {
          pushScope(
            scopes,
            member.parameters.flatMap((param) =>
              collectPatternNames(param.pattern)
            )
          );
          visitStatement(
            member.body,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
          popScope(scopes);
          continue;
        }

        if (member.kind === "constructorDeclaration" && member.body) {
          pushScope(
            scopes,
            member.parameters.flatMap((param) =>
              collectPatternNames(param.pattern)
            )
          );
          visitStatement(
            member.body,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
          popScope(scopes);
          continue;
        }

        if (member.kind === "propertyDeclaration") {
          if (member.getterBody) {
            pushScope(scopes);
            visitStatement(
              member.getterBody,
              context,
              classes,
              interfaces,
              topLevelConstBindings,
              mutableModuleBindings,
              mutablePropertySlots,
              scopes
            );
            popScope(scopes);
          }
          if (member.setterBody) {
            pushScope(
              scopes,
              member.setterParamName ? [member.setterParamName] : ["value"]
            );
            visitStatement(
              member.setterBody,
              context,
              classes,
              interfaces,
              topLevelConstBindings,
              mutableModuleBindings,
              mutablePropertySlots,
              scopes
            );
            popScope(scopes);
          }
        }
      }
      return;
    case "interfaceDeclaration":
    case "enumDeclaration":
    case "typeAliasDeclaration":
    case "emptyStatement":
    case "breakStatement":
    case "continueStatement":
      return;
    case "expressionStatement":
      visitExpression(
        stmt.expression,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      return;
    case "returnStatement":
    case "throwStatement":
    case "generatorReturnStatement":
      if (stmt.expression) {
        visitExpression(
          stmt.expression,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      return;
    case "ifStatement":
      visitExpression(
        stmt.condition,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      visitStatement(
        stmt.thenStatement,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      if (stmt.elseStatement) {
        visitStatement(
          stmt.elseStatement,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      return;
    case "whileStatement":
      visitExpression(
        stmt.condition,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      visitStatement(
        stmt.body,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      return;
    case "forStatement":
      pushScope(scopes);
      if (stmt.initializer) {
        if (stmt.initializer.kind === "variableDeclaration") {
          visitVariableDeclaration(
            stmt.initializer,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
        } else {
          visitExpression(
            stmt.initializer,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
        }
      }
      if (stmt.condition) {
        visitExpression(
          stmt.condition,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      if (stmt.update) {
        visitExpression(
          stmt.update,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      visitStatement(
        stmt.body,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      popScope(scopes);
      return;
    case "forOfStatement":
    case "forInStatement":
      visitExpression(
        stmt.expression,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      pushScope(scopes);
      declarePattern(stmt.variable, scopes);
      visitStatement(
        stmt.body,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      popScope(scopes);
      return;
    case "switchStatement":
      visitExpression(
        stmt.expression,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      for (const caseStmt of stmt.cases) {
        if (caseStmt.test) {
          visitExpression(
            caseStmt.test,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
        }
        pushScope(scopes);
        for (const nested of caseStmt.statements) {
          visitStatement(
            nested,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
        }
        popScope(scopes);
      }
      return;
    case "tryStatement":
      visitStatement(
        stmt.tryBlock,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      if (stmt.catchClause) {
        pushScope(
          scopes,
          stmt.catchClause.parameter
            ? collectPatternNames(stmt.catchClause.parameter)
            : []
        );
        visitStatement(
          stmt.catchClause.body,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
        popScope(scopes);
      }
      if (stmt.finallyBlock) {
        visitStatement(
          stmt.finallyBlock,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      return;
    case "blockStatement":
      pushScope(scopes);
      for (const nested of stmt.statements) {
        visitStatement(
          nested,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      popScope(scopes);
      return;
    case "yieldStatement":
      if (stmt.output) {
        visitExpression(
          stmt.output,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      return;
  }
};

export const analyzeMutableStorage = (
  module: IrModule,
  context: EmitterContext
): MutableStorageAnalysis => {
  const classes = buildClassMap(module);
  const interfaces = buildInterfaceMap(module);
  const topLevelConstBindings = collectTopLevelConstBindings(module);
  const mutableModuleBindings = new Set<string>();
  const mutablePropertySlots = new Set<string>();

  for (const stmt of module.body) {
    visitStatement(
      stmt,
      context,
      classes,
      interfaces,
      topLevelConstBindings,
      mutableModuleBindings,
      mutablePropertySlots,
      []
    );
  }

  return {
    mutableModuleBindings,
    mutablePropertySlots,
  };
};

export const isMutablePropertySlot = (
  declaringTypeName: string | undefined,
  propertyName: string,
  context: EmitterContext
): boolean =>
  !!declaringTypeName &&
  (context.mutablePropertySlots?.has(
    propertySlotKey(declaringTypeName, propertyName)
  ) ??
    false);
