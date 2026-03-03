type TreeNode = { text: string; children: TreeNode[] };

function parseOutline(outline: string): TreeNode {
  const lines = outline
    .split("\n")
    .map((l) => l.replace(/\t/g, "  "))
    .filter((l) => l.trim().length > 0);

  const rootText = (lines[0] || "Tema").replace(/^-+\s*/, "").trim();
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

function isRightPanelLabel(label: string) {
  const t = (label || "").toLowerCase();
  return (
    t.includes("refer") ||
    t.includes("fonte") ||
    t.includes("bibliograf") ||
    t.includes("evid") ||
    t.includes("dados") ||
    t.includes("leituras")
  );
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
  if (depth === 0) return { w: 400, h: 140, fontSize: 24 };
  if (depth === 1) return { w: 330, h: 108, fontSize: 20 };
  return { w: 310, h: 96, fontSize: 18 };
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

function layoutClassic(root: TreeNode) {
  // Layout L->R para a árvore (sem painel de referências)
  let leafY = 0;
  const dx = 380;
  const dy = 150;

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

  // centralizar em Y e dar margem superior
  const ys = Array.from(positions.values()).map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const midY = (minY + maxY) / 2;

  const topMargin = 140;
  const shiftY = -midY + topMargin;

  for (const [node, p] of positions.entries()) {
    positions.set(node, { ...p, y: p.y + shiftY });
  }

  return positions;
}

export function blankSkeletonElements(title: string) {
  const t = (title || "Tema").trim() || "Tema";
  const colors = styleForDepth(0);
  return [
    {
      id: "node_0",
      type: "rectangle",
      x: 120,
      y: 140,
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

  // Se existir um ramo “Referências e dados” (ou similar), ele vira “painel” à direita
  let rightBranch: TreeNode | null = null;
  const idx = tree.children.findIndex((c) => isRightPanelLabel(c.text));
  if (idx >= 0) {
    rightBranch = tree.children[idx];
    tree.children.splice(idx, 1);
  }

  const pos = layoutClassic(tree);
  const nodes = collectNodes(tree);

  // Se houver painel, posiciona manualmente o ramo e seus filhos à direita
  const rightNodes: { node: TreeNode; id: string; depth: number; parent?: string }[] = [];
  const rightIdByNode = new Map<TreeNode, string>();

  if (rightBranch) {
    // cria ids para o ramo de referência
    let c = nodes.length;
    function walkRight(n: TreeNode, depth: number, parent?: string) {
      const id = `node_${c++}`;
      rightNodes.push({ node: n, id, depth, parent });
      rightIdByNode.set(n, id);
      for (const ch of n.children) walkRight(ch, depth + 1, id);
    }
    walkRight(rightBranch, 1, nodes[0].id); // pai = root

    // pos fixo do painel
    const rightX = 980;
    const colDx = 360;
    const startY = 120;

    // header do painel
    pos.set(rightBranch, { x: rightX, y: startY + 60, depth: 1 });

    // filhos como lista vertical
    let y = startY + 210;
    for (const ch of rightBranch.children) {
      pos.set(ch, { x: rightX + colDx, y, depth: 2 });
      y += 140;

      // netos em cascata abaixo do filho
      let yy = y - 90;
      for (const g of ch.children) {
        pos.set(g, { x: rightX + colDx * 2, y: yy, depth: 3 });
        yy += 120;
        y = Math.max(y, yy + 20);
      }
    }

    // painel (fundo) como retângulo suave
    const panelH = Math.max(520, y - startY + 80);
    const panel = {
      id: "panel_refs",
      type: "rectangle",
      x: rightX - 90,
      y: startY,
      width: 980,
      height: panelH,
      roughness: 0,
      strokeWidth: 1,
      strokeStyle: "solid",
      fillStyle: "solid",
      opacity: 100,
      roundness: { type: 3 },
      strokeColor: "#CBD5E1",
      backgroundColor: "#F8FAFC",
      label: {
        text: "Notas e referências",
        fontSize: 20,
        fontFamily: 2,
        textAlign: "left",
        verticalAlign: "top",
      },
    };

    // O painel precisa ser o primeiro para ficar “atrás”
    // Vamos inserir depois no array final como primeiro elemento.
    // Guardamos ele numa variável externa via closure no final.
    (outlineToSkeletonElements as any)._panel = panel;
  } else {
    (outlineToSkeletonElements as any)._panel = null;
  }

  // Junta listas
  const all = rightNodes.length ? nodes.concat(rightNodes) : nodes;
  const idByNode = new Map<TreeNode, string>();
  for (const n of all) idByNode.set(n.node, n.id);

  const elements: any[] = [];
  const panel = (outlineToSkeletonElements as any)._panel;
  if (panel) elements.push(panel);

  // Nós
  for (const { node, id } of all) {
    const p = pos.get(node) || { x: 0, y: 0, depth: 0 };
    const depth = p.depth ?? 0;
    const { w, h, fontSize } = dimsForDepth(depth);
    const colors = styleForDepth(depth);

    elements.push({
      id,
      type: "rectangle",
      x: p.x,
      y: p.y - h / 2,
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

  // Setas (não ligar setas no “painel” ao painel-fundo; apenas entre nós)
  // Arrow skeleton: start/end por id
  for (const { node, id, parent } of all) {
    if (!parent) continue;
    // não cria seta para o painel-fundo
    if (id === "panel_refs" || parent === "panel_refs") continue;

    const from = parent;
    const to = id;

    // posição aproximada
    elements.push({
      type: "arrow",
      x: 0,
      y: 0,
      start: { id: from },
      end: { id: to },
      roughness: 0,
      strokeWidth: 2,
      strokeStyle: "solid",
      opacity: 100,
      strokeColor: "#334155",
    });
  }

  return elements;
}
