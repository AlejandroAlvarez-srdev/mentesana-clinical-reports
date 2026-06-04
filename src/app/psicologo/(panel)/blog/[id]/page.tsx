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
  const { data: post } = await sb.from("psy_blog_posts").select("*").eq("id", id).maybeSingle();
  if (!post || post.provider_id !== psi.provider_id) return notFound();
  return <EditPostClient post={post} />;
}
