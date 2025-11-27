// Test recursive tree-like structures
// Verifies self-referential types compile and execute correctly
import { Console } from "System";
import { List } from "System.Collections.Generic";

// Recursive tree node with self-reference
class TreeNode {
  value: number;
  children: List<TreeNode>;

  constructor(value: number) {
    this.value = value;
    this.children = new List<TreeNode>();
  }

  addChild(value: number): TreeNode {
    const child = new TreeNode(value);
    this.children.Add(child);
    return child;
  }
}

// Recursive function to traverse tree and print
function printTree(node: TreeNode, prefix: string): void {
  Console.WriteLine(prefix + node.value);

  for (let i = 0; i < node.children.Count; i++) {
    printTree(node.children[i], prefix + "  ");
  }
}

// Recursive function to sum all values
function sumTree(node: TreeNode): number {
  let sum = node.value;
  for (let i = 0; i < node.children.Count; i++) {
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

  const root = new TreeNode(1);
  const child2 = root.addChild(2);
  root.addChild(3);
  const child4 = root.addChild(4);

  child2.addChild(5);
  child2.addChild(6);
  child4.addChild(7);

  Console.WriteLine("Tree structure:");
  printTree(root, "");

  Console.WriteLine("Sum of all values: " + sumTree(root));
}
