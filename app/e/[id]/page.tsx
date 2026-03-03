"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

function palette(depth: number) {
  const p = [
    { bg: "#DBEAFE", stroke: "#1D4ED8" },
    { bg: "#E0E7FF", stroke: "#4338CA" },
    { bg: "#D1FAE5", stroke: "#047857" },
    { bg: "#FEF3C7", stroke: "#B45309" },
    { bg: "#FCE7F3", stroke: "#BE185D" },
  ];
  return p[Math.min(depth, p.length - 1)];
}

function estimateDx(xs: number[]) {
  const unique = Array.from(new Set(xs)).sort((a, b) => a - b);
  let best = 0;
  for (let i = 1; i < unique.length; i++) {
    const d = unique[i] - unique[i - 1];
    if (d > 10) best = best ? Math.min(best, d) : d;
  }
  return best || 320;
}

function styleElements(elements: any[]) {
  const rects = elements.filter((e) => e?.type === "rectangle");
  if (!rects.length) return elements;

  const minX = Math.min(...rects.map((r: any) => r.x));
  const dx = estimateDx(rects.map((r: any) => r.x));

  const depthByRectId = new Map<string, number>();
  for (const r of rects) {
    const depth = Math.max(0, Math.round((r.x - minX) / dx));
    depthByRectId.set(r.id, depth);
  }

  return elements.map((el: any) => {
    if (el?.type === "rectangle") {
      const depth = depthByRectId.get(el.id) ?? 0;
      const c = palette(depth);

      return {
        ...el,
        roughness: 0,
        strokeWidth: 2,
        strokeStyle: "solid",
        fillStyle: "solid",
        opacity: 100,
        roundness: el.roundness ?? { type: 3 },
        strokeColor: c.stroke,
        backgroundColor: c.bg,
      };
    }

    if (el?.type === "text") {
      const depth = depthByRectId.get(el.containerId) ?? 0;
      const fontSize = depth === 0 ? 24 : depth === 1 ? 20 : 18;

      return {
        ...el,
        fontFamily: 2,
        fontSize,
        textAlign: "center",
        verticalAlign: "middle",
      };
    }

    if (el?.type === "arrow") {
      const startId = el.startBinding?.elementId;
      const depth = startId ? (depthByRectId.get(startId) ?? 0) : 0;
      const c = palette(depth);

      return {
        ...el,
        roughness: 0,
        strokeWidth: 2,
        strokeStyle: "solid",
        opacity: 100,
        strokeColor: c.stroke,
      };
    }

    return el;
  });
}

export default function EditorPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const search = useSearchParams();
  const token = search.get("t") || "";

  const [initialData, setInitialData] = useState<any>(null);

  const saving = useRef(false);
  const pending = useRef<{ elements: any; appState: any } | null>(null);

  useEffect(() => {
    fetch(`/api/diagrams/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const maybeSkeleton = data.elements || [];
        const converted = convertToExcalidrawElements(maybeSkeleton, {
          regenerateIds: false,
        });

        const styled = styleElements(converted as any[]);

        setInitialData({
          elements: styled,
          appState: {
            ...(data.appState || {}),
            zenModeEnabled: false,
            viewBackgroundColor: "#FFFFFF",
            gridSize: null,
            theme: "light",
            defaultFontFamily: 2,
            currentItemFontFamily: 2,
          },
          scrollToContent: true,
        });
      });
  }, [id]);

  const saveNow = useMemo(() => {
    return (elements: any, appState: any) => {
      if (!token) return;

      if (saving.current) {
        pending.current = { elements, appState };
        return;
      }

      saving.current = true;

      void (async () => {
        try {
          await fetch(`/api/diagrams/${id}?t=${encodeURIComponent(token)}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ elements, appState }),
          });
        } finally {
          setTimeout(() => {
            saving.current = false;

            if (pending.current) {
              const p = pending.current;
              pending.current = null;
              saveNow(p.elements, p.appState);
            }
          }, 900);
        }
      })();
    };
  }, [id, token]);

  const onChange = useMemo(() => {
    return (elements: readonly any[], appState: any, _files: any): void => {
      saveNow(elements, appState);
    };
  }, [saveNow]);

  if (!token) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Link inválido</h2>
        <p>
          Faltou o token <code>?t=</code> na URL.
        </p>
      </div>
    );
  }

  if (!initialData) return <div style={{ padding: 16 }}>Carregando…</div>;

  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw initialData={initialData} onChange={onChange} />
    </div>
  );
}
