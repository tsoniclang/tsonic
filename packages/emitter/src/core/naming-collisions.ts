import type { Diagnostic, IrModule, IrStatement } from "@tsonic/frontend";
import {
  applyNamingPolicy,
  resolveNamingPolicy,
  type NamingPolicyBucket,
  type NamingPolicyConfig,
} from "@tsonic/frontend";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";

type CollisionItem = {
  readonly original: string;
  readonly csharp: string;
  readonly kind: string;
};

const getCSharpIdentifier = (
  original: string,
  bucket: NamingPolicyBucket,
  namingPolicy: NamingPolicyConfig | undefined
): string => {
  const policy = resolveNamingPolicy(namingPolicy, bucket);
  return escapeCSharpIdentifier(applyNamingPolicy(original, policy));
};

const addCollisionDiagnostics = (
  diagnostics: Diagnostic[],
  items: readonly CollisionItem[],
  scope: string
): void => {
  const byCsharp = new Map<string, CollisionItem[]>();
  for (const item of items) {
    const existing = byCsharp.get(item.csharp) ?? [];
    byCsharp.set(item.csharp, [...existing, item]);
  }

  for (const [csharp, group] of byCsharp) {
    const originalNames = [...new Set(group.map((g) => g.original))];
    if (originalNames.length <= 1) continue;

    const details = [...group]
      .sort((a, b) =>
        a.original === b.original
          ? a.kind.localeCompare(b.kind)
          : a.original.localeCompare(b.original)
      )
      .map((g) => `${g.original} (${g.kind})`)
      .join(", ");

    diagnostics.push({
      code: "TSN3003",
      severity: "error",
      message:
        `Naming policy collision in ${scope}: ` +
        `${details} all map to C# identifier '${csharp}'. ` +
        `Rename one declaration or set namingPolicy.all = \"none\" to preserve source casing.`,
    });
  }
};

const collectInlineTypeNames = (
  stmt: Extract<IrStatement, { kind: "interfaceDeclaration" }>,
  namingPolicy: NamingPolicyConfig | undefined
): readonly CollisionItem[] => {
  const items: CollisionItem[] = [];

  for (const member of stmt.members) {
    if (member.kind !== "propertySignature") continue;
    if (member.type?.kind !== "objectType") continue;

    items.push({
      original: `${stmt.name}.${member.name}`,
      csharp: getCSharpIdentifier(member.name, "classes", namingPolicy),
      kind: "inlineType",
    });
  }

  return items;
};

const collectContainerNameItem = (
  module: IrModule
): CollisionItem | undefined => {
  const hasTypeCollision = module.body.some(
    (s) =>
      (s.kind === "classDeclaration" || s.kind === "interfaceDeclaration") &&
      s.name === module.className
  );

  // The container is only emitted when there are static members.
  const hasStaticMembers = module.body.some(
    (s) => s.kind !== "classDeclaration" && s.kind !== "interfaceDeclaration"
  );
  if (!hasStaticMembers) return undefined;

  const base = escapeCSharpIdentifier(module.className);
  const csharp = hasTypeCollision ? `${base}__Module` : base;

  return {
    original: module.className,
    csharp,
    kind: "moduleContainer",
  };
};

