import { fetchWithTimeout } from "./http.ts";
import { TTLCache } from "./cache.ts";

type Rule = { allow: boolean; pattern: string };
type Robots = { rules: Rule[]; crawlDelay: number | null };

const robotsCache = new TTLCache<Robots>(6 * 60 * 60 * 1000);

/** Crawl-delay (segundos) pedido a cualquier bot; null si no pide */
export function parseCrawlDelay(txt: string): number | null {
  let agents: string[] = [];
  let inRules = false;
  let delay: number | null = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === "user-agent") {
      if (inRules) { agents = []; inRules = false; }
      agents.push(val.toLowerCase());
    } else {
      inRules = true;
      if (key === "crawl-delay" && (agents.includes("*") || agents.some((a) => a.startsWith("cazacartas")))) {
        const n = Number(val);
        if (Number.isFinite(n)) delay = Math.max(delay ?? 0, n);
      }
    }
  }
  return delay;
}

/** Lee las reglas de robots.txt que aplican a cualquier bot (User-agent: *) */
export function parseRobots(txt: string): Rule[] {
  const rules: Rule[] = [];
  let agents: string[] = [];
  let inRules = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === "user-agent") {
      if (inRules) {
        agents = [];
        inRules = false;
      }
      agents.push(val.toLowerCase());
    } else if (key === "allow" || key === "disallow") {
      inRules = true;
      const applies = agents.includes("*") || agents.some((a) => a.startsWith("cazacartas"));
      if (applies && val) rules.push({ allow: key === "allow", pattern: val });
    }
  }
  return rules;
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp(
    "^" + body.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : "")
  );
  return re.test(path);
}

/** La regla más específica (patrón más largo) gana; si empatan, gana Allow */
export function isPathAllowed(rules: Rule[], path: string): boolean {
  let best: Rule | null = null;
  for (const r of rules) {
    if (!matches(r.pattern, path)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

async function loadRobots(base: string): Promise<Robots> {
  let r = robotsCache.get(base);
  if (!r) {
    try {
      const res = await fetchWithTimeout(`${base}/robots.txt`, 5000, "text/plain");
      const txt = res.ok ? await res.text() : "";
      r = { rules: parseRobots(txt), crawlDelay: parseCrawlDelay(txt) };
    } catch {
      r = { rules: [], crawlDelay: null };
    }
    robotsCache.set(base, r);
  }
  return r;
}

export async function robotsAllows(base: string, pathWithQuery: string): Promise<boolean> {
  return isPathAllowed((await loadRobots(base)).rules, pathWithQuery);
}

/** Segundos que la tienda pide esperar entre consultas (Crawl-delay), o null */
export async function robotsCrawlDelay(base: string): Promise<number | null> {
  return (await loadRobots(base)).crawlDelay;
}
