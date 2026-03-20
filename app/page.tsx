import { readFile } from "fs/promises";
import { join } from "path";
import { OverviewContent } from "@/components/overview/OverviewContent";
import type { KanbanCard } from "@/components/kanban/mockKanbanData";

const DATA_PATH =
  process.env.FLASHVOYAGE_DATA_PATH ??
  "/Users/floriangouloubi/Documents/perso/flashvoyage";

interface WPArticle {
  id: number;
  title: string;
  date: string;
  categories: { id: number; name: string; slug: string }[];
  url: string;
  slug: string;
  content: string;
  excerpt: string;
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

function getDestination(article: WPArticle): string {
  const catName = article.categories[0]?.name ?? "";
  const stripped = catName.replace(/^Digital Nomades?\s+/i, "").trim();
  return stripped && stripped !== catName ? stripped : catName || "International";
}

async function loadRealArticles(): Promise<{
  cards: KanbanCard[];
  crawledAt: string;
} | null> {
  try {
    const raw = await readFile(join(DATA_PATH, "articles-database.json"), "utf-8");
    const db = JSON.parse(raw) as {
      crawled_at: string;
      total_articles: number;
      articles: WPArticle[];
    };
    const cards: KanbanCard[] = db.articles.map((a) => ({
      id: String(a.id),
      title: decodeHtml(a.title),
      column: "published" as const,
      source: a.content.includes("Extrait Reddit") ? "Reddit" : ("Manual" as "Reddit" | "Manual"),
      keyword: a.slug.replace(/-/g, " ").split(" ").slice(0, 4).join(" "),
      date: a.date.slice(0, 10),
      language: "FR" as const,
      destination: getDestination(a),
    }));
    return { cards, crawledAt: db.crawled_at };
  } catch {
    return null;
  }
}

export default async function OverviewPage() {
  const real = await loadRealArticles();
  const publishedCards: KanbanCard[] = real?.cards ?? [];
  const isLive = real !== null;

  return (
    <OverviewContent
      publishedCards={publishedCards}
      isLive={isLive}
      crawledAt={real?.crawledAt ?? null}
    />
  );
}
