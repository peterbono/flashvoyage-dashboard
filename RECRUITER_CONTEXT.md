# FlashVoyage Dashboard — Contexte Recruteur

> Fichier de référence pour répondre à "avez-vous travaillé sur des projets SaaS ?"
> Florian Gouloubi — Senior Product Designer / Design Systems

---

## Vue d'ensemble

**FlashVoyage Dashboard** est un outil SaaS interne de gestion de contenu SEO pour un site de voyage (flashvoyage.com). Il orchestre un pipeline complet de production d'articles — de la veille de tendances jusqu'à la publication WordPress — avec un suivi éditorial en temps réel.

**Stack** : Next.js 15 App Router · TypeScript · Tailwind CSS · Recharts · React Flow · Zustand · dnd-kit · Vercel

**URL prod** : https://flashvoyage-dashboard.vercel.app

---

## Ce que le dashboard fait concrètement

### 1. Vue d'ensemble (Overview)
- KPIs live : articles publiés, coût LLM total, qualité moyenne des articles
- Filtre temporel Today / 7j / 30j / 90j — tous les indicateurs réactifs
- Graphique de throughput hebdomadaire
- Feed des articles récents WordPress en temps réel (via REST API WP)

### 2. Pipeline de génération d'articles (`/pipeline`)
Architecture stage-by-stage pour contourner la limite de 60s de Vercel Hobby :
- Chaque étape = une route API séparée (< 30s chacune)
- Le client orchestre la séquence avec un `for` loop — Stop = ne pas appeler l'étape suivante
- Étapes réelles : Reddit scraping, RSS crawl, détection de patterns, génération Claude Haiku (evergreen + news), quality gate, publication WordPress
- Visualisation React Flow : nodes animés idle → running → success/failed
- Logs streamés par étape, coût LLM affiché en temps réel
- Stop / Retry granulaire par node

### 3. Kanban éditorial (`/content`)
- 5 colonnes : Sourced → Queued → Generating → Review → Published
- Drag & drop cross-column (dnd-kit — useDraggable + useDroppable + pointerWithin)
- Colonne "Sourced" alimentée par Reddit trending (OAuth2 live)
- Colonne "Published" alimentée par l'API WordPress live
- Persistence via Zustand + localStorage pour les cards "user-managed"

### 4. Costs & Analytics (`/costs`)
- Graphiques Recharts : area chart (coût dans le temps), pie chart (répartition par modèle), bar chart (coût par track)
- KPIs filtrés : 7j / 30j / 90j / All — tous calculés via `useMemo` réactif
- Projection fin de mois calculée sur la vélocité des 7 derniers jours

### 5. Tasks (`/tasks`)
- Board de sprint interne (Backlog, In Progress, Done)
- Tâches persistées en Zustand

---

## Intégrations réelles

| Service | Usage |
|---|---|
| WordPress REST API | GET `/wp/v2/posts` pour stats live, POST pour créer des drafts |
| Anthropic Claude Haiku | Génération d'articles evergreen et news (via route `/api/pipeline/stage`) |
| Reddit OAuth2 | `client_credentials` grant → r/travel trending posts filtrés (score > 100) |
| Pexels API | Images pour les articles |
| Vercel | Deploy continu, env vars prod isolés |

---

## Problèmes techniques résolus

### Architecture Vercel timeout
**Problème** : Un pipeline LLM complet (Reddit + RSS + Claude + WP) = ~60-90s. Vercel Hobby = 60s max par route.
**Solution** : Chaque stage = une route POST séparée. Le client orchestre la séquence. Stop = ne pas appeler le stage suivant. Chaque appel < 30s.

### DnD multi-colonnes
**Problème** : `SortableContext` sans `id` + `closestCorners` → dnd-kit détectait la carte source comme "closest corner" → drop ignoré.
**Solution** : `useDraggable` (pas `useSortable`), suppression de `SortableContext`, collision detection `pointerWithin` + fallback `rectIntersection`.

### Source URLs des suggestions
**Problème** : Claude choisit les 5 meilleures headlines sur 10 dans un ordre non séquentiel → le mapping `suggestions[i] → rssItems[i]` retournait les mauvaises URLs (404).
**Solution** : URLs injectées dans le prompt Claude (`headline | URL: ...`). Claude retourne l'URL directement. Fallback : matching par mots-clés de la headline.

### KPIs non-réactifs
**Problème** : Constantes analytiques définies au niveau module → jamais recalculées quand le filtre de range changeait.
**Solution** : Déplacement dans des `useMemo` dépendant de `filteredDays`.

