# GSC FlashVoyage — Plan d'action 2026-05-07

Trois sujets à régler suite aux notifs Google Search Console :
1. **Erreur serveur (5xx)** sur certaines pages (07/05)
2. **Erreur liée à des redirections** + **Page avec redirection** sur le sitemap (07/05 + 30/04)
3. **Fiches de marchand** : champs `hasMerchantReturnPolicy` et `shippingDetails` manquants (02/05)

---

## ⚙️ Étape 1 — Lancer le script (5 min)

Édite 2 posts WordPress via REST API :
- **trash** le slug orphelin `voyager-au-japon-quand-voir-les-cerisiers-sans-la-foule-2`
- **strip** le bloc `<script application/ld+json>` Product/Offer du post `esim-philippines-globe-smart-comparatif-2026` (garde le FAQPage)

```bash
# 1. Pull les creds
vercel env pull .env.local

# 2. Source-les
set -a; source .env.local; set +a

# 3. Dry-run d'abord (n'écrit rien)
bash scripts/gsc-fix.sh

# 4. Si le dry-run a l'air bon → applique
bash scripts/gsc-fix.sh --apply
```

Si l'app password manque la cap `edit_posts`, le script s'arrête proprement et le dit.

---

## 🌐 Étape 2 — Cloudflare (15 min, IMPACT MAXIMUM)

C'est **LE fix qui résout le 5xx**. Actuellement chaque hit Googlebot = full boot WordPress, TTFB monte à 4.7s sous 10 requêtes parallèles → timeouts 524 reportés en 5xx par GSC.

1. Cloudflare dashboard → Domain `flashvoyage.com` → **Caching → Cache Rules**
2. **Create rule** :
   - **Name** : `Cache HTML for anonymous`
   - **When incoming requests match** :
     ```
     (http.host eq "flashvoyage.com")
     and (not starts_with(http.request.uri.path, "/wp-admin"))
     and (not starts_with(http.request.uri.path, "/wp-login"))
     and (not contains(http.request.uri.path, "wp-json"))
     and (not contains(http.request.uri.path, "xmlrpc.php"))
     and (not http.request.uri.query contains "s=")
     and (not http.cookie contains "wordpress_logged_in")
     and (not http.cookie contains "wp-postpass")
     and (not http.cookie contains "comment_author")
     ```
   - **Then** :
     - Cache eligibility: **Eligible for cache**
     - Edge TTL: **1 hour** (override origin)
     - Browser TTL: **Respect origin**
3. **Deploy**.
4. **Vérifier** : `curl -sI https://flashvoyage.com/ -H "User-Agent: Mozilla/5.0"` → 2 hits plus tard tu dois voir `cf-cache-status: HIT`.

> Bonus : dans Cloudflare → Speed → Optimization, active **Always Online** au cas où l'origine timeout quand même.

---

## 🔍 Étape 3 — Google Search Console (5 min)

### 3a. Resoumettre le bon sitemap
1. GSC → **Sitemaps** (menu de gauche, sous "Indexation")
2. Trouver `sitemap.xml` dans la liste → bouton "..." → **Supprimer le sitemap**
3. Champ "Ajouter un sitemap" → coller `sitemap_index.xml` → **Envoyer**

### 3b. Valider les corrections (après étapes 1 et 2 faites + ~24h)
1. GSC → **Indexation des pages** → cliquer chacune des cartes en erreur :
   - `Erreur serveur (5xx)` → bouton **"Valider la correction"**
   - `Erreur liée à des redirections` → **"Valider la correction"**
   - `Page avec redirection` → **"Valider la correction"**
   - `Exclue par la balise "noindex"` → **"Valider la correction"** (si toujours présent)
2. GSC → **Améliorations → Fiches de marchand** → **"Valider la correction"** sur les 2 problèmes

### 3c. Re-tester quelques URLs
GSC → **Inspection de l'URL** (barre du haut), tester :
- la home `https://flashvoyage.com/`
- 1 article : `https://flashvoyage.com/japon-couple-15-jours-budget-tout-compris-2026/`
- 1 catégorie : `https://flashvoyage.com/category/japon/`
- l'eSIM patché : `https://flashvoyage.com/esim-philippines-globe-smart-comparatif-2026/`

Toutes doivent revenir `URL est sur Google` (ou `Indexation autorisée` si pas encore indexée).

---

## 🔧 Étape 4 — Permaliens WordPress (1 min)

