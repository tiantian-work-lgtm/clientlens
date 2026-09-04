import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

// All menu mutations serialize with hierarchy validation in a single database call.
async function save(request: Request, updating: boolean) {
  try {
    await requireAdmin();
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) return NextResponse.json({ error: "菜单名称应为 1–80 个字符" }, { status: 400 });
    const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : null;
    const position = Number.isInteger(body.position) && Math.abs(body.position) <= 100000 ? body.position : 0;
    const id = updating && typeof body.id === "string" ? body.id : randomUUID();
    // Parent is immutable when renaming/reordering; root and child cannot be converted into a third level.
    const result = updating
      ? await query("UPDATE script_menus SET name=$2, position=$3 WHERE id=$1 RETURNING id", [id, name, position])
      : await query(`INSERT INTO script_menus(id,name,parent_id,position) SELECT $1,$2,$3,$4
          WHERE $3::text IS NULL OR EXISTS (SELECT 1 FROM script_menus WHERE id=$3 AND parent_id IS NULL) RETURNING id`, [id, name, parentId, position]);
    if (!result.rowCount) return NextResponse.json({ error: "菜单不存在，或上级不是一级菜单" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
export const POST = (request: Request) => save(request, false);
export const PATCH = (request: Request) => save(request, true);
export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少菜单 ID" }, { status: 400 });
    // Foreign keys move scripts to uncategorized, including scripts in deleted children.
    await query("DELETE FROM script_menus WHERE id=$1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
function failure(error: unknown) {
  const err = error as { code?: string; message?: string };
  const unauthorized = err.message === "UNAUTHORIZED";
  return NextResponse.json({ error: unauthorized ? "仅管理员可以编辑菜单" : err.code === "23505" ? "同级菜单名称不能重复" : "菜单操作失败，请刷新后重试" }, { status: unauthorized ? 403 : 400 });
}
