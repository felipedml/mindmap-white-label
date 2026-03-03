export default function Home() {
  return (
    <main style={{ padding: 20, maxWidth: 900 }}>
      <h1 style={{ marginTop: 0 }}>Mindmap White Label</h1>
      <p>Este site hospeda um editor white label de mapas mentais (Excalidraw) e uma API.</p>
      <h2>Como usar</h2>
      <ol>
        <li>Seu chatbot (Pickaxe) chama <code>POST /api/diagrams</code> com um outline.</li>
        <li>A API devolve um link de edição <code>/e/ID?t=TOKEN</code>.</li>
        <li>O usuário abre o link e edita.</li>
      </ol>
      <h2>Endpoints</h2>
      <ul>
        <li><code>POST /api/diagrams</code> (criar)</li>
        <li><code>GET /api/diagrams/ID</code> (carregar)</li>
        <li><code>PUT /api/diagrams/ID?t=TOKEN</code> (salvar)</li>
      </ul>
      <p style={{ opacity: 0.8 }}>
        Dica: depois do deploy, teste criando um diagrama via Postman/Insomnia (ou pelo próprio Pickaxe).
      </p>
    </main>
  );
}
