// Editor de un post existente (draft / scheduled).
import { notFound } from "next/navigation";
import { getPsicologa } from "@/lib/psicologa-auth";
import { psyBlogSb } from "@/lib/psy-blog";
import EditPostClient from "./EditPostClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const psi = await getPsicologa();
  if (!psi) return notFound();
  const sb = psyBlogSb();
  const numId = Number(id);
  if (!Number.isFinite(numId)) return notFound();
  const { data: post } = await sb.from("blog_articles").select("*").eq("id", numId).maybeSingle();
  if (!post || post.provider_id !== psi.provider_id) return notFound();
  return <EditPostClient post={{
    id: String(post.id),
    keyword: post.keyword ?? "",
    title: post.title,
    slug: post.slug,
    body_md: post.body_md ?? "",
    status: post.status ?? "published",
    scheduled_for: post.scheduled_for,
    hero_url: post.hero_image,
  }} />;
}
