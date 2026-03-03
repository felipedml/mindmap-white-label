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
  // Layout L->R com centralização vertical
  let leafY = 0;

  // Ajuste fino de “cara de apresentação”
  const dx = 380; // distância horizontal entre níveis
  const dy = 150; // distância vertical entre folhas

  const positions = new Map<TreeNode, { x: number; y: number; depth: number }>();

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

  // Centralizar em Y e dar margem superior
  const ys = Array.from(positions.values()).map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const midY = (minY + maxY) / 2;

  const topMargin = 120;
  const shiftY = -midY + topMargin;

  for (const [node, p] of positions.entries()) {
    positions.set(node, { ...p, y: p.y + shiftY });
  }

  return positions;
}

function styleForDepth(depth: number) {
  // Paleta “acadêmica/profissional” por níveis (pastel + stroke forte)
  const palette = [
    { bg: "#DBEAFE", stroke: "#1D4ED8" }, // azul
    { bg: "#E0E7FF", stroke: "#4338CA" }, // índigo
    { bg: "#D1FAE5", stroke: "#047857" }, // verde
    { bg: "#FEF3C7", stroke: "#B45309" }, // âmbar
    { bg: "#FCE7F3", stroke: "#BE185D" }, // rosa
  ];
  return palette[Math.min(depth, palette.length - 1)];
}

function dimsForDepth(depth: number) {
  if (depth === 0) {
    return { w: 380, h: 130, fontSize: 24 };
  }
  if (depth === 1) {
    return { w: 320, h: 104, fontSize: 20 };
  }
  return { w: 300, h: 96, fontSize: 18 };
}

export function outlineToSkeletonElements(outline: string) {
  const tree = parseOutline(outline);
  const pos = layoutTree(tree);

  const nodes: { node: TreeNode; id: string; depth: number }[] = [];
  let c = 0;

  function collect(n: TreeNode, depth: number) {
    nodes.push({ node: n, id: `node_${c++}`, depth });
    n.children.forEach((ch) => collect(ch, depth + 1));
  }
  collect(tree, 0);

  const idByNode = new Map<TreeNode, string>(nodes.map((n) => [n.node, n.id]));
  const depthById = new Map<string, number>(nodes.map((n) => [n.id, n.depth]));

  const elements: any[] = [];

  // Nós (retângulos com label)
  for (const { node, id, depth } of nodes) {
    const p = pos.get(node)!;
    const { w, h, fontSize } = dimsForDepth(depth);
    const colors = styleForDepth(depth);

    elements.push({
      id,
      type: "rectangle",
      x: p.x,
      y: p.y - h / 2,
      width: w,
      height: h,

      // Estilo “clean”
      roughness: 0,
      strokeWidth: 2,
      strokeStyle: "solid",
      fillStyle: "solid",
      opacity: 100,
      roundness: { type: 3 },

      strokeColor: colors.stroke,
      backgroundColor: colors.bg,

      label: {
        text: node.text,
        fontSize,
        fontFamily: 2,
        textAlign: "center",
        verticalAlign: "middle",
      },
    });
  }

  // Setas (arestas)
  for (const { node, id } of nodes) {
    const fromId = id;
    const fromDepth = depthById.get(fromId) ?? 0;
    const fromDim = dimsForDepth(fromDepth);
    const fromColors = styleForDepth(fromDepth);

    const fromPos = pos.get(node)!;
    const fromX = fromPos.x;
    const fromY = fromPos.y - fromDim.h / 2;

    for (const child of node.children) {
      const toId = idByNode.get(child)!;

      elements.push({
        type: "arrow",
        x: fromX + fromDim.w,
        y: fromY + fromDim.h / 2,
        start: { id: fromId },
        end: { id: toId },

        // Estilo “clean”
        roughness: 0,
        strokeWidth: 2,
        strokeStyle: "solid",
        opacity: 100,
        strokeColor: fromColors.stroke,
      });
    }
  }

  return elements;
}
