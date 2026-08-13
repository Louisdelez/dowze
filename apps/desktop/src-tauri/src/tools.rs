//! Outils locaux exposés au frontend Dowze via `invoke(...)`.
//!
//! Ces capacités sont propres à l'application de bureau — le navigateur web ne peut pas les offrir
//! (pas de clé API à exposer côté client, pas de CORS, accès réseau natif). Tout est SANS clé :
//! - `web_search` : recherche web générale. Utilise une instance **SearXNG** si `DOWZE_SEARXNG_URL`
//!   est défini (auto-hébergée, open-source, sans clé) ; sinon repli sur DuckDuckGo (HTML).
//! - `wikipedia_search` : recherche encyclopédique (API officielle Wikipédia, gratuite, sans clé) —
//!   idéale pour un usage scolaire (fiable, factuel, adapté aux enfants).

use serde::Serialize;

/// Un résultat de recherche normalisé, quel que soit le moteur.
#[derive(Debug, Serialize, Clone)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
    /// Moteur d'origine : "searxng" | "duckduckgo" | "wikipedia".
    pub source: String,
}

const UA: &str = "DowzeDesktop/0.1 (+https://dowze.ch)";

/// Instance SearXNG Dowze par défaut (surchageable par l'env `DOWZE_SEARXNG_URL`).
/// C'est l'instance centrale privée ; l'app l'utilise par défaut, avec repli DuckDuckGo.
const DEFAULT_SEARXNG_URL: &str = "https://search.dowze.ch";
/// Identifiants basic-auth de l'instance privée (anti-abus, PAS un secret fort — extractibles du binaire).
/// Surchargés par `DOWZE_SEARXNG_USER` / `DOWZE_SEARXNG_PASS`.
const SEARXNG_USER: &str = "dowze";
const SEARXNG_PASS: &str = "9610d7c5ed365f15e819231408c110cf";

fn searxng_base() -> Option<String> {
    std::env::var("DOWZE_SEARXNG_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| Some(DEFAULT_SEARXNG_URL.to_string()))
}
fn searxng_auth() -> (String, String) {
    (
        std::env::var("DOWZE_SEARXNG_USER").unwrap_or_else(|_| SEARXNG_USER.to_string()),
        std::env::var("DOWZE_SEARXNG_PASS").unwrap_or_else(|_| SEARXNG_PASS.to_string()),
    )
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(UA)
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| format!("client HTTP: {e}"))
}

/// Recherche web générale. `engine` optionnel force "searxng" | "duckduckgo" ; sinon auto.
#[tauri::command]
pub async fn web_search(query: String, engine: Option<String>) -> Result<Vec<SearchResult>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Err("Requête vide.".into());
    }
    let searxng = searxng_base();
    let forced = engine.as_deref();

    match forced {
        Some("searxng") => {
            let base = searxng.ok_or("Aucune instance SearXNG configurée (DOWZE_SEARXNG_URL).")?;
            search_searxng(&base, q).await
        }
        Some("duckduckgo") => search_duckduckgo(q).await,
        _ => {
            // Auto : SearXNG si dispo (meilleurs résultats agrégés), sinon DuckDuckGo.
            if let Some(base) = searxng {
                match search_searxng(&base, q).await {
                    Ok(r) if !r.is_empty() => return Ok(r),
                    _ => { /* repli */ }
                }
            }
            search_duckduckgo(q).await
        }
    }
}

/// Interroge une instance SearXNG (API JSON, sans clé). `base` = ex. "http://127.0.0.1:8888".
async fn search_searxng(base: &str, query: &str) -> Result<Vec<SearchResult>, String> {
    let url = format!("{}/search", base.trim_end_matches('/'));
    let (user, pass) = searxng_auth();
    let resp = client()?
        .get(&url)
        .basic_auth(user, Some(pass))
        .query(&[("q", query), ("format", "json"), ("safesearch", "1"), ("language", "fr")])
        .send()
        .await
        .map_err(|e| format!("SearXNG injoignable: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("SearXNG a répondu {}", resp.status()));
    }
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("SearXNG JSON: {e}"))?;
    let items = json.get("results").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let out = items
        .iter()
        .take(8)
        .filter_map(|it| {
            let title = it.get("title")?.as_str()?.trim().to_string();
            let url = it.get("url")?.as_str()?.trim().to_string();
            let snippet = it.get("content").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
            if title.is_empty() || url.is_empty() {
                return None;
            }
            Some(SearchResult { title, url, snippet, source: "searxng".into() })
        })
        .collect();
    Ok(out)
}

/// Recherche via l'endpoint HTML de DuckDuckGo (sans clé). Repli quand SearXNG n'est pas configuré.
async fn search_duckduckgo(query: &str) -> Result<Vec<SearchResult>, String> {
    let resp = client()?
        .get("https://html.duckduckgo.com/html/")
        .query(&[("q", query), ("kl", "fr-fr")])
        .send()
        .await
        .map_err(|e| format!("DuckDuckGo injoignable: {e}"))?;
    let html = resp.text().await.map_err(|e| format!("DuckDuckGo corps: {e}"))?;

    // Parsing hors du runtime async (scraper::Html n'est pas Send) pour ne pas empoisonner le futur.
    let results = tokio::task::spawn_blocking(move || parse_ddg(&html))
        .await
        .map_err(|e| format!("parse DDG: {e}"))?;
    Ok(results)
}

