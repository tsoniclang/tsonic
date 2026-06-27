import type {
  AstReader,
  Node,
} from "@tsonic/tsts";

export function asAnalysisNode(value: unknown): Node | undefined {
  return typeof value === "object" && value !== null && "Kind" in value
    ? value as Node
    : undefined;
}

export function getAnalysisNodeField(node: Node | undefined, field: string): unknown {
  return node === undefined ? undefined : Object.getOwnPropertyDescriptor(node, field)?.value;
}

export function getAnalysisNodeList(value: unknown): readonly Node[] {
  const nodes = (value as { readonly Nodes?: readonly unknown[] } | undefined)?.Nodes;
  return nodes === undefined
    ? []
    : nodes.map(asAnalysisNode).filter((node): node is Node => node !== undefined);
}

export function visitAnalysisNodes(
  ast: AstReader,
  node: Node,
  visitor: (node: Node) => void,
  seen: WeakSet<object> = new WeakSet(),
): void {
  if (seen.has(node)) {
    return;
  }
  seen.add(node);
  visitor(node);
  for (const child of getAnalysisChildNodes(ast, node)) {
    if (child !== undefined) {
      visitAnalysisNodes(ast, child, visitor, seen);
    }
  }
}

function getAnalysisChildNodes(ast: AstReader, node: Node): readonly (Node | undefined)[] {
  return [
    ...safeNodeList(() => ast.children(node)),
    ...safeNodeList(() => ast.typeArguments(node)),
    ...safeNodeList(() => ast.typeParameters(node)),
    ...safeNodeList(() => ast.parameters(node)),
    ...safeNodeList(() => ast.members(node)),
    ...safeNodeList(() => ast.elements(node)),
    ...safeNodeList(() => ast.properties(node)),
    ...safeNodeList(() => ast.arguments(node)),
    ...getStructuralChildNodes(node),
  ];
}

function getStructuralChildNodes(node: Node): readonly Node[] {
  const children: Node[] = [];
  for (const field of listFields) {
    children.push(...getAnalysisNodeList(getAnalysisNodeField(node, field)));
  }
  for (const field of nodeFields) {
    const child = asAnalysisNode(getAnalysisNodeField(node, field));
    if (child !== undefined) {
      children.push(child);
    }
  }
  return children;
}

function safeNodeList(read: () => readonly (Node | undefined)[]): readonly (Node | undefined)[] {
  try {
    return read();
  } catch {
    return [];
  }
}

const listFields = [
  "Statements",
  "Members",
  "Parameters",
  "TypeParameters",
  "TypeArguments",
  "Types",
  "Arguments",
  "Elements",
  "Properties",
  "Declarations",
] as const;

const nodeFields = [
  "name",
  "Body",
  "Type",
  "ElementType",
  "Constraint",
  "Expression",
  "Initializer",
  "Left",
  "Right",
  "ThenStatement",
  "ElseStatement",
  "Statement",
  "DeclarationList",
  "ImportClause",
  "NamedBindings",
  "ModuleSpecifier",
  "TypeName",
] as const;
