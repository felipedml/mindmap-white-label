import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { saveDiagram } from "../../../lib/storage";
import { outlineToSkeletonElements } from "../../../lib/mindmap";

function assertPickaxeAuth(req: Request) {
  const key = req.headers.get("x-pickaxe-secret");
  return Boolean(key && key === process.env.PICKAXE_SHARED_SECRET);
}

export async function POST(req: Request) {
  if (!assertPickaxeAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "Mapa mental");
  const outline = String(body.outline || "").trim();

  if (!outline) {
    return NextResponse.json({ error: "outline_required" }, { status: 400 });
  }

  const id = nanoid(10);
  const writeToken = nanoid(24);
  const skeleton = outlineToSkeletonElements(outline);

  await saveDiagram({
    id,
    title,
    createdAt: new Date().toISOString(),
    writeToken,
    elements: skeleton,
    appState: { zoom: { value: 1 } },
  });

  const base = process.env.APP_BASE_URL;
  if (!base) {
    return NextResponse.json({ error: "missing_APP_BASE_URL" }, { status: 500 });
  }

  const editUrl = `${base}/e/${id}?t=${writeToken}`;
  return NextResponse.json({ id, editUrl });
}
