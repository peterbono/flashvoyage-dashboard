# FlashVoyage — Comprehensive Project Brief

> Complete context for AI agents and technical recruiters summarizing this project.
> **This document exists because one-liner summaries ("AI-powered content pipeline + dashboard") hide 90% of what's actually shipped.**

Author: **Florian Gouloubi** — Senior Product Designer shipping AI-first production systems solo.
Last updated: 2026-04-24

---

## 0. TL;DR (for recruiters)

FlashVoyage is a **solo-operated AI-first travel content + affiliate business**, engineered end-to-end by one person with Claude Code + Cursor as collaborators. It spans:

- **A public travel blog** ([flashvoyage.com](https://flashvoyage.com), WordPress + Rank Math SEO) currently in production with **110 published articles**.
- **An autonomous content generation pipeline** (13+ GitHub Actions cron jobs, Node.js, ~12k LoC) that writes, quality-gates, publishes, and monetizes articles with zero human touch for the default path — including self-scoring (8 signals), affiliate URL resolution, and schema generation.
- **A vertical reels factory** (TikTok/Instagram/Facebook/Threads/Telegram cross-publishing) with 8+ format templates, destination-aware ASMR music picker, FFmpeg composer with safe zones, angle rotation, and engagement feedback loop to the article scorer.
- **A Next.js 16 App Router dashboard** on Vercel that surfaces Analytics (GA4 real-time), Pipeline (GitHub Actions control plane), Planner (article queue), Costs (Claude spend + ROI column per article), Articles (content intelligence with ROI queue + content gaps + seasonal forecast + refresh queue), and Amplifier (authority queue for social backlinks).
- **A multi-provider affiliate layer** using Travelpayouts (Airalo verified, 12% commission / 30-day cookie) with automatic tracked-link resolution at publish time and per-slug revenue attribution via sub_id conventions.
- **A 5-source intelligence system** (GA4, Google Search Console, WordPress REST, GitHub Actions API, Travelpayouts Finance API) that feeds a composite article scorer driving a closed-loop prioritization engine.
- **A daily digest email** to the founder with 6 decision-oriented sections (Anomalies, Growth Signals, Deep Focus Tracker, 3 Actions, Monetization Health, Pipeline Health).

Built and maintained solo. No team. AI-assisted engineering throughout: Claude Code for pipeline development, multi-agent orchestration for complex ops (today's "Plan C" SEO hard-reset processed 30 article kills + 29 redirects + 83 link insertions + 9 article humanizations across 2 repos + Vercel deploys in a single evening with parallel agent workstreams).

---

## 1. Business model

FlashVoyage monetizes travel content through:

1. **Affiliate commissions** via Travelpayouts (primary — Airalo eSIM confirmed, Holafly in onboarding, plus Aviasales, Kiwi, Tiqets for flights/activities). Commission range 3-40%, 30-day cookies. Per-slug attribution via `{wpId}-{slot}-{variant}` sub_id convention.
2. **Organic SEO traffic** on long-tail travel queries (FR-targeted). Primary personas: FR-speaking travelers heading to Asia SE. Primary verticals: eSIM / connectivity, budget travel, country comparisons, visa / legal.
3. **Social amplification** via TikTok + Instagram reels. TikTok organic reach drives non-Google traffic (~24% of article sessions have no GSC impression attribution — all social / direct).

### Current metrics (as of 2026-04-24)

- **110 published articles** on [flashvoyage.com](https://flashvoyage.com) (down from 140 after 2026-04-24 "Plan C" hard-reset removed 30 near-duplicates)
- **$1.14 cumulative Claude API spend**, **$0.087 per article average** (Haiku 4.5 + GPT-4o-mini split)
- **56 GA4 sessions/7 days** (small base — the domain is young and in recovery from scaled-content signal de-prioritization)
- **GSC: 20/140 articles with impressions** pre-reset, targeted to increase post-reset via consolidated authority
- **Travelpayouts**: 6 programs approved (Airalo, Aviasales, Kiwi, Tiqets, VisitorsCoverage, Insubuy), account active, baseline €0 (measurement infrastructure just wired)

---

## 2. Architecture — two repos + one production site

### 2.1 `peterbono/flashvoyage-ultra-content` (private)
The **content factory** — ~12k LoC of Node.js ESM. Entry points per subsystem:

- `intelligent-content-analyzer-optimized.js` (~4800 LoC) — main article generator, orchestrates 12+ LLM stages (extract, angle, outline, generator-main, micro-seo-title, micro-intro-hook, micro-body-sections, micro-conclusion, autocritique-pass2, editorial-faq, translate, anti-hallucination, review-fix-citation). Supports Anthropic primary + OpenAI fallback with automatic model substitution.
- `intelligence/` — scoring + prioritization + gap detection + lifecycle
- `social-distributor/` — reels factory + cross-publisher
- `scripts/` — operational scripts (linkbuilding, GSC inspections, monitoring, one-shot ops)
- `.github/workflows/` — 15+ cron jobs (see §8)

### 2.2 `peterbono/flashvoyage-dashboard` (private)
The **control plane** — Next.js 16 App Router + TypeScript + Tailwind + shadcn/ui, deployed on Vercel. Read-mostly dashboard with action surfaces (workflow dispatch, queue mutations, approval flows).

- 6 tabs (Analytics / Pipeline / Planner / Costs / Articles / Amplifier)
- ~30 API routes under `/api/*` for aggregated data + action dispatch
- Reads content repo data via GitHub raw endpoint with 5-min in-memory cache
- Executes via GitHub Actions `workflow_dispatch` for long-running ops, direct WordPress REST for WP mutations

### 2.3 `flashvoyage.com` (public WordPress)
- WordPress 6.x on OVH shared hosting
- Rank Math SEO Free (meta, sitemap, schema graph injection, per-post redirects)
- Code Snippets plugin (used for server-side operations including one critical incident fix today — writing to `.htaccess` via REST-exposed PHP execution)
- Custom FlashVoyage widgets plugin (`flashvoyage-widgets.php`) for affiliate card injection
- GA4 (property `505793742`) + Microsoft Clarity (project ID set, pixel only — no data ingestion yet)
- XML-RPC enabled (flagged as security concern — on roadmap to disable)

---

## 3. Content generation pipeline — 12-stage LLM chain

### 3.1 Stages per article

1. **Topic extraction** — from Reddit thread, RSS feed, or evergreen hint. Claude Haiku extracts `{destination, keyword, angle, shelf_life}`.
2. **Angle hunter** — `intelligence/angle-hunter.js` generates editorial angle with 5 builder sub-branches (`cost_breakdown`, `logistic_choice`, `timeline_tension`, `consensus_breaker`, `hidden_risk`). Enforces banned-vocab list (`arbitrage`, `dilemme`, `caché`, `crucial`, `optimiser chaque` — the infamous AI-pattern markers that triggered Google's scaled-content signal).
3. **Outline builder** — `intelligence/article-outline-builder.js`. 4 fixed H2 templates + a `loose_narrative` 3-section template selected 30% of the time (deterministic per-slug seed), explicitly designed to break skeleton uniformity that Google's classifier reads structurally.
4. **Generator-main** — Claude Haiku 4.5 (primary) generates the article body. GPT-4o fallback with automatic model-name substitution via `callOpenAIWithRetry` wrapper if Anthropic fails.
5. **Micro sections** — seo-title, intro-hook, body-sections, conclusion, editorial-FAQ each get their own focused LLM call for quality density.
6. **Quality gate (autocritique-pass2)** — Claude re-reads and flags anti-hallucination, weak sources, generic claims.
7. **Translate** — FR-first, partial EN for specific sections.
8. **Anti-hallucination** — fact-check pass on numeric claims, dates, prices.
9. **Review-fix-citation** — ensures 2-5 inline citations (Reddit quotes, partner data) per article.
10. **Schema generation** — injects Article + FAQPage + Product/Review JSON-LD blocks for rich snippets.
11. **Affiliate placeholder resolution** — `intelligence/travelpayouts-client.js` swaps `[AFFILIATE:airalo-philippines]` etc. with tracked `airalo.tpo.lv/<shortcode>?sub_id={wpId}-<slot>-a` URLs at publish time (added 2026-04-24). Cached per `{articleId, slot}` for 24h in `data/live-cache/tp-links.json`. Falls back to direct partner URL for non-TP partners (e.g., Holafly) and flags for manual affiliate-program enrollment.
12. **Content guardrails** — `intelligence/content-guardrails.js` (added 2026-04-24) scans the final payload for editorial markers (`[VERIFY]`, `[TODO]`, `[FIXME]`, `[XXX]`, `[PLACEHOLDER]`, `[AFFILIATE:X]`) across content + excerpt + title + stringified meta. Throws `ContentGuardrailError` with position hints BEFORE the WP PUT — a failed publish is recoverable, a shipped article with visible placeholders is not.

### 3.2 Post-publish hooks

13. **Authority amplifier (Phase 9)** — `intelligence/authority-amplifier.js` (added 2026-04-24) runs after successful WP PUT. Reads the author's Quora profile (24 answers indexed, 39 435 cumulative views), scores topical relevance per answer, and queues proposed edits (append contextual sentence linking to the new article) in `data/amplifier-queue/<slug>.json`. Non-blocking — if it fails, the publish still succeeds. Extensible to Reddit / Routard / LinkedIn with same queue schema.

### 3.3 Cost tracking

Every LLM call records to `data/cost-history.jsonl` with fields: date, articleId, slug, wordCount, byStep × {calls, tokensIn, tokensOut, costUSD, durationMs}, byModel × {calls, tokensIn, tokensOut, costUSD}, finalScore, approved. This JSONL is the source-of-truth for the dashboard's Costs tab + ROI column.

Before today's fix: `reelAmplification` signal was 0 across all 140 articles because of a join bug (`reelMap[slug].reels` was read while linker wrote at `reelMap.articleMap[slug].reels` — one level deeper). Fix added 4-tier join precedence (explicit `articleSlug` → `post-article-map.json` → destination-inferred TikTok match → fuzzy caption with threshold 0.35).

---

## 4. Reels factory — 8 format templates, cross-platform

### 4.1 Format library

- `avantapres` (before/after)
- `cost-vs` (price contrast — highest performer, S-tier)
- `listicle` (numbered takeaways)
- `versus` (A vs B destination)
- `best-time` (seasonal calendar, Gantt chart)
- `leaderboard` (ranked cities / costs)
- `trip-pick` (single destination spotlight)
- `humor` (curated 47-joke library, punchline-split safe-zone composer)

Each format has:
- Dedicated composer (FFmpeg-based, 1080×1920 @ 30fps, H.264/AAC)
- Safe zones respected (IG top 200-320px, bottom reserved for caption bar)
- Dynamic title sizing (no truncation)
- Destination-aware ASMR music picker (Pixabay CC0 + Mixkit, geo-matched per destination — Philippines → beach ambient, Japan → city ASMR, etc.)
- Pexels stock footage integration for B-roll

### 4.2 Cross-publisher

- **Instagram** — Reel direct via IG Graph API (resumable upload, silent audio track injection for IG's audio requirement)
- **Facebook** — Reel via 3-phase upload + FB CDN thumbnail relay (bypasses OVH IP restrictions)
- **Threads** — Photo + reserved 500-char caption with dynamic UTM URL space
- **Telegram** — Automatic preview push to founder's chat for visual review before manual TikTok repost (TikTok API app-review pending, manual repost is the working path)
- **Story** — IG Story promotes the reel itself (not a random article photo)

### 4.3 Engagement feedback loop

- TikTok stats imported manually via CSV (TikTok Studio "Content" export) through a dashboard editor (`components/analytics/TikTokStatsEditor.tsx`). Parses client-side, auto-computes totals, commits to `data/tiktok-stats.json` via GitHub Contents API.
- Article-reel linker joins reels → articles via 4-tier precedence (see §3.3).
- `reelAmplification` score feeds back into article-scorer composite score → prioritizer → what-to-write queue. Closes the loop: articles with working TikTok amplification get preferential content-refresh priority.

---

## 5. Intelligence / scoring system

### 5.1 Article scorer

`intelligence/article-scorer.js` — for each article, computes a composite score on 8 signals:

| Signal | Source | Meaning |
|---|---|---|
| `traffic` | GA4 | Normalized page traffic vs top-performer |
| `sessionQuality` | GA4 | Bounce rate inverse + avg duration |
| `trendAlignment` | Google Trends (planned) | Query trend 30d delta |
| `reelAmplification` | Article-reel linker | Aggregate reel performance tied to article |
| `freshness` | `modified` WP field | Time decay from last update |
| `monetization` | Partner-widget-audit (heuristic) / TP sub_id (planned H2) | Revenue per pageview |
| `frShare` | GA4 country filter | % FR traffic |
| `frPageviews` | GA4 | Absolute FR pageview count |

### 5.2 Closed-loop prioritization

- `intelligence/article-prioritizer.js` — commission-weighted ROI queue (articles with high TP commission potential ranked higher)
- `intelligence/lifecycle-manager.js` — states: emerging / growing / mature / declining / dead. State transitions trigger different actions (refresh, kill, promote, amplify).
- `intelligence/content-gap-detector.js` — finds underserved keyword clusters
- `intelligence/content-refresh-engine.js` — schedules refreshes based on velocity decay
- `intelligence/ab-test-engine.js` — statistical variant testing on title/intro (sub_id variant convention ready)
- `intelligence/velocity-engine.js` — time-series deltas per signal

### 5.3 Data flow

```
WordPress (content + modified timestamp)
  + GA4 (traffic, session quality, FR share)
  + GSC (impressions, position, CTR per query)
  + TP Finance API (conversions by sub_id)
  + Article-reel-linker (reelAmp)
      ↓
article-scorer.js  → data/article-scores.json
      ↓
article-prioritizer.js  → data/roi-optimized-queue.json
lifecycle-manager.js   → data/lifecycle-states.json
content-gap-detector.js → data/content-gaps.json
      ↓
Dashboard content-intelligence endpoint
      ↓
What-to-Write tab / Refresh queue / Today's 3 Actions
```

---

## 6. Dashboard — 6 tabs

### 6.1 Analytics (`/`)
- **Revenue KPI card** (added 2026-04-24, fed by Travelpayouts `get_user_actions_affecting_balance` API, 15-min ISR cache)
- Top stats: followers / pageviews / sessions / qualifying events
- Publications table (all IG/FB/Threads/TikTok posts with impressions, engagement, platform icon)
- Deltas week-over-week
- TikTok stats editor (drop CSV, parse client-side, commit to content repo via GitHub Contents API)
- Error boundary with extension-induced crash protection (specific fix for Claude Chrome / React DevTools / MetaMask `insertBefore` reconciliation bug on React re-render during DOM mutation)

### 6.2 Pipeline (`/pipeline`)
- GitHub Actions workflow runs live (name, status, run_number, head_branch, html_url)
- Stage-by-stage execution visualization (to bypass Vercel Hobby 60s function timeout: each pipeline stage is a separate API route < 30s, client orchestrates)
- Workflow dispatch (Run now / Cancel run) with token validation + 503 fallback
- Per-workflow configurable inputs (dry_run, article_id override)

### 6.3 Planner (`/planner`)
- Reel + article calendar (drag-and-drop via @dnd-kit)
- Schedule view — what's programmed for the week
- FR prime-time slot awareness (crons aligned to 10h Paris / 10h Bangkok per data insight)

### 6.4 Costs (`/costs`)
- Total / MTD / avg spend cards
- Daily cost trend chart
- Cost by article table with **ROI column** (added 2026-04-24): Claude USD spend vs TP EUR revenue attributed by sub_id matching wpId, expressed as %. Green if >100%, gray if 0.
- Model breakdown donut (Haiku / GPT-4o / GPT-4o-mini split)

### 6.5 Articles — Content Intelligence (`/content`)
- **What to Write** tab: ROI queue (priority-ordered), content gaps, seasonal forecast (destinations trending before their peak), article injector form (writes to `data/next-articles-queue.json`)
- **Portfolio** tab: article score table (sortable), content KPI row, refresh queue card, top performers card, FR leaderboard (top articles by FR pageview share)
- **Actions** tab: rule-based suggestions (`lib/content/actionRules.ts`) — e.g., "this article has traffic but no widget — add eSIM affiliate" or "this article declined 30% WoW — refresh"
- Date range selector (7d / 30d / 90d) with cascading filter on all cards
- Manual "Refresh now" triggers a bypass-cache GET across 6 endpoints + dispatches content-intelligence workflow

### 6.6 Amplifier (`/amplifier`) — added 2026-04-24
- Queue of pending authority amplification actions across all tracked articles
- Per-action: platform badge (Quora / Reddit later), type (edit-existing-answer / answer-new-question), confidence score, estimated reach (views of target answer), expandable insertion text with inline edit
- Actions: `Approve & Execute`, `Dismiss`, `Edit text`
- Execute endpoint flags the action in git for next cron pickup (MVP — direct Quora publish automation is next iteration)

---

## 7. AI engineering practices

### 7.1 Model selection

- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) is the primary workhorse for generation, scoring, and suggestions — fast, 12% affiliate commission cost justifies premium generation.
- **GPT-4o** automatic fallback with model-name substitution if Anthropic errors.
- **GPT-4o-mini** for translations + non-critical utility calls.
- **Claude Opus 4.7 (1M context)** used for meta-engineering through Claude Code for complex multi-file refactors and multi-agent orchestration (the 2026-04-24 "Plan C" hard-reset deployed 12+ parallel agents across multiple repos in one evening).

### 7.2 Prompt engineering

- **Pareto 1 + Pareto 2 sweeps** (2026-04-24): ~325 prompt rewrites across 5 files to eliminate AI-pattern vocabulary (`arbitrage / dilemme / crucial / caché / optimiser chaque`) that Google's scaled-content classifier was flagging. Banned-word list is meta-enforced at multiple prompt layers.
- **Banned-word guardrails in prompts themselves** — system prompts explicitly instruct the LLM which words to avoid, with negative exemplars.
- **Positive-example few-shot** — `few-shot-examples.js` has curated exemplars that set the tone (seoTitle, decisionalH2, bodySection, verdictBlock).
- **Angle / outline randomization** — `loose_narrative` template selected 30% of the time by deterministic per-slug seed (FNV-1a hash), breaks skeleton uniformity.

### 7.3 Multi-agent orchestration

Operational patterns developed in production:

- **Parallel wave launching** — agents spawned in parallel with non-overlapping file scopes, results synthesized by the main orchestrator.
- **Safety rails** — "lowest stakes first" execution order (e.g., 3-URL Quora edit batch: 2900 views first, 10k next, 16k last; abort the whole batch if the first fails).
- **Content guardrails as pipeline gates** — any WP PUT/POST scanned for editorial placeholders; `ContentGuardrailError` blocks before the network call.
- **Evidence-first reporting** — agents save logs + screenshots + raw API responses before writing their final reports, allowing the orchestrator to verify claims.
- **Graceful degradation by default** — each data source is optional (pipeline runs fine if GSC fails, TP is empty, Clarity unavailable).

### 7.4 Automation safety practices

- **Disk-cached LLM calls + API responses** — `data/live-cache/*.json` with TTL per resource type (TP links: 7d, TP stats: 1h, GSC: 24h, GA4: 15min).
- **Rate limiters** on every third-party API — TP 100/min token bucket, Anthropic backoff with 2s/5s/10s delays, WP REST 500ms inter-request sleep.
- **Secrets never in logs** — every logger redacts token fields, every error message strips headers.
- **App password principle of least privilege** (on roadmap) — current admin app password has RCE via Code Snippets plugin, to be replaced by editor-capability app password for automation scripts.

---

## 8. CI/CD — GitHub Actions (15+ workflows)

Primary cron jobs:

- `publish-article.yml` — 2×/day article generation and publication (currently SUSPENDED post-2026-04-24 Plan C while domain recovers crawl priority)
- `publish-reels.yml` — 3×/day reel generation (IG, TikTok-Telegram, FB)
- `publish-social-posts.yml` — cross-platform social posts
- `flywheel.yml` — 3×/day orchestrator that chains intelligence → refresh → publish
- `daily-analytics.yml` — GA4 + GSC data pull, aggregated stats
- `daily-digest.yml` — founder morning email (6 sections)
- `content-intelligence.yml` — 3×/day scorer + prioritizer + gap detector refresh
- `linkbuilding-quora.yml` — Quora automation (via Chrome AppleScript hybrid)
- Plus: TikTok stats collection, auto-apply for action rules, cooldown management, auto-edit fixers, review loops

### 8.1 Production incidents solved

**Incident 1 (2026-04-09 to 2026-04-24): Claude usage dropped from ~87% to 0%.** Root cause: the `publish-article.yml` workflow env block missing `ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}` — discovered by tracing cost-history byModel delta over 60 days. 1-line YAML fix restored Claude as primary generator.

**Incident 2 (2026-04-22): dashboard `POST /api/queue` returning "Bad credentials".** Root cause: GitHub PAT on Vercel expired after 30-day TTL. Rotated fine-grained PAT with scoped permissions (Contents + Actions write only to the content repo). 8 dashboard endpoints restored atomically.

**Incident 3 (2026-04-24): Plan C SEO hard-reset — 80/86 zero-traffic articles in "Discovered not indexed" status per GSC URL Inspection API.** Root cause diagnosis: scaled-content signal from AI-pattern titles + 13 near-duplicate clusters (3 Thailand-vs-Vietnam articles in one week). Response deployed in a single evening via multi-agent orchestration: 30 articles trashed + 29 redirects (eventually via .htaccess cleanup since WP Rank Math per-post redirects don't fire on trashed posts), 83 internal link insertions via WP REST, 9 articles humanized via Claude Haiku rewrite, Pareto prompt sweeps (325 edits across 5 files), cron suspension, GSC Request Indexing on 7/8 URLs via browser-console bookmarklet automation, authority amplifier deployment.

**Incident 4 (2026-04-24): `[VERIFY - avril 2026]` editorial placeholders shipped inline in published article.** Root cause: strategist agent emitted review markers, nobody grep'd before push. Response: `content-guardrails.js` module + wired into 4 critical WP PUT call sites. Tests 8/8 pass including regression for third-party JS false positives.

---

## 9. Data sources + integrations (33+ secrets)

### Content + SEO
- Anthropic API (Claude Haiku 4.5 + Opus 4.7)
- OpenAI API (GPT-4o, GPT-4o-mini)
- WordPress REST (flashvoyage.com)
- Rank Math SEO (per-post redirects, schema graph, sitemap)
- Code Snippets plugin (PHP execution via REST — used in one critical .htaccess fix)
- Google Analytics 4 (`505793742`)
- Google Search Console (service account)
- Microsoft Clarity (tracking pixel only, data export not integrated yet)
- Google Trends (roadmap — signal input for trendAlignment score)

### Content sources (research / inputs)
- Reddit API (`REDDIT_CLIENT_ID`, PRAW-style polling)
- Bright Data Scraping Browser (Quora + Reddit residential IPs)
- RSS fallback crawler
- Pexels API (stock photos)
- Flickr API (alt stock)
- Cloudinary (image transforms)

### Monetization
- Travelpayouts (marker 676421, TRS 463418, 6 programs approved, Airalo 12% confirmed)
- Direct affiliate programs (Holafly — in onboarding)

### Distribution
- Instagram Graph API
- Facebook Page API
- Threads API
- TikTok (manual repost via Telegram bot preview)
- Telegram Bot API
- Quora (Playwright + AppleScript hybrid on logged-in Chrome session)
- Routard.com forum (Bright Data residential proxy)

### Operations
- GitHub API (Contents API for data writes, Actions API for workflow dispatch)
- Jira (optional task tracking)
- Gmail API (daily digest delivery)
- Amadeus API (flight data — roadmap)

---

## 10. Notable metrics at scale

- **140 articles → 110 after hard-reset** (+83 internal links, 9 humanized in 1 evening)
- **~60 articles/month peak cadence** (currently suspended for crawl-priority recovery)
- **$1.14 cumulative spend** over ~60 days, **$0.087 per article** all-in (generation + quality gates + translations + schema)
- **24 Quora answers indexed on founder's account**, **39 435 cumulative views**, ~11 671 views/week at peak (4+ "Sélection Quora" editorial features)
- **13 duplicate clusters detected + consolidated** in one pass via cosine-similarity clustering on 2-gram Jaccard of FR-tokenized titles
- **29/29 killed URLs returning HTTP 301** to canonical targets after .htaccess cleanup (verified via full curl audit)
- **83 internal link insertions** across 47 surviving articles, **110/110 survivors now have ≥3 inbound internal links** (was 39 orphans at 0 inbound before)
- **7/8 GSC Request Indexing** submitted via browser-console bookmarklet automation (Google deprecated the Indexing API for non-JobPosting content)

---

## 11. Tech stack

### Languages + runtimes
- Node.js 20 (ESM)
- TypeScript (dashboard only — content repo is vanilla ESM JS)
- PHP 8 (WordPress + Code Snippets)
- Bash + AppleScript (for Chrome session automation on macOS)

### Frameworks + libraries
- **Next.js 16 App Router** (dashboard)
- **React 19** with Suspense + React Error Boundaries
- **Tailwind CSS 4** + **shadcn/ui** component library
- **Recharts** for all charts (cost trends, model breakdowns, throughput)
- **React Flow** for pipeline visualization
- **Zustand** for dashboard state (polling synchronization)
- **@dnd-kit** for drag-and-drop on planner
- **Cheerio** for HTML parsing (internal link audits, article body mutations, body H1 sync)
- **Playwright** for headless browser ops (Quora, Routard, GSC)
- **FFmpeg** for reel composition
- **axios** as HTTP client throughout

### Infrastructure
- **Vercel** (dashboard hosting, Fluid Compute, ISR caching)
- **OVH shared hosting** (WordPress + Apache)
- **GitHub Actions** (all crons, zero external schedulers)
- **Bright Data** (residential + SBR proxies for anti-bot platforms)

### AI / dev workflow
- **Claude Code** (primary dev agent, Opus 4.7 1M context for complex refactors)
- **Cursor** (secondary IDE agent)
- **Anthropic SDK** (`@anthropic-ai/sdk` ^0.80)
- **googleapis** (GSC + GA4 + Indexing API attempts)

---

## 12. Roadmap (what's next)

### H1 — shipped 2026-04-24
- ✅ Travelpayouts auto-swap at publish (`intelligence/travelpayouts-client.js`)
- ✅ Revenue KPI card on Analytics tab
- ✅ ROI column on Costs tab
- ✅ Authority amplifier framework with Phase 9 auto-hook
- ✅ Dashboard Amplifier tab with 1-click approve
- ✅ Content guardrails pre-publish
- ✅ Daily digest Deep Focus Tracker section

### H2 — next 30 days
- 🔄 Replace `hasWidgets` heuristic with real EPMV per slug in `article-scorer.js:363` — transforms the entire system from traffic-optimized to revenue-optimized (the single biggest scorer lever)
- 🔄 Duplicate the deep-focus methodology to 5-10 more articles (esim-vietnam, esim-thailande, assurance-vietnam, bali-vs-thailande)
- 🔄 Clarity Data Export API integration (scroll depth, rage clicks, session replays per slug)
- 🔄 Holafly direct affiliate program onboarding
- 🔄 IndexNow plugin install for Bing/Yandex crawl signals

### H3 — 90+ days
- 🗺 A/B testing harness on affiliate variants via `sub_id={wpId}-{slot}-[ab]` + weekly statistical analyzer
- 🗺 Full closed-loop revenue attribution (TP stats → scorer → prioritizer → generator → publish → TP stats)
- 🗺 Monetization agent in generator decides WHICH affiliate partner per article based on commercial intent + commission + availability
- 🗺 Content-market fit metric = conversion rate × traffic growth (identify pillar candidates vs kill candidates)

---

## 13. What makes this project distinct

1. **Solo-operated at scale.** One person, two repos, 12k LoC content + 6k LoC dashboard, 15+ cron workflows, 33+ third-party integrations, production WordPress site with 110 articles, closed-loop intelligence system.

2. **AI-first engineering throughout.** Not "AI feature bolted on" — AI is the primary construction material. Claude Haiku generates articles, Claude Opus refactors pipelines, multi-agent orchestration handles incidents (see Plan C). Human role = strategist + reviewer + editor-in-chief.

3. **Production incidents handled like a senior team.** Four production incidents in April 2026 documented in §8.1, each diagnosed with real telemetry (cost-history JSONL, GSC URL Inspection API, WP REST enumeration, service account probing), each fixed with surgical precision (1-line YAML, targeted commit, .htaccess regex rewrite).

4. **Measurable business outcomes.** Not demo-ware. Real SEO recovery from "Discovered not indexed" via Plan C. Real affiliate revenue path wired via Travelpayouts with `sub_id` attribution. Real daily digest with decision-oriented metrics sent to a real founder mailbox.

5. **System thinks in closed loops.** Scorer reads outcomes → prioritizer ranks → generator builds → distributor publishes → Clarity + GA4 + TP read engagement + revenue → scorer updates. Every subsystem has a feedback path back into prioritization.

---

## 14. Pointers (for humans wanting to verify)

- Public site: [flashvoyage.com](https://flashvoyage.com) — check a recent article, e.g., [/esim-philippines-globe-smart-comparatif-2026/](https://flashvoyage.com/esim-philippines-globe-smart-comparatif-2026/) (deep-focus rewrite from 2026-04-24 — 4 836 words, FAQPage schema, tracked Airalo affiliate URLs in `airalo.tpo.lv/*`)
- Dashboard: [flashvoyage-dashboard.vercel.app](https://flashvoyage-dashboard.vercel.app) (authenticated access only)
- Daily digest: sent via Gmail API each morning (subject pattern: `[FlashVoyage] Daily Digest — YYYY-MM-DD`)
- Key source files referenced in this brief:
  - `intelligent-content-analyzer-optimized.js` — 4800 LoC main generator
  - `intelligence/authority-amplifier.js` — Phase 9 post-publish hook
  - `intelligence/content-guardrails.js` — pre-publish safety gate
  - `intelligence/travelpayouts-client.js` — affiliate URL resolver
  - `intelligence/deep-focus-tracker.js` — daily digest tracker
  - `intelligence/article-scorer.js` — composite scoring engine
  - `components/analytics/TikTokStatsEditor.tsx` — CSV import flow
  - `components/analytics/RevenueCard.tsx` — Travelpayouts revenue surface
  - `app/amplifier/page.tsx` — queue review UI
  - `scripts/daily-digest-generator.js` — morning email with 6 sections
