// Test recursive tree-like structures
// Verifies self-referential types compile and execute correctly
import { Console } from "@tsonic/dotnet/System.js";
import { List, IList } from "@tsonic/dotnet/System.Collections.Generic.js";

// Recursive tree node with self-reference
// Use IList interface to avoid tsbindgen's instance vs full type distinction
class TreeNode {
  value: number;
  children: IList<TreeNode>;

  constructor(value: number) {
    this.value = value;
    // Cast to IList to satisfy the field type
    this.children = new List<TreeNode>() as unknown as IList<TreeNode>;
  }

  addChild(value: number): TreeNode {
    const child = new TreeNode(value);
    this.children.add(child);
    return child;
  }
}

// Recursive function to traverse tree and print
function printTree(node: TreeNode, prefix: string): void {
  Console.writeLine(prefix + node.value);

  for (let i = 0; i < node.children.count; i++) {
    printTree(node.children[i], prefix + "  ");
  }
}

// Recursive function to sum all values
function sumTree(node: TreeNode): number {
  let sum = node.value;
  for (let i = 0; i < node.children.count; i++) {
    sum = sum + sumTree(node.children[i]);
  }
  return sum;
}

export function main(): void {
  // Build a tree:
  //       1
  //      /|\
  //     2 3 4
  //    /|   |
  //   5 6   7

  const root = new TreeNode(1.0);
  const child2 = root.addChild(2.0);
  root.addChild(3.0);
  const child4 = root.addChild(4.0);

  child2.addChild(5.0);
  child2.addChild(6.0);
  child4.addChild(7.0);

  Console.writeLine("Tree structure:");
  printTree(root, "");

  Console.writeLine("Sum of all values: " + sumTree(root));
}
