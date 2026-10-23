import { fetchWithTimeout } from "./http.ts";
import { TTLCache } from "./cache.ts";

type Rule = { allow: boolean; pattern: string };

const robotsCache = new TTLCache<Rule[]>(6 * 60 * 60 * 1000);

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

export async function robotsAllows(base: string, pathWithQuery: string): Promise<boolean> {
  let rules = robotsCache.get(base);
  if (!rules) {
    try {
      const res = await fetchWithTimeout(`${base}/robots.txt`, 5000, "text/plain");
      rules = res.ok ? parseRobots(await res.text()) : [];
    } catch {
      rules = [];
    }
    robotsCache.set(base, rules);
  }
  return isPathAllowed(rules, pathWithQuery);
}
