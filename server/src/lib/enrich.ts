import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';

const BOT_PATTERN =
  /bot|crawler|spider|crawling|slurp|mediapartners|facebookexternalhit|bingpreview|lighthouse|headlesschrome|phantomjs|pingdom|uptimerobot|ahrefs|semrush|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|anthropic-ai|applebot|yandex|baiduspider|duckduckbot|curl\/|wget\/|python-requests|go-http-client/i;

export function isBot(userAgent: string): boolean {
  if (!userAgent || userAgent.trim().length < 8) return true;
  return BOT_PATTERN.test(userAgent);
}

const KNOWN_SOURCES: Record<string, { name: string; channel: string }> = {
  // Search
  'google.com': { name: 'Google', channel: 'Organic Search' },
  'google.co.uk': { name: 'Google', channel: 'Organic Search' },
  'google.com.br': { name: 'Google', channel: 'Organic Search' },
  'google.de': { name: 'Google', channel: 'Organic Search' },
  'google.fr': { name: 'Google', channel: 'Organic Search' },
  'google.es': { name: 'Google', channel: 'Organic Search' },
  'google.ca': { name: 'Google', channel: 'Organic Search' },
  'bing.com': { name: 'Bing', channel: 'Organic Search' },
  'duckduckgo.com': { name: 'DuckDuckGo', channel: 'Organic Search' },
  'search.brave.com': { name: 'Brave', channel: 'Organic Search' },
  'search.yahoo.com': { name: 'Yahoo', channel: 'Organic Search' },
  'ecosia.org': { name: 'Ecosia', channel: 'Organic Search' },
  'kagi.com': { name: 'Kagi', channel: 'Organic Search' },
  'yandex.com': { name: 'Yandex', channel: 'Organic Search' },
  'baidu.com': { name: 'Baidu', channel: 'Organic Search' },

  // AI Assistants
  'chatgpt.com': { name: 'ChatGPT', channel: 'AI Assistants' },
  'chat.openai.com': { name: 'ChatGPT', channel: 'AI Assistants' },
  'perplexity.ai': { name: 'Perplexity', channel: 'AI Assistants' },
  'claude.ai': { name: 'Claude', channel: 'AI Assistants' },
  'gemini.google.com': { name: 'Gemini', channel: 'AI Assistants' },
  'copilot.microsoft.com': { name: 'Copilot', channel: 'AI Assistants' },

  // Social
  't.co': { name: 'X / Twitter', channel: 'Organic Social' },
  'x.com': { name: 'X / Twitter', channel: 'Organic Social' },
  'twitter.com': { name: 'X / Twitter', channel: 'Organic Social' },
  'reddit.com': { name: 'Reddit', channel: 'Organic Social' },
  'old.reddit.com': { name: 'Reddit', channel: 'Organic Social' },
  'linkedin.com': { name: 'LinkedIn', channel: 'Organic Social' },
  'lnkd.in': { name: 'LinkedIn', channel: 'Organic Social' },
  'facebook.com': { name: 'Facebook', channel: 'Organic Social' },
  'm.facebook.com': { name: 'Facebook', channel: 'Organic Social' },
  'l.facebook.com': { name: 'Facebook', channel: 'Organic Social' },
  'instagram.com': { name: 'Instagram', channel: 'Organic Social' },
  'l.instagram.com': { name: 'Instagram', channel: 'Organic Social' },
  'news.ycombinator.com': { name: 'Hacker News', channel: 'Organic Social' },
  'bsky.app': { name: 'Bluesky', channel: 'Organic Social' },
  'threads.net': { name: 'Threads', channel: 'Organic Social' },
  'mastodon.social': { name: 'Mastodon', channel: 'Organic Social' },
  'pinterest.com': { name: 'Pinterest', channel: 'Organic Social' },
  'tiktok.com': { name: 'TikTok', channel: 'Organic Social' },

  // Video
  'youtube.com': { name: 'YouTube', channel: 'Organic Video' },
  'm.youtube.com': { name: 'YouTube', channel: 'Organic Video' },
  'youtu.be': { name: 'YouTube', channel: 'Organic Video' },
  'vimeo.com': { name: 'Vimeo', channel: 'Organic Video' },

  // Developer / Referral
  'github.com': { name: 'GitHub', channel: 'Referral' },
  'producthunt.com': { name: 'Product Hunt', channel: 'Referral' },
  'substack.com': { name: 'Substack', channel: 'Referral' },
  'medium.com': { name: 'Medium', channel: 'Referral' },

  // Email
  'mail.google.com': { name: 'Gmail', channel: 'Email' },
  'outlook.live.com': { name: 'Outlook', channel: 'Email' },
};

export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

export function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  let clean = pathname.split('?')[0].split('#')[0];
  if (!clean.startsWith('/')) clean = '/' + clean;
  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }
  return clean.slice(0, 500);
}

