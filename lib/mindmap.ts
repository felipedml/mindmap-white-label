type TreeNode = { text: string; children: TreeNode[] };

function parseOutline(outline: string): TreeNode {
  const lines = outline
    .split("\n")
    .map((l) => l.replace(/\t/g, "  "))
    .filter((l) => l.trim().length > 0);

  const rootText = lines[0].replace(/^-+\s*/, "").trim();
  const root: TreeNode = { text: rootText, children: [] };

  const stack: { indent: number; node: TreeNode }[] = [{ indent: 0, node: root }];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const indent = raw.match(/^ */)?.[0].length ?? 0;
    const text = raw.replace(/^\s*-\s*/, "").trim();

    const newNode: TreeNode = { text, children: [] };

    while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1]?.node ?? root;
    parent.children.push(newNode);
    stack.push({ indent, node: newNode });
  }

  return root;
}

function layoutTree(root: TreeNode) {
  // layout simples L->R
  let leafY = 0;
  const positions = new Map<TreeNode, { x: number; y: number; depth: number }>();

  const dx = 320;
  const dy = 160;

  function dfs(node: TreeNode, depth: number): number {
    if (node.children.length === 0) {
      const y = leafY * dy;
      leafY += 1;
      positions.set(node, { x: depth * dx, y, depth });
      return y;
    }
    const childYs = node.children.map((ch) => dfs(ch, depth + 1));
    const y = Math.round(childYs.reduce((a, b) => a + b, 0) / childYs.length);
    positions.set(node, { x: depth * dx, y, depth });
    return y;
  }

  dfs(root, 0);
  return positions;
}

export function outlineToSkeletonElements(outline: string) {
  const tree = parseOutline(outline);
  const pos = layoutTree(tree);

  const nodes: { node: TreeNode; id: string }[] = [];
  let c = 0;
  function collect(n: TreeNode) {
    nodes.push({ node: n, id: `node_${c++}` });
    n.children.forEach(collect);
  }
  collect(tree);

  const idByNode = new Map<TreeNode, string>(nodes.map((n) => [n.node, n.id]));

  const elements: any[] = [];

  for (const { node, id } of nodes) {
    const p = pos.get(node)!;
    elements.push({
      id,
      type: "rectangle",
      x: p.x,
      y: p.y,
      width: 260,
      height: 90,
      label: {
        text: node.text,
        fontSize: 18,
        textAlign: "center",
        verticalAlign: "middle",
      },
    });
  }

  for (const { node } of nodes) {
    const fromId = idByNode.get(node)!;
    for (const child of node.children) {
      const toId = idByNode.get(child)!;
      const fp = pos.get(node)!;

      elements.push({
        type: "arrow",
        x: fp.x + 260,
        y: fp.y + 45,
        start: { id: fromId },
        end: { id: toId },
      });
    }
  }

  return elements;
}