---

## Ce que j'ai conçu (Design)

- Système de navigation latérale (icônes + labels, collapsible)
- Design tokens cohérents : zinc-950/900/800 pour les fonds, amber-500 pour les accents
- Cards KPI avec trend indicators (↑↓ %)
- Kanban board avec column footers (coût total, qualité avg, word count par colonne)
- Pipeline visualizer : nodes React Flow avec status colors + log panel latéral
- Tooltip contrast fixes (Recharts applique les fill colors aux labels → override avec `itemStyle` / `labelStyle`)
- Empty states "Drop here" avec dashed borders

---

## Ce que ça démontre pour un recruteur

- **Ownership produit complet** : design + frontend + API + intégrations
- **Architecture SaaS réelle** : multi-route, state management Zustand, server vs client components Next.js App Router
- **Intégrations tierces** : WP REST, Reddit OAuth2, Anthropic API
- **Résolution de problèmes techniques** : Vercel limits, DnD bugs, LLM prompt engineering
- **Design Systems** : composants réutilisables, tokens cohérents, dark theme complet

---

## Phrases à sortir en entretien

### "T'as travaillé sur des projets SaaS ?"
> "Oui — j'ai designé et implémenté FlashVoyage, un dashboard SaaS de content automation pour le SEO travel. J'ai pris toutes les décisions produit : architecture info, flows utilisateur (drag-to-queue → pipeline → publish), et les contraintes techniques (Vercel timeout limits, OAuth2 flows) ont directement influencé les choix UX. C'est live en prod sur Vercel."

### "T'as une expérience avec des APIs / données réelles ?"
> "Sur FlashVoyage j'ai connecté Reddit OAuth2, WordPress REST, et Anthropic. Ce qui était intéressant c'est que chaque API a ses contraintes propres — Reddit a un flow OAuth client_credentials, WordPress nécessite une app password en Basic auth, et l'API Anthropic demande de gérer les coûts per-token. Ça m'a forcé à penser les données pas juste en termes de UI mais en termes de SLA, rate limits et cache TTL."

### "Comment tu gères les contraintes techniques en tant que designer ?"
> "Sur ce projet, Vercel Hobby a une limite de 60s par route API. Un pipeline LLM complet prenait 90s. Au lieu de demander un upgrade ou de simplifier les features, j'ai redesigné l'architecture : chaque étape du pipeline est une route séparée, le client orchestre la séquence. Ça m'a aussi permis d'ajouter Stop / Retry granulaire par étape — ce qui était une meilleure UX de toute façon."

### "Tu parles de Design Systems dans ton CV, tu peux développer ?"
> "Sur FlashVoyage j'ai établi un design system interne : tokens zinc-950/900 pour les fonds, amber-500 pour les accents, composants Kanban/Charts/Pipeline réutilisables. Ce que j'ai appris c'est que la vraie valeur d'un design system c'est pas les couleurs — c'est les décisions encapsulées. Par exemple un composant KanbanCard qui gère les états source/quality/cost/empty en un seul composant cohérent."

### "T'as de l'expérience avec l'IA / LLMs ?"
> "J'ai intégré Claude Haiku pour la génération d'articles et le quality scoring. Ce qui m'a le plus appris c'est le prompt engineering — Claude retourne parfois du texte autour du JSON, donc j'ai dû rendre le parsing robuste (extraction entre premier `[` et dernier `]`). Et côté produit, j'ai conçu le quality gate pour que le score soit actionnable : si < 75, l'article reste en Review avec des flags spécifiques plutôt qu'un simple 'rejected'."

---

## Features pipeline (si on creuse sur le projet)

| Feature | Statut | Intérêt technique |
|---|---|---|
| Stage-by-stage pipeline | ✅ Live | Architecture client-orchestrated pour contourner Vercel 60s |
| Kanban multi-source | ✅ Live | Merge Reddit + Zustand + WP sans doublons |
| KPIs réactifs range filter | ✅ Live | `useMemo` chaîné sur `filteredDays` |
| Suggestions RSS → Claude | ✅ Live | Prompt engineering + URL matching fallback |
| Pipeline run history / logs | 🔧 À faire | Track des runs passés (failed stages, coûts, durée) |
| Notifications (failed stage) | 🔧 À faire | Email/Slack quand quality gate refuse un article |
| Multi-user / roles | 🔧 À faire | Éditeur vs Writer vs Publisher |
| A/B test sur les prompts | 🔧 À faire | Comparer evergreen vs news prompt sur qualité score |
