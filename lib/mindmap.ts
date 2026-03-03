type TreeNode = { text: string; children: TreeNode[] };

function parseOutline(outline: string): TreeNode {
  const lines = outline
    .split("\n")
    .map((l) => l.replace(/\t/g, "  "))
    .filter((l) => l.trim().length > 0);

  const rootText = (lines[0] || "Tema").replace(/^-+\s*/, "").trim() || "Tema";
  const root: TreeNode = { text: rootText, children: [] };

  const stack: { indent: number; node: TreeNode }[] = [{ indent: 0, node: root }];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const indent = raw.match(/^ */)?.[0].length ?? 0;
    const text = raw.replace(/^\s*-\s*/, "").trim();
    if (!text) continue;

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

function styleForDepth(depth: number) {
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
  if (depth === 0) return { w: 420, h: 150, fontSize: 24 };
  if (depth === 1) return { w: 340, h: 112, fontSize: 20 };
  return { w: 310, h: 96, fontSize: 18 };
}

function countLeaves(root: TreeNode) {
  const leaves = new Map<TreeNode, number>();

  function dfs(n: TreeNode): number {
    if (!n.children.length) {
      leaves.set(n, 1);
      return 1;
    }
    let sum = 0;
    for (const ch of n.children) sum += dfs(ch);
    leaves.set(n, Math.max(1, sum));
    return Math.max(1, sum);
  }

  dfs(root);
  return leaves;
}

function collectNodes(root: TreeNode) {
  const nodes: { node: TreeNode; id: string; depth: number; parent?: string }[] = [];
  let c = 0;

  function walk(n: TreeNode, depth: number, parent?: string) {
    const id = `node_${c++}`;
    nodes.push({ node: n, id, depth, parent });
    for (const ch of n.children) walk(ch, depth + 1, id);
  }

  walk(root, 0, undefined);
  return nodes;
}

function radialLayout(root: TreeNode) {
  // Parâmetros de “elegância”
  const baseR = 260;     // raio do 1º nível
  const stepR = 260;     // incremento por profundidade
  const margin = 160;    // margem superior/esquerda

  const leaves = countLeaves(root);
  const angles = new Map<TreeNode, { start: number; end: number; mid: number }>();
  const centers = new Map<TreeNode, { cx: number; cy: number; depth: number }>();

  // Root ocupa 360°
  const startA = -Math.PI;
  const endA = Math.PI;

  function assignAngles(n: TreeNode, a0: number, a1: number) {
    const mid = (a0 + a1) / 2;
    angles.set(n, { start: a0, end: a1, mid });

    if (!n.children.length) return;

    const total = n.children.reduce((acc, ch) => acc + (leaves.get(ch) ?? 1), 0) || 1;
    let cur = a0;

    for (const ch of n.children) {
      const w = (leaves.get(ch) ?? 1) / total;
      const span = (a1 - a0) * w;

      // pequena folga angular para evitar “amontoar”
      const pad = Math.min(0.06, span * 0.12);
      const c0 = cur + pad;
      const c1 = cur + span - pad;

      assignAngles(ch, c0, c1);
      cur += span;
    }
  }

  assignAngles(root, startA, endA);

  // Posiciona nós em coordenadas polares (raio por profundidade)
  const rootCx = 700;
  const rootCy = 520;

  function place(n: TreeNode, depth: number) {
    if (n === root) {
      centers.set(n, { cx: rootCx, cy: rootCy, depth });
    } else {
      const a = angles.get(n)?.mid ?? 0;
      const r = baseR + (depth - 1) * stepR;
      const cx = rootCx + r * Math.cos(a);
      const cy = rootCy + r * Math.sin(a);
      centers.set(n, { cx, cy, depth });
    }

    for (const ch of n.children) place(ch, depth + 1);
  }

  place(root, 0);

  // Normaliza para evitar coordenadas negativas (shift por minX/minY)
  const rects = Array.from(centers.entries()).map(([node, p]) => {
    const { w, h } = dimsForDepth(p.depth);
    return { x: p.cx - w / 2, y: p.cy - h / 2, w, h };
  });

  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));

  const shiftX = margin - minX;
  const shiftY = margin - minY;

  for (const [node, p] of centers.entries()) {
    centers.set(node, { ...p, cx: p.cx + shiftX, cy: p.cy + shiftY });
  }

  return centers;
}

export function blankSkeletonElements(title: string) {
  const t = (title || "Tema").trim() || "Tema";
  const colors = styleForDepth(0);

  return [
    {
      id: "node_0",
      type: "rectangle",
      x: 220,
      y: 200,
      width: 420,
      height: 150,
      roughness: 0,
      strokeWidth: 2,
      strokeStyle: "solid",
      fillStyle: "solid",
      opacity: 100,
      roundness: { type: 3 },
      strokeColor: colors.stroke,
      backgroundColor: colors.bg,
      label: {
        text: t,
        fontSize: 24,
        fontFamily: 2,
        textAlign: "center",
        verticalAlign: "middle",
      },
    },
  ];
}

export function outlineToSkeletonElements(outline: string) {
  const tree = parseOutline(outline);
  const nodes = collectNodes(tree);
  const centers = radialLayout(tree);

  const nodeById = new Map<string, { node: TreeNode; depth: number; parent?: string }>();
  const idByNode = new Map<TreeNode, string>();

  for (const n of nodes) {
    nodeById.set(n.id, { node: n.node, depth: n.depth, parent: n.parent });
    idByNode.set(n.node, n.id);
  }

  const elements: any[] = [];

  // Nós
  for (const { node, id, depth } of nodes) {
    const c = centers.get(node) || { cx: 200, cy: 200, depth };
    const { w, h, fontSize } = dimsForDepth(depth);
    const colors = styleForDepth(depth);

    elements.push({
      id,
      type: "rectangle",
      x: c.cx - w / 2,
      y: c.cy - h / 2,
      width: w,
      height: h,

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

  // Setas
  for (const { id, parent, depth } of nodes) {
    if (!parent) continue;

    const colors = styleForDepth(Math.max(0, depth - 1));

    elements.push({
      type: "arrow",
      x: 0,
      y: 0,
      start: { id: parent },
      end: { id },
      roughness: 0,
      strokeWidth: 2,
      strokeStyle: "solid",
      opacity: 100,
      strokeColor: colors.stroke,
    });
  }

  return elements;
}
