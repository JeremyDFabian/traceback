import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const shareDirectory = join(process.cwd(), ".data", "shared-study-sets");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{32}$/i.test(id)) {
    return NextResponse.json({ detail: "Shared study set not found" }, { status: 404 });
  }
  try {
    const content = await readFile(join(shareDirectory, `${id}.json`), "utf8");
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json({ detail: "Shared study set not found" }, { status: 404 });
  }
}
