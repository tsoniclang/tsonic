// Recursive types should compile without hanging
// Tests the cycle guard in structural member extraction

type TreeNode = {
  child?: TreeNode;
  value: number;
};

// Simple leaf node - no deep nesting
const leaf: TreeNode = { value: 42.0 };

export function main(): number {
  return leaf.value;
}
