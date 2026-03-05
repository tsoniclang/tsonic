import type { BindingRegistry } from "../program/bindings.js";

export type NodeModuleAliasResolution = {
  readonly canonicalSpecifier: "@tsonic/nodejs/index.js";
  readonly moduleName: string;
};

const NODE_CANONICAL_SPECIFIER = "@tsonic/nodejs/index.js" as const;
const NODE_MODULE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const parseNodeModuleName = (moduleSpecifier: string): string | undefined => {
  if (moduleSpecifier.startsWith("node:")) {
    const raw = moduleSpecifier.slice("node:".length);
    return NODE_MODULE_NAME_RE.test(raw) ? raw : undefined;
  }
  return NODE_MODULE_NAME_RE.test(moduleSpecifier)
    ? moduleSpecifier
    : undefined;
};

export const resolveNodeModuleAlias = (
  moduleSpecifier: string,
  bindings: BindingRegistry
): NodeModuleAliasResolution | undefined => {
  const moduleName = parseNodeModuleName(moduleSpecifier);
  if (!moduleName) return undefined;

  const clrTypeName = `nodejs.${moduleName}`;
  if (!bindings.hasClrTypeName(clrTypeName)) return undefined;

  return {
    canonicalSpecifier: NODE_CANONICAL_SPECIFIER,
    moduleName,
  };
};
