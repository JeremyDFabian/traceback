import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const shareDirectory = join(process.cwd(), ".data", "shared-study-sets");

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (!payload?.study_set || !Array.isArray(payload.cards)) {
      return NextResponse.json({ detail: "Invalid study set" }, { status: 400 });
    }

    const serialized = JSON.stringify({
      study_set: payload.study_set,
      cards: payload.cards.slice(0, 200),
    });
    if (serialized.length > 1_000_000) {
      return NextResponse.json({ detail: "Study set is too large to share" }, { status: 413 });
    }

    const id = randomUUID().replaceAll("-", "");
    await mkdir(shareDirectory, { recursive: true });
    await writeFile(join(shareDirectory, `${id}.json`), serialized, "utf8");
    return NextResponse.json({ id }, { status: 201 });
  } catch {
    return NextResponse.json({ detail: "Could not create share link" }, { status: 500 });
  }
}
