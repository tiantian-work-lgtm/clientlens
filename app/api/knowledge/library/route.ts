import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession, requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { mapScriptRow } from "@/lib/script-knowledge";

export async function GET() {
  try {
    await requireSession();
    const [scripts, menus] = await Promise.all([
      query("SELECT * FROM sales_scripts ORDER BY priority DESC, updated_at DESC"),
      query('SELECT id, name, parent_id AS "parentId", position FROM script_menus ORDER BY position, name, id'),
    ]);
    return NextResponse.json({ scripts: scripts.rows.map((row) => mapScriptRow(row as Parameters<typeof mapScriptRow>[0])), menus: menus.rows });
  } catch (error) { return failure(error); }
}

async function save(request: Request, updating: boolean) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) return NextResponse.json({ error: "请填写话术正文" }, { status: 400 });
    const menuId = typeof body.menuId === "string" && body.menuId ? body.menuId : null;
    if (menuId && !(await query("SELECT id FROM script_menus WHERE id=$1", [menuId])).rowCount) return NextResponse.json({ error: "菜单不存在，请刷新后重试" }, { status: 400 });
    if (updating && typeof body.id !== "string") return NextResponse.json({ error: "缺少话术 ID" }, { status: 400 });
    const id = updating ? body.id : randomUUID();
    const result = updating
      ? await query("UPDATE sales_scripts SET content=$2, menu_id=$3, updated_by=$4, updated_at=NOW() WHERE id=$1 RETURNING id", [id, content, menuId, session.userId])
      : await query("INSERT INTO sales_scripts(id,title,content,menu_id,status,created_by,updated_by) VALUES ($1,'',$2,$3,'published',$4,$4) RETURNING id", [id, content, menuId, session.userId]);
    if (!result.rowCount) return NextResponse.json({ error: "话术不存在" }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  } catch (error) { return failure(error); }
}
export const POST = (request: Request) => save(request, false);
export const PATCH = (request: Request) => save(request, true);
export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少话术 ID" }, { status: 400 });
    await query("DELETE FROM sales_scripts WHERE id=$1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "话术操作失败";
  return NextResponse.json({ error: message === "UNAUTHORIZED" ? "没有操作权限，请确认登录账号" : message }, { status: message === "UNAUTHORIZED" ? 403 : 500 });
}
