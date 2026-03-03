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

export default function EditorPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const search = useSearchParams();
  const token = search.get("t") || "";

  const [initialData, setInitialData] = useState<any>(null);
  const saving = useRef(false);

  useEffect(() => {
    fetch(`/api/diagrams/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const maybeSkeleton = data.elements || [];
        const elements = convertToExcalidrawElements(maybeSkeleton, {
          regenerateIds: false,
        });

        setInitialData({
          elements,
          appState: {
            ...(data.appState || {}),
            zenModeEnabled: false,
          },
          scrollToContent: true,
        });
      });
  }, [id]);

  const onChange = useMemo(
    () => async (elements: any[], appState: any) => {
      if (!token) return;
      if (saving.current) return;
      saving.current = true;

      try {
        await fetch(`/api/diagrams/${id}?t=${encodeURIComponent(token)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ elements, appState }),
        });
      } finally {
        setTimeout(() => (saving.current = false), 1200);
      }
    },
    [id, token]
  );

  if (!token) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Link inválido</h2>
        <p>Faltou o token <code>?t=</code> na URL.</p>
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
