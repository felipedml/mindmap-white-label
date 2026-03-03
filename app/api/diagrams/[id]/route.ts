import { NextResponse } from "next/server";
import { getDiagram, saveDiagram } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const diagram = await getDiagram(params.id);
  if (!diagram) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Não devolvemos o writeToken no GET
  const { writeToken, ...safe } = diagram;
  return NextResponse.json(safe);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") || req.headers.get("x-write-token");

  const current = await getDiagram(params.id);
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (!token || token !== current.writeToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const elements = Array.isArray(body.elements) ? body.elements : null;
  const appState = body.appState ?? null;

  if (!elements) {
    return NextResponse.json({ error: "elements_required" }, { status: 400 });
  }

  await saveDiagram({
    ...current,
    elements,
    appState,
  });

  return NextResponse.json({ ok: true });
}