Restaure le 301 `?p=N` → pretty URL (actuellement il renvoie 404, ce qui pollue les "Erreurs liées à des redirections") :

1. WP-Admin → **Réglages → Permaliens**
2. Cliquer **Enregistrer les modifications** (sans rien changer) → flush des règles rewrite
3. Tester : `curl -sI "https://flashvoyage.com/?p=1"` → doit retourner `301` vers la pretty URL (pas 404)

Si toujours 404 après le flush, va dans **Rank Math → Redirections** et cherche une règle catch-all sur `^\?p=` à désactiver.

---

## 🛡️ Étape 5 — Filet de sécurité Offer schema (OPTIONNEL)

Si tu crains qu'un futur post comparateur (eSIM, vol, hôtel) refasse la même erreur, dépose ce mu-plugin. Il intercepte tout `<script application/ld+json>` au rendu et patche les `Offer` manquants. Tu peux skip si tu fais l'étape 1 et que tu n'écris plus de Product schema inline.

**Fichier** : `wp-content/mu-plugins/fv-fix-offer-schema.php` (créer le dossier `mu-plugins` s'il n'existe pas)

```php
<?php
/**
 * Plugin Name: FlashVoyage – Patch Offer JSON-LD
 * Description: Adds hasMerchantReturnPolicy + shippingDetails to every Offer node so
 *              GSC stops flagging Merchant Listings errors. Safety net only — the
 *              cleaner fix is to remove inline Product/Offer JSON-LD blocks.
 */
add_action('template_redirect', function () {
    if (is_admin() || is_feed() || wp_doing_ajax()) return;
    ob_start(function ($html) {
        return preg_replace_callback(
            '#(<script[^>]*application/ld\+json[^>]*>)(.*?)</script>#s',
            function ($m) {
                $data = json_decode(trim($m[2]), true);
                if (!is_array($data)) return $m[0];
                $patch = function (&$node) use (&$patch) {
                    if (!is_array($node)) return;
                    if (($node['@type'] ?? '') === 'Offer') {
                        $node['hasMerchantReturnPolicy'] = $node['hasMerchantReturnPolicy'] ?? [
                            '@type' => 'MerchantReturnPolicy',
                            'applicableCountry' => 'FR',
                            'returnPolicyCategory' => 'https://schema.org/MerchantReturnNotPermitted',
                        ];
                        $node['shippingDetails'] = $node['shippingDetails'] ?? [
                            '@type' => 'OfferShippingDetails',
                            'shippingRate' => ['@type' => 'MonetaryAmount', 'value' => '0', 'currency' => $node['priceCurrency'] ?? 'EUR'],
                            'shippingDestination' => ['@type' => 'DefinedRegion', 'geoTargetName' => 'Worldwide'],
                            'deliveryTime' => [
                                '@type' => 'ShippingDeliveryTime',
                                'handlingTime' => ['@type' => 'QuantitativeValue', 'minValue' => 0, 'maxValue' => 0, 'unitCode' => 'DAY'],
                                'transitTime' => ['@type' => 'QuantitativeValue', 'minValue' => 0, 'maxValue' => 0, 'unitCode' => 'DAY'],
                            ],
                        ];
                        $node['priceValidUntil'] = $node['priceValidUntil'] ?? date('Y-12-31');
                    }
                    foreach ($node as &$v) if (is_array($v)) $patch($v);
                };
                if (isset($data['@graph']) && is_array($data['@graph'])) {
                    foreach ($data['@graph'] as &$n) $patch($n);
                } else {
                    $patch($data);
                }
                return $m[1] . wp_json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>';
            },
            $html
        );
    });
});
```

Upload via SFTP ou via un plugin "File Manager".

---

## ✅ Récap timing

| Étape | Durée | Impact |
|---|---|---|
| 1. Script WP REST | 5 min | Résout flag "Page avec redirection" + "Fiches de marchand" |
| 2. Cloudflare cache | 15 min | **Résout les 5xx + accélère tout le site** |
| 3. GSC resubmit + valider | 5 min | Déclenche le re-crawl |
| 4. WP permaliens flush | 1 min | Résout résidu "Erreurs liées à des redirections" |
| 5. mu-plugin (optionnel) | 5 min | Filet de sécurité futurs posts |

Total : **~30 min** pour résoudre les 3 sujets GSC.

Re-vérifier dans GSC sous **48–72h** après revalidation.
