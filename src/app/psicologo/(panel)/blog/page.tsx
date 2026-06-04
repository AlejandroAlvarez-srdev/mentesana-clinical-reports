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
    .from("psy_blog_posts")
    .select("id, keyword, title, slug, status, scheduled_for, published_at, hero_url, hero_status, seo_status, created_at, updated_at")
    .eq("provider_id", psi.provider_id)
    .order("updated_at", { ascending: false })
    .limit(200);

  return <BlogListClient initialPosts={data ?? []} psyName={psi.name} />;
}
