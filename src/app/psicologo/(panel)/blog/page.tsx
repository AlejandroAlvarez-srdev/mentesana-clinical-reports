// Panel de blog de la psicóloga — lista de posts (drafts + publicados).
import Link from "next/link";
import { cookies } from "next/headers";
import { getPsicologa } from "@/lib/psicologa-auth";
import { psyBlogSb } from "@/lib/psy-blog";
import BlogListClient from "./_components/BlogListClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PsiBlogPage() {
  // Server-side: lee psicóloga y posts inicial para SSR. El cliente luego refresca.
  const psi = await getPsicologa();
  if (!psi) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p>Sesión expirada. <Link href="/psicologo/login" style={{ color: "#6A178C" }}>Vuelve a iniciar sesión</Link>.</p>
      </div>
    );
  }
  const sb = psyBlogSb();
  const { data } = await sb
    .from("blog_articles")
    .select("id, keyword, title, slug, status, scheduled_for, publish_date, hero_image, hero_status, seo_status, created_at, updated_at")
    .eq("provider_id", psi.provider_id)
    .order("updated_at", { ascending: false })
    .limit(200);

  const posts = (data ?? []).map((r) => ({
    id: String(r.id),
    keyword: r.keyword ?? "",
    title: r.title,
    slug: r.slug,
    status: r.status,
    scheduled_for: r.scheduled_for,
    published_at: r.publish_date,
    hero_url: r.hero_image,
    hero_status: r.hero_status ?? "ready",
    seo_status: r.seo_status ?? "ready",
    created_at: r.created_at ?? r.publish_date,
    updated_at: r.updated_at ?? r.publish_date,
  }));

  return <BlogListClient initialPosts={posts} psyName={psi.name} />;
}
