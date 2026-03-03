import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mindmap White Label",
  description: "Editor white label de mapas mentais (Excalidraw)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
        {children}
      </body>
    </html>
  );
}
