import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import {
  getTstsIdentifierText,
  getTstsMemberNodes,
  getTstsNodeNameText,
  getTstsNodeText,
  getTstsPropertyNameText,
  TstsSyntax,
} from "@tsonic/tsts";

export const SOURCE_BINDING_ALIAS_MARKER_PREFIX =
  "__tsonic_binding_alias_";

export const SOURCE_BINDING_TYPE_MARKER_PREFIX = "__tsonic_type_";

export const isSourceBindingMarkerName = (name: string): boolean =>
  name.startsWith(SOURCE_BINDING_TYPE_MARKER_PREFIX) ||
  name.startsWith(SOURCE_BINDING_ALIAS_MARKER_PREFIX);

const getMemberNameText = (member: TstsNode): string | undefined => {
  const name = TstsSyntax.Node_Name(member);
  return (
    getTstsPropertyNameText(member) ??
    getTstsNodeNameText(member) ??
    (name ? getTstsNodeText(name) : undefined)
  );
};

const getDirectSourceBindingAliasFromDeclaration = (
  decl: TstsNode
): string | undefined => {
  for (const member of getTstsMemberNodes(decl)) {
    if (!member) continue;
    const name = getMemberNameText(member);
    if (!name || !name.startsWith(SOURCE_BINDING_ALIAS_MARKER_PREFIX)) {
      continue;
    }
    return name.slice(SOURCE_BINDING_ALIAS_MARKER_PREFIX.length) || undefined;
  }

  return undefined;
};

const containingSourceFileOf = (
  node: TstsNode
): TstsSourceFile | undefined => {
  let current: TstsNode | undefined = node;
  while (current) {
    if (TstsSyntax.IsSourceFile(current)) {
      return current as TstsSourceFile;
    }
    current = current.Parent;
  }
  return undefined;
};

const typeAliasReferenceTargetName = (decl: TstsNode): string | undefined => {
  const aliasType = TstsSyntax.AsTypeAliasDeclaration(decl)?.Type;
  if (!aliasType || !TstsSyntax.IsTypeReferenceNode(aliasType)) {
    return undefined;
  }

  const typeName = TstsSyntax.AsTypeReferenceNode(aliasType)?.TypeName;
  return getTstsIdentifierText(typeName);
};

const findTopLevelTypeDeclaration = (
  sourceFile: TstsSourceFile,
  name: string
): TstsNode | undefined => {
  let found: TstsNode | undefined;
  TstsSyntax.SourceFile_ForEachChild(sourceFile, (child) => {
    if (found || !child) {
      return false;
    }

    if (
      (TstsSyntax.IsInterfaceDeclaration(child) ||
        TstsSyntax.IsClassDeclaration(child) ||
        TstsSyntax.IsTypeAliasDeclaration(child)) &&
      getTstsNodeNameText(child) === name
    ) {
      found = child;
    }
    return false;
  });
  return found;
};

const getSourceBindingAliasFromDeclarationWorker = (
  decl: TstsNode,
  seenNames: Set<string>
): string | undefined => {
  const direct = getDirectSourceBindingAliasFromDeclaration(decl);
  if (direct) {
    return direct;
  }

  if (!TstsSyntax.IsTypeAliasDeclaration(decl)) {
    return undefined;
  }

  const targetName = typeAliasReferenceTargetName(decl);
  if (!targetName || seenNames.has(targetName)) {
    return undefined;
  }
  seenNames.add(targetName);

  const sourceFile = containingSourceFileOf(decl);
  const targetDecl = sourceFile
    ? findTopLevelTypeDeclaration(sourceFile, targetName)
    : undefined;
  return targetDecl
    ? getSourceBindingAliasFromDeclarationWorker(targetDecl, seenNames)
    : undefined;
};

export const getSourceBindingAliasFromDeclaration = (
  decl: TstsNode
): string | undefined =>
  getSourceBindingAliasFromDeclarationWorker(decl, new Set());
