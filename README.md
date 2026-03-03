# Mindmap White Label (Excalidraw + API) — pronto para Vercel

Este projeto cria um editor **white label** (no seu domínio) baseado no Excalidraw, com uma API simples:

- `POST /api/diagrams` (criar mapa mental)
- `GET /api/diagrams/:id` (carregar)
- `PUT /api/diagrams/:id?t=TOKEN` (salvar pelo editor)

## Variáveis de ambiente (Vercel)

Crie estas env vars no projeto da Vercel:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `APP_BASE_URL` (ex: https://seu-projeto.vercel.app)
- `PICKAXE_SHARED_SECRET` (uma senha longa)

## Como funciona (resumo)

1. O Pickaxe chama `POST /api/diagrams` com `x-pickaxe-secret`.
2. A API cria `id` e `writeToken` e devolve `editUrl` assim: `/e/:id?t=writeToken`.
3. O usuário abre o link e edita no seu site.
4. O editor salva via `PUT`, usando o token da URL.

## Teste rápido (local)

1. `npm install`
2. `npm run dev`
3. Abrir http://localhost:3000

> Para rodar local com Redis, defina env vars num arquivo `.env.local`.