/// Extrait (titre, url réelle, extrait) des résultats DuckDuckGo HTML.
fn parse_ddg(html: &str) -> Vec<SearchResult> {
    use scraper::{Html, Selector};
    let doc = Html::parse_document(html);
    let (Ok(res_sel), Ok(a_sel), Ok(sn_sel)) = (
        Selector::parse("div.result"),
        Selector::parse("a.result__a"),
        Selector::parse("a.result__snippet, div.result__snippet"),
    ) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for res in doc.select(&res_sel) {
        let Some(a) = res.select(&a_sel).next() else { continue };
        let title = a.text().collect::<String>().trim().to_string();
        let raw_href = a.value().attr("href").unwrap_or("").to_string();
        let url = clean_ddg_href(&raw_href);
        if title.is_empty() || url.is_empty() {
            continue;
        }
        let snippet = res
            .select(&sn_sel)
            .next()
            .map(|s| s.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        out.push(SearchResult { title, url, snippet, source: "duckduckgo".into() });
        if out.len() >= 8 {
            break;
        }
    }
    out
}

/// DuckDuckGo enveloppe les liens dans `/l/?uddg=<url encodée>` → on décode l'URL réelle.
fn clean_ddg_href(href: &str) -> String {
    if let Some(idx) = href.find("uddg=") {
        let rest = &href[idx + 5..];
        let enc = rest.split('&').next().unwrap_or(rest);
        if let Ok(dec) = urlencoding::decode(enc) {
            return dec.into_owned();
        }
    }
    if href.starts_with("//") {
        format!("https:{href}")
    } else {
        href.to_string()
    }
}

/// Recherche encyclopédique via l'API officielle Wikipédia (gratuite, sans clé). `lang` défaut "fr".
#[tauri::command]
pub async fn wikipedia_search(query: String, lang: Option<String>) -> Result<Vec<SearchResult>, String> {
    let q = query.trim();
    if q.is_empty() {
        return Err("Requête vide.".into());
    }
    let lang = lang.unwrap_or_else(|| "fr".into());
    let lang = if lang.chars().all(|c| c.is_ascii_alphabetic()) && lang.len() <= 5 { lang } else { "fr".into() };
    let api = format!("https://{lang}.wikipedia.org/w/api.php");

    let resp = client()?
        .get(&api)
        .query(&[
            ("action", "query"),
            ("format", "json"),
            ("list", "search"),
            ("srsearch", q),
            ("srlimit", "6"),
            ("srprop", "snippet"),
        ])
        .send()
        .await
        .map_err(|e| format!("Wikipédia injoignable: {e}"))?;
    let json: serde_json::Value = resp.json().await.map_err(|e| format!("Wikipédia JSON: {e}"))?;
    let hits = json
        .get("query")
        .and_then(|v| v.get("search"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let out = hits
        .iter()
        .filter_map(|h| {
            let title = h.get("title")?.as_str()?.to_string();
            let raw_snip = h.get("snippet").and_then(|v| v.as_str()).unwrap_or("");
            let snippet = strip_html(raw_snip);
            let page = urlencoding::encode(&title.replace(' ', "_")).into_owned();
            let url = format!("https://{lang}.wikipedia.org/wiki/{page}");
            Some(SearchResult { title, url, snippet, source: "wikipedia".into() })
        })
        .collect();
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ddg_href_decoding() {
        let raw = "//duckduckgo.com/l/?uddg=https%3A%2F%2Ffr.wikipedia.org%2Fwiki%2FRust&rut=abc";
        assert_eq!(clean_ddg_href(raw), "https://fr.wikipedia.org/wiki/Rust");
        assert_eq!(clean_ddg_href("//example.com/x"), "https://example.com/x");
    }

    #[test]
    fn strip_html_works() {
        assert_eq!(strip_html("La <span class=\"searchmatch\">photo</span>synthèse"), "La photosynthèse");
    }

    // Tests réseau (tolérants : n'échouent pas si le réseau est indisponible dans le CI/sandbox).
    #[tokio::test]
    async fn wikipedia_live() {
        match wikipedia_search("Photosynthèse".into(), Some("fr".into())).await {
            Ok(v) => { println!("[wikipedia] {} résultats; 1er = {:?}", v.len(), v.first()); assert!(!v.is_empty()); }
            Err(e) => println!("[wikipedia] réseau indisponible: {e}"),
        }
    }

    #[tokio::test]
    async fn ddg_live() {
        match web_search("capitale de la Suisse".into(), Some("duckduckgo".into())).await {
            Ok(v) => println!("[ddg] {} résultats; 1er = {:?}", v.len(), v.first()),
            Err(e) => println!("[ddg] réseau indisponible: {e}"),
        }
    }

    #[tokio::test]
    async fn searxng_live() {
        // Mode auto → doit taper l'instance SearXNG Dowze par défaut (avec basic-auth compilée).
        match web_search("théorème de Pythagore".into(), None).await {
            Ok(v) => {
                println!("[auto] {} résultats; source 1er = {:?}", v.len(), v.first().map(|r| &r.source));
                assert!(!v.is_empty());
            }
            Err(e) => println!("[auto] réseau indisponible: {e}"),
        }
    }
}

/// Nettoie les extraits Wikipédia (qui contiennent des `<span class="searchmatch">`).
fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out.replace("&quot;", "\"").replace("&amp;", "&").replace("&#39;", "'").trim().to_string()
}
