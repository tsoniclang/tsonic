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

export type MutableStorageAnalysis = {
  readonly mutableModuleBindings: ReadonlySet<string>;
  readonly mutablePropertySlots: ReadonlySet<string>;
};

export type ScopeStack = Set<string>[];

export type VisitStatementFn = (
  stmt: IrStatement,
  context: EmitterContext,
  classes: ReadonlyMap<string, IrClassDeclaration>,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>,
  topLevelConstBindings: ReadonlySet<string>,
  mutableModuleBindings: Set<string>,
  mutablePropertySlots: Set<string>,
  scopes: ScopeStack
) => void;

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

export const propertySlotKey = (
  typeName: string,
  propertyName: string
): string => `${typeName}::${propertyName}`;

export const collectPatternNames = (pattern: IrPattern): readonly string[] => {
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

export const collectTopLevelConstBindings = (
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

export const buildClassMap = (
  module: IrModule
): ReadonlyMap<string, IrClassDeclaration> =>
  new Map(
    module.body
      .filter(
        (stmt): stmt is IrClassDeclaration => stmt.kind === "classDeclaration"
      )
      .map((stmt) => [stmt.name, stmt])
  );

export const buildInterfaceMap = (
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

const isShadowed = (name: string, scopes: ScopeStack): boolean => {
  for (let i = scopes.length - 1; i >= 0; i -= 1) {
    if (scopes[i]?.has(name)) return true;
  }
  return false;
};

export const pushScope = (
  scopes: ScopeStack,
  names: readonly string[] = []
): void => {
  scopes.push(new Set<string>(names));
};

export const popScope = (scopes: ScopeStack): void => {
  scopes.pop();
};

export const declarePattern = (
  pattern: IrPattern,
  scopes: ScopeStack
): void => {
  const current = scopes[scopes.length - 1];
  if (!current) return;
  for (const name of collectPatternNames(pattern)) {
    current.add(name);
  }
};

const checkArrayMutationOnCall = (
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
    expr.kind !== "call" ||
    expr.callee.kind !== "memberAccess" ||
    expr.callee.isComputed ||
    typeof expr.callee.property !== "string" ||
    !nativeArrayMutationMembers.has(expr.callee.property)
  ) {
    return;
  }

  const receiver = expr.callee.object;
  const receiverType = receiver.inferredType
    ? resolveTypeAlias(stripNullish(receiver.inferredType), context)
    : undefined;
  if (receiverType?.kind !== "arrayType") return;

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
};

export const visitExpression = (
  expr: IrExpression,
  context: EmitterContext,
  classes: ReadonlyMap<string, IrClassDeclaration>,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>,
  topLevelConstBindings: ReadonlySet<string>,
  mutableModuleBindings: Set<string>,
  mutablePropertySlots: Set<string>,
  scopes: ScopeStack,
  visitStatementFn: VisitStatementFn
): void => {
  checkArrayMutationOnCall(
    expr,
    context,
    classes,
    interfaces,
    topLevelConstBindings,
    mutableModuleBindings,
    mutablePropertySlots,
    scopes
  );

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
            scopes,
            visitStatementFn
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
          scopes,
          visitStatementFn
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
            scopes,
            visitStatementFn
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
            scopes,
            visitStatementFn
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
          scopes,
          visitStatementFn
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
      visitStatementFn(
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
        visitStatementFn(
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
          scopes,
          visitStatementFn
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
        scopes,
        visitStatementFn
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
          scopes,
          visitStatementFn
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
        scopes,
        visitStatementFn
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
          scopes,
          visitStatementFn
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
        scopes,
        visitStatementFn
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
        scopes,
        visitStatementFn
      );
      visitExpression(
        expr.right,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
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
        scopes,
        visitStatementFn
      );
      visitExpression(
        expr.whenTrue,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      visitExpression(
        expr.whenFalse,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
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
            scopes,
            visitStatementFn
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
        scopes,
        visitStatementFn
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
          scopes,
          visitStatementFn
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
        scopes,
        visitStatementFn
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
        scopes,
        visitStatementFn
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
        scopes,
        visitStatementFn
      );
      return;
  }
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