export const validateNamingPolicyCollisions = (
  modules: readonly IrModule[],
  namingPolicy: NamingPolicyConfig | undefined
): readonly Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  for (const module of modules) {
    const fileLabel = module.filePath;

    // ---------------------------------------------------------------------
    // Module-level values (static container fields/methods)
    // ---------------------------------------------------------------------
    const moduleValueItems: CollisionItem[] = [];
    for (const stmt of module.body) {
      if (stmt.kind === "functionDeclaration") {
        moduleValueItems.push({
          original: stmt.name,
          csharp: getCSharpIdentifier(stmt.name, "methods", namingPolicy),
          kind: "function",
        });
        continue;
      }

      if (stmt.kind === "variableDeclaration") {
        for (const decl of stmt.declarations) {
          if (decl.name.kind !== "identifierPattern") continue;
          moduleValueItems.push({
            original: decl.name.name,
            csharp: getCSharpIdentifier(decl.name.name, "fields", namingPolicy),
            kind: "variable",
          });
        }
      }
    }

    addCollisionDiagnostics(
      diagnostics,
      moduleValueItems,
      `module values (${fileLabel})`
    );

    // ---------------------------------------------------------------------
    // Namespace-level types (classes/interfaces) + generated inline types + container name
    // ---------------------------------------------------------------------
    const namespaceTypeItems: CollisionItem[] = [];

    for (const stmt of module.body) {
      if (stmt.kind === "classDeclaration") {
        namespaceTypeItems.push({
          original: stmt.name,
          csharp: escapeCSharpIdentifier(stmt.name),
          kind: "class",
        });
        continue;
      }

      if (stmt.kind === "interfaceDeclaration") {
        namespaceTypeItems.push({
          original: stmt.name,
          csharp: escapeCSharpIdentifier(stmt.name),
          kind: "interface",
        });
        namespaceTypeItems.push(...collectInlineTypeNames(stmt, namingPolicy));
      }
    }

    const container = collectContainerNameItem(module);
    if (container) {
      namespaceTypeItems.push(container);
    }

    addCollisionDiagnostics(
      diagnostics,
      namespaceTypeItems,
      `namespace types (${fileLabel})`
    );

    // ---------------------------------------------------------------------
    // Type member collisions (per declaration)
    // ---------------------------------------------------------------------
    for (const stmt of module.body) {
      if (stmt.kind === "classDeclaration") {
        const items: CollisionItem[] = [];
        for (const m of stmt.members) {
          if (m.kind === "methodDeclaration") {
            items.push({
              original: m.name,
              csharp: getCSharpIdentifier(m.name, "methods", namingPolicy),
              kind: "method",
            });
            continue;
          }
          if (m.kind === "propertyDeclaration") {
            const hasAccessors = !!(m.getterBody || m.setterBody);
            const bucket: NamingPolicyBucket = hasAccessors
              ? "properties"
              : "fields";
            items.push({
              original: m.name,
              csharp: getCSharpIdentifier(m.name, bucket, namingPolicy),
              kind: hasAccessors ? "property" : "field",
            });
          }
        }
        addCollisionDiagnostics(
          diagnostics,
          items,
          `class ${stmt.name} members (${fileLabel})`
        );
        continue;
      }

      if (stmt.kind === "interfaceDeclaration") {
        const items: CollisionItem[] = [];
        for (const m of stmt.members) {
          if (m.kind === "methodSignature") {
            items.push({
              original: m.name,
              csharp: getCSharpIdentifier(m.name, "methods", namingPolicy),
              kind: "method",
            });
            continue;
          }
          // propertySignature
          items.push({
            original: m.name,
            csharp: getCSharpIdentifier(m.name, "properties", namingPolicy),
            kind: "property",
          });
        }
        addCollisionDiagnostics(
          diagnostics,
          items,
          `interface ${stmt.name} members (${fileLabel})`
        );
        continue;
      }

      if (stmt.kind === "enumDeclaration") {
        const items: CollisionItem[] = stmt.members.map((m) => ({
          original: m.name,
          csharp: getCSharpIdentifier(m.name, "enumMembers", namingPolicy),
          kind: "enumMember",
        }));
        addCollisionDiagnostics(
          diagnostics,
          items,
          `enum ${stmt.name} members (${fileLabel})`
        );
        continue;
      }

      if (stmt.kind === "typeAliasDeclaration" && stmt.type.kind === "objectType") {
        const items: CollisionItem[] = stmt.type.members.map((m) => ({
          original: m.name,
          csharp: getCSharpIdentifier(m.name, "properties", namingPolicy),
          kind: m.kind === "methodSignature" ? "method" : "property",
        }));
        addCollisionDiagnostics(
          diagnostics,
          items,
          `type ${stmt.name} members (${fileLabel})`
        );
      }
    }
  }

  return diagnostics;
};

