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
  const pending = useRef<{ elements: any; appState: any } | null>(null);

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

  // Salva sem retornar Promise (o Excalidraw exige callback "void")
  const saveNow = useMemo(() => {
    return (elements: any, appState: any) => {
      if (!token) return;

      // se já estiver salvando, guarda a última alteração para salvar em seguida
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
          // pequena pausa para evitar salvar a cada milissegundo
          setTimeout(() => {
            saving.current = false;

            // se houver alteração pendente, salva a mais recente
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

  // Assinatura compatível: (elements, appState, files) => void
  const onChange = useMemo(() => {
    return (
      elements: readonly any[],
      appState: any,
      _files: any
    ): void => {
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
