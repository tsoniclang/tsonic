export function stronglyConnectedComponents(nodes, edges) {
  const nodeList = [...nodes];
  const adjacency = new Map(nodeList.map((node) => [node, []]));
  for (const edge of edges) {
    if (edge.target !== undefined && adjacency.has(edge.target)) {
      adjacency.get(edge.source)?.push(edge.target);
    }
  }
  for (const targets of adjacency.values()) {
    targets.sort();
  }

  let nextIndex = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  const visit = (node) => {
    indexes.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of adjacency.get(node) ?? []) {
      if (!indexes.has(target)) {
        visit(target);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indexes.get(target)));
      }
    }

    if (lowLinks.get(node) !== indexes.get(node)) {
      return;
    }
    const component = [];
    while (stack.length > 0) {
      const member = stack.pop();
      onStack.delete(member);
      component.push(member);
      if (member === node) {
        break;
      }
    }
    components.push(Object.freeze(component.sort()));
  };

  for (const node of nodeList.sort()) {
    if (!indexes.has(node)) {
      visit(node);
    }
  }
  return Object.freeze(
    components.sort((left, right) => left[0].localeCompare(right[0])),
  );
}
