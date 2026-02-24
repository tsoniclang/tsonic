/**
 * Deterministic printer for C# backend AST.
 */

import type {
  CSharpCompilationUnitAst,
  CSharpNamespaceMemberAst,
} from "./types.js";

const indentText = (text: string, level: number): string => {
  if (level <= 0 || !text) return text;
  const prefix = "    ".repeat(level);
  return text
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
};

const printNamespaceMember = (member: CSharpNamespaceMemberAst): string => {
  switch (member.kind) {
    case "blankLine":
      return "";
    case "rawMember":
      return indentText(member.text, member.baseIndent);
  }
};

export const printCompilationUnitAst = (
  unit: CSharpCompilationUnitAst
): string => {
  const headerLines = unit.headerText ? [unit.headerText] : [];
  const usingLines =
    unit.usingDirectives.length > 0
      ? [
          ...unit.usingDirectives
            .map((d) => d.namespace)
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map((namespace) => `using ${namespace};`),
          "",
        ]
      : [];
  const namespaceLines = [
    `namespace ${unit.namespace.name}`,
    "{",
    ...unit.namespace.members.map(printNamespaceMember),
    "}",
  ];

  return [...headerLines, ...usingLines, ...namespaceLines].join("\n");
};