export interface AttributionResult {
  channel: string;
  referrerSource: string;
  referrerDomain: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

export function classifyAttribution(
  urlObj: URL,
  rawReferrer: string | null | undefined,
  siteDomain: string
): AttributionResult {
  const utmSource = urlObj.searchParams.get('utm_source')?.trim() || null;
  const utmMedium = urlObj.searchParams.get('utm_medium')?.trim() || null;
  const utmCampaign = urlObj.searchParams.get('utm_campaign')?.trim() || null;

  let referrerDomain: string | null = null;
  if (rawReferrer) {
    try {
      const refUrl = new URL(rawReferrer);
      const host = normalizeDomain(refUrl.hostname);
      const cleanSite = normalizeDomain(siteDomain);
      // Ignore self-referrals (same domain or subdomain)
      if (host && host !== cleanSite && !host.endsWith(`.${cleanSite}`)) {
        referrerDomain = host;
      }
    } catch {
      referrerDomain = null;
    }
  }

  const mediumLower = (utmMedium || '').toLowerCase();
  const known = referrerDomain
    ? KNOWN_SOURCES[referrerDomain] ||
      (referrerDomain.startsWith('google.')
        ? { name: 'Google', channel: 'Organic Search' }
        : null)
    : null;

  // Determine source label
  let referrerSource = 'Direct / None';
  if (utmSource) {
    const srcLower = utmSource.toLowerCase();
    const mapped =
      KNOWN_SOURCES[`${srcLower}.com`] ||
      Object.values(KNOWN_SOURCES).find((v) => v.name.toLowerCase() === srcLower);
    referrerSource = mapped ? mapped.name : utmSource;
  } else if (known) {
    referrerSource = known.name;
  } else if (referrerDomain) {
    referrerSource = referrerDomain;
  }

  // Determine channel
  let channel = 'Direct';
  if (mediumLower) {
    if (/(cpc|ppc|paidsearch|paid_search|sem)/.test(mediumLower)) {
      channel = 'Paid Search';
    } else if (/(paid_social|paidsocial|social_paid)/.test(mediumLower)) {
      channel = 'Paid Social';
    } else if (/(social|sm)/.test(mediumLower)) {
      channel = 'Organic Social';
    } else if (/(email|newsletter|e-mail)/.test(mediumLower)) {
      channel = 'Email';
    } else if (/(affiliate|affiliates|partner)/.test(mediumLower)) {
      channel = 'Affiliates';
    } else if (/(video)/.test(mediumLower)) {
      channel = 'Organic Video';
    } else if (/(display|banner|cpm)/.test(mediumLower)) {
      channel = 'Display';
    } else if (/(referral)/.test(mediumLower)) {
      channel = 'Referral';
    } else if (known) {
      channel = known.channel;
    } else {
      channel = 'Referral';
    }
  } else if (known) {
    channel = known.channel;
  } else if (referrerDomain) {
    channel = 'Referral';
  } else if (utmSource) {
    channel = 'Referral';
  }

  return {
    channel,
    referrerSource,
    referrerDomain,
    utmSource,
    utmMedium,
    utmCampaign,
  };
}

export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
}

export function parseDeviceInfo(userAgent: string, screenWidth?: number): DeviceInfo {
  const parser = new UAParser(userAgent);
  const browserRaw = parser.getBrowser().name || '';
  const osRaw = parser.getOS().name || '';
  const deviceType = parser.getDevice().type;

  // Clean browser names
  let browser = browserRaw || '(not set)';
  if (browser.includes('Chrome') && !browser.includes('Edge')) browser = 'Chrome';
  else if (browser.includes('Safari')) browser = 'Safari';
  else if (browser.includes('Edge')) browser = 'Microsoft Edge';
  else if (browser.includes('Firefox')) browser = 'Firefox';
  else if (browser.includes('Opera')) browser = 'Opera';
  else if (browser.includes('Samsung')) browser = 'Samsung Browser';

  // Clean OS names
  let os = osRaw || '(not set)';
  if (os === 'Mac OS') os = 'Mac';
  else if (os === 'Linux') os = 'GNU/Linux';

  // Device type using UA + viewport width fallback
  let device = 'Desktop';
  if (deviceType === 'mobile') {
    device = 'Mobile';
  } else if (deviceType === 'tablet') {
    device = 'Tablet';
  } else if (typeof screenWidth === 'number' && screenWidth > 0) {
    if (screenWidth < 768) device = 'Mobile';
    else if (screenWidth < 1024 && (os === 'iOS' || os === 'Android' || os === 'iPadOS')) {
      device = 'Tablet';
    }
  }

  return { browser, os, device };
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith('fc') ||
    ip.startsWith('fd') ||
    ip.startsWith('fe80:')
  );
}

export function resolveCountry(
  ip: string,
  headers: { get(name: string): string | undefined }
): string | null {
  // 1. Trust standard CDN / reverse-proxy headers if present
  const headerCountry =
    headers.get('cf-ipcountry') ||
    headers.get('x-vercel-ip-country') ||
    headers.get('x-country-code');

  if (
    headerCountry &&
    /^[A-Z]{2}$/i.test(headerCountry) &&
    headerCountry.toUpperCase() !== 'XX' &&
    headerCountry.toUpperCase() !== 'T1'
  ) {
    return headerCountry.toUpperCase();
  }

  // 2. 100% offline local lookup via geoip-lite (zero external calls, no IPs ever leave the server)
  if (!ip) return null;
  const cleanIp = ip.replace(/^::ffff:/, '').trim();
  if (!cleanIp || isPrivateIp(cleanIp)) return null;

  const geo = geoip.lookup(cleanIp);
  return geo?.country || null;
}
