import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const DATA_PATH =
  process.env.FLASHVOYAGE_DATA_PATH ??
  "/Users/floriangouloubi/Documents/perso/flashvoyage";

interface WPArticle {
  id: number;
  title: string;
  url: string;
  slug: string;
  excerpt: string;
  content: string;
  categories: { id: number; name: string; slug: string }[];
  tags: unknown[];
  date: string;
  modified: string;
  featured_image: string;
}

function detectLanguage(title: string, excerpt: string): "EN" | "FR" | "ES" | "DE" {
  const text = `${title} ${excerpt}`;
  // Count French stop words
  const frMatches = text.match(
    /\b(le|la|les|de|du|des|en|un|une|pour|sur|au|aux|et|ou|ce|par|qui|que|dans|avec|tout|mais|aussi|très|cette|est|son|sa|ses)\b/gi
  );
  if ((frMatches ?? []).length >= 3) return "FR";
  const esMatches = text.match(
    /\b(el|la|los|las|del|en|un|una|para|por|con|que|como|más|muy|todo|pero|este|esta)\b/gi
  );
  if ((esMatches ?? []).length >= 3) return "ES";
  const deMatches = text.match(
    /\b(der|die|das|des|dem|den|ein|eine|und|oder|mit|für|von|zu|ist|nicht|auch|auf|als)\b/gi
  );
  if ((deMatches ?? []).length >= 3) return "DE";
  return "EN";
}

function decodeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function detectSource(content: string): "Reddit" | "RSS" | "Manual" {
  return content.includes("Extrait Reddit") || content.includes("— Extrait")
    ? "Reddit"
    : "Manual";
}

function detectDestination(article: WPArticle): string {
  // Strip "Digital Nomades" prefix from category name to get the region
  const catName = article.categories[0]?.name ?? "";
  const stripped = catName
    .replace(/^Digital Nomades?\s+/i, "")
    .replace(/^Voyage(s)?\s+/i, "")
    .trim();
  if (stripped && stripped !== catName) return stripped;

  // Fallback: scan title for known destinations
  const known = [
    "Thaïlande",
    "Thailand",
    "Japon",
    "Japan",
    "Corée",
    "Korea",
    "Vietnam",
    "Bali",
    "Cambodge",
    "Cambodia",
    "Philippines",
    "Singapour",
    "Singapore",
    "Malaisie",
    "Malaysia",
    "Inde",
    "India",
    "Sri Lanka",
    "Europe",
    "France",
    "Espagne",
    "Australie",
    "Indonésie",
    "Myanmar",
    "Laos",
    "Taiwan",
    "Hong Kong",
    "Chine",
  ];
  const titleLower = article.title.toLowerCase();
  for (const d of known) {
    if (titleLower.includes(d.toLowerCase())) return d;
  }

  return catName || "International";
}

function extractKeyword(slug: string): string {
  return slug.replace(/-/g, " ").split(" ").slice(0, 5).join(" ");
}

export async function GET() {
  try {
    const filePath = join(DATA_PATH, "articles-database.json");
    const raw = await readFile(filePath, "utf-8");
    const db = JSON.parse(raw) as {
      crawled_at: string;
      total_articles: number;
      articles: WPArticle[];
    };

    const articles = db.articles.map((a) => ({
      id: String(a.id),
      title: decodeHtml(a.title),
      column: "published" as const,
      source: detectSource(a.content),
      keyword: extractKeyword(a.slug),
      date: a.date.slice(0, 10),
      language: detectLanguage(a.title, a.excerpt),
      destination: detectDestination(a),
      wordCount: a.content.trim().split(/\s+/).length,
      // Extra fields for richer display (not in KanbanCard type but harmless)
      url: a.url,
      featuredImage: a.featured_image,
      categories: a.categories.map((c) => c.name),
    }));

    return NextResponse.json({
      source: "real",
      crawledAt: db.crawled_at,
      total: db.total_articles,
      articles,
    });
  } catch (err) {
    const isEnoent = err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT";
    if (isEnoent) {
      // Local articles DB not present — expected in non-local envs, fall back silently
      return NextResponse.json({ source: "mock", articles: [] });
    }
    console.error("[api/articles]", err);
    return NextResponse.json(
      { source: "error", error: String(err), articles: [] },
      { status: 500 }
    );
  }
}
