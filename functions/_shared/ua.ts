/**
 * Reads a User-Agent and the Cloudflare network into the labels the visitor ledger stores (AIOS
 * state/VISITORS.md): browser and operating system for people, a crawler's name for machines that
 * say who they are, and a reason for machines that don't. A copy of markszymanski.co's
 * functions/_shared/ua.ts without the page-count groups, so both sites label a visitor the same
 * way in the one visitors table; change both together.
 */

export const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|puppeteer|playwright|phantom|python-|curl|wget|google-safety/i;

// Hosting networks, a short copy of the mjs.link Worker's list (AIOS state/links-worker). Akamai
// (20940) is on it and also carries some iCloud Private Relay traffic, which is why a match is a
// label and not a drop: a real person on it still shows signs of life.
export const DC_ASNS = new Set([24940, 213230, 16276, 14061, 16509, 14618, 8075, 63949, 20940, 51167, 20473, 12876, 9009, 396982, 31898, 45102, 132203, 202053, 25697, 36040]);

// Crawlers that name themselves, most AI first. Checked before BOT_UA so each gets its own name.
const CRAWLERS: [RegExp, string][] = [
  [/GPTBot/i, "GPTBot"], [/ChatGPT-User/i, "ChatGPT-User"], [/OAI-SearchBot/i, "OAI-SearchBot"],
  [/ClaudeBot/i, "ClaudeBot"], [/Claude-User/i, "Claude-User"], [/Claude-SearchBot/i, "Claude-SearchBot"],
  [/anthropic-ai/i, "anthropic-ai"], [/PerplexityBot/i, "PerplexityBot"], [/Perplexity-User/i, "Perplexity-User"],
  [/MistralAI-User/i, "MistralAI-User"], [/cohere-ai/i, "cohere-ai"], [/Bytespider/i, "Bytespider"],
  [/CCBot/i, "CCBot"], [/meta-externalagent/i, "Meta-ExternalAgent"], [/Amazonbot/i, "Amazonbot"],
  [/Applebot/i, "Applebot"], [/DuckAssistBot/i, "DuckAssistBot"], [/YouBot/i, "YouBot"], [/Diffbot/i, "Diffbot"],
  [/Googlebot|Google-InspectionTool|GoogleOther/i, "Googlebot"], [/bingbot/i, "Bingbot"], [/DuckDuckBot/i, "DuckDuckBot"],
  [/YandexBot/i, "YandexBot"], [/Baiduspider/i, "Baiduspider"], [/PetalBot/i, "PetalBot"],
  [/AhrefsBot/i, "AhrefsBot"], [/SemrushBot/i, "SemrushBot"], [/MJ12bot/i, "MJ12bot"], [/DotBot/i, "DotBot"],
  [/facebookexternalhit|FacebookBot/i, "Facebook"], [/Twitterbot/i, "Twitterbot"], [/LinkedInBot/i, "LinkedInBot"],
  [/Slackbot/i, "Slackbot"], [/Discordbot/i, "Discordbot"], [/TelegramBot/i, "TelegramBot"], [/WhatsApp/i, "WhatsApp"],
];

export function crawlerName(ua: string): string | null {
  for (const [re, name] of CRAWLERS) if (re.test(ua)) return name;
  return null;
}

/** Why a request is a machine, or null for something that looks like a person's browser. */
export function machineLabel(ua: string, asn: unknown): string | null {
  if (!ua) return "no-ua";
  const c = crawlerName(ua);
  if (c) return `crawler:${c}`;
  if (BOT_UA.test(ua)) return "bot-ua";
  if (asn && DC_ASNS.has(Number(asn))) return "hosting-network";
  return null;
}

export function deviceOf(ua: string): string {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? "mobile" : "desktop";
}

// Order matters: Edge, Opera, and Samsung all also say Chrome, and Chrome also says Safari.
const BROWSERS: [RegExp, string][] = [
  [/(?:Edg|EdgA|EdgiOS)\/(\d+)/, "Edge"], [/(?:OPR|Opera)\/(\d+)/, "Opera"],
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"], [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
  [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"], [/Version\/(\d+)[^ ]* .*Safari/, "Safari"],
];

export function browserOf(ua: string): string {
  for (const [re, name] of BROWSERS) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1]}`;
  }
  return "Other";
}

export function osOf(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}
