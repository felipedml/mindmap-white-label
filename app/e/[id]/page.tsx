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

function estimateDx(xs: number[]) {
  const unique = Array.from(new Set(xs)).sort((a, b) => a - b);
  let best = 0;
  for (let i = 1; i < unique.length; i++) {
    const d = unique[i] - unique[i - 1];
    if (d > 10) best = best ? Math.min(best, d) : d;
  }
  return best || 320;
}

function computeDepthByRectId(elements: any[]) {
  const rects = elements.filter((e) => e?.type === "rectangle" && e?.id && e?.id !== "panel_refs");
  if (!rects.length) return new Map<string, number>();

  const minX = Math.min(...rects.map((r: any) => r.x));
  const dx = estimateDx(rects.map((r: any) => r.x));

  const depthBy = new Map<string, number>();
  for (const r of rects) {
    const depth = Math.max(0, Math.round((r.x - minX) / dx));
    depthBy.set(r.id, depth);
  }
  return depthBy;
}

export default function EditorPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const search = useSearchParams();
  const token = search.get("t") || "";

  const [initialData, setInitialData] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);

  const apiRef = useRef<any>(null);

  const saving = useRef(false);
  const pending = useRef<{ elements: any; appState: any } | null>(null);
  const suppressSave = useRef(false);

  const fullElementsRef = useRef<any[] | null>(null);

  useEffect(() => {
    fetch(`/api/diagrams/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const maybeSkeleton = data.elements || [];
        const converted = convertToExcalidrawElements(maybeSkeleton, { regenerateIds: false }) as any[];

        fullElementsRef.current = converted;

        setInitialData({
          elements: converted,
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
      if (suppressSave.current) {
        suppressSave.current = false;
        return;
      }
      // guarda versão completa para “Expandir tudo”
      if (!collapsed) {
        fullElementsRef.current = elements as any[];
      }
      saveNow(elements, appState);
    };
  }, [saveNow, collapsed]);

  function applyCollapsedMode() {
    if (!apiRef.current) return;
    const current = apiRef.current.getSceneElements?.() || [];
    const depthBy = computeDepthByRectId(current);

    // esconde retângulos/textos/arrows de profundidade >= 2
    const hidden = current.map((el: any) => {
      if (el?.id === "panel_refs") return el;

      if (el?.type === "rectangle") {
        const d = depthBy.get(el.id) ?? 0;
        if (d >= 2) return { ...el, isDeleted: true };
      }

      if (el?.type === "text") {
        const containerId = el.containerId;
        const d = depthBy.get(containerId) ?? 0;
        if (d >= 2) return { ...el, isDeleted: true };
      }

      if (el?.type === "arrow") {
        const s = el.startBinding?.elementId;
        const e = el.endBinding?.elementId;
        const ds = s ? (depthBy.get(s) ?? 0) : 0;
        const de = e ? (depthBy.get(e) ?? 0) : 0;
        if (ds >= 2 || de >= 2) return { ...el, isDeleted: true };
      }

      return el;
    });

    suppressSave.current = true;
    apiRef.current.updateScene?.({ elements: hidden });
    setCollapsed(true);
  }

  function restoreAll() {
    if (!apiRef.current) return;
    const full = fullElementsRef.current;
    if (!full) return;

    suppressSave.current = true;
    apiRef.current.updateScene?.({ elements: full });
    setCollapsed(false);
  }

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
    <div style={{ height: "100vh", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          display: "flex",
          gap: 8,
          padding: 8,
          borderRadius: 12,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid #E2E8F0",
        }}
      >
        <button
          onClick={applyCollapsedMode}
          disabled={collapsed}
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #CBD5E1", cursor: "pointer" }}
        >
          Colapsar detalhes
        </button>
        <button
          onClick={restoreAll}
          disabled={!collapsed}
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #CBD5E1", cursor: "pointer" }}
        >
          Expandir tudo
        </button>
      </div>

      <Excalidraw
        initialData={initialData}
        onChange={onChange}
        excalidrawAPI={(api: any) => {
          apiRef.current = api;
        }}
      />
    </div>
  );
}
