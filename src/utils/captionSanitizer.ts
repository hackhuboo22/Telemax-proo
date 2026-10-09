import { SanitizerResult } from '../types/telegram';

// Regex for Telegram t.me links (public channels, invite links, private hash links, message links)
export const TELEGRAM_LINK_REGEX = /https?:\/\/(?:t(?:elegram)?\.me|telegram\.dog)\/(?:joinchat\/|\+)?([a-zA-Z0-9_\-]+)(?:\/[0-9]+)?/gi;

// Regex for general HTTP / HTTPS URLs and bit.ly / short links
export const GENERAL_URL_REGEX = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;

// Regex for domain-like www URLs without protocol
export const WWW_URL_REGEX = /\bwww\.[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;

// Regex for Telegram @username mentions (e.g., @mychannel, @movies_hub)
export const TELEGRAM_USERNAME_REGEX = /@([a-zA-Z0-9_]{4,32})\b/gi;

// Common spam / promo phrases in Telegram captions
export const PROMO_PHRASES = [
  /join\s+(?:our\s+)?(?:channel|group|backup|chat)(?:\s+for\s+more)?/gi,
  /subscribe\s+(?:to\s+)?(?:our\s+)?(?:channel|group)/gi,
  /click\s+here\s+(?:to\s+join|for\s+link|for\s+more)/gi,
  /join\s+fast\s+👇+/gi,
  /backup\s+channel\s*:\s*/gi,
  /official\s+channel\s*:\s*/gi,
  /download\s+link\s*:\s*/gi,
  /👇+\s*join\s*👇+/gi,
  /👉+\s*link\s*👉+/gi,
];

export interface SanitizeOptions {
  removeTelegramLinks?: boolean;
  removeWebUrls?: boolean;
  removeUsernames?: boolean;
  removePromoPhrases?: boolean;
  customWatermark?: string;
  customBlacklistWords?: string[];
}

export function sanitizeCaption(
  rawCaption: string,
  options: SanitizeOptions = {}
): SanitizerResult {
  const {
    removeTelegramLinks = true,
    removeWebUrls = true,
    removeUsernames = true,
    removePromoPhrases = true,
    customWatermark = '',
    customBlacklistWords = [],
  } = options;

  if (!rawCaption || !rawCaption.trim()) {
    return {
      originalCaption: rawCaption || '',
      cleanedCaption: customWatermark ? customWatermark.trim() : '',
      hasLinks: false,
      linksFound: [],
      removedCount: 0,
    };
  }

  const linksFound: string[] = [];

  // Find all Telegram URLs
  const telegramMatches = rawCaption.match(TELEGRAM_LINK_REGEX);
  if (telegramMatches) {
    linksFound.push(...telegramMatches);
  }

  // Find other URLs
  const urlMatches = rawCaption.match(GENERAL_URL_REGEX);
  if (urlMatches) {
    urlMatches.forEach((url) => {
      if (!linksFound.includes(url)) {
        linksFound.push(url);
      }
    });
  }

  // Find www URLs
  const wwwMatches = rawCaption.match(WWW_URL_REGEX);
  if (wwwMatches) {
    wwwMatches.forEach((w) => {
      if (!linksFound.includes(w)) {
        linksFound.push(w);
      }
    });
  }

  // Find @mentions if requested
  if (removeUsernames) {
    const userMatches = rawCaption.match(TELEGRAM_USERNAME_REGEX);
    if (userMatches) {
      userMatches.forEach((u) => {
        if (!linksFound.includes(u)) {
          linksFound.push(u);
        }
      });
    }
  }

  const hasLinks = linksFound.length > 0;

  // If NO links and NO custom blacklist words and NO promo phrases found,
  // the user's rule states:
  // "and like nahi hai to jaisa share hua hai same dusara group mai video bot share kara ga"
  // (leave it exactly as is, unless watermark is specified)
  let cleaned = rawCaption;

  if (hasLinks || customBlacklistWords.length > 0 || (removePromoPhrases && PROMO_PHRASES.some(p => p.test(rawCaption)))) {
    // 1. Remove Telegram links
    if (removeTelegramLinks) {
      cleaned = cleaned.replace(TELEGRAM_LINK_REGEX, '');
    }

    // 2. Remove General web URLs
    if (removeWebUrls) {
      cleaned = cleaned.replace(GENERAL_URL_REGEX, '');
      cleaned = cleaned.replace(WWW_URL_REGEX, '');
    }

    // 3. Remove @mentions
    if (removeUsernames) {
      cleaned = cleaned.replace(TELEGRAM_USERNAME_REGEX, '');
    }

    // 4. Remove promo keywords
    if (removePromoPhrases) {
      PROMO_PHRASES.forEach((pattern) => {
        cleaned = cleaned.replace(pattern, '');
      });
    }

    // 5. Remove custom blacklist words
    if (customBlacklistWords && customBlacklistWords.length > 0) {
      customBlacklistWords.forEach((word) => {
        if (word.trim()) {
          const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escaped, 'gi');
          cleaned = cleaned.replace(regex, '');
        }
      });
    }

    // Clean up excessive whitespace, multiple empty lines, and dangling symbols
    cleaned = cleaned
      .replace(/[ \t]+/g, ' ') // Collapse multiple spaces
      .replace(/\n\s*\n\s*\n+/g, '\n\n') // Max 2 line breaks
      .replace(/^[\s\-–—:•|·]+|[\s\-–—:•|·]+$/gm, '') // Trim dangling punctuation on lines
      .trim();
  }

  // If a custom watermark / footer was specified, append cleanly
  if (customWatermark && customWatermark.trim()) {
    if (cleaned) {
      cleaned = `${cleaned}\n\n${customWatermark.trim()}`;
    } else {
      cleaned = customWatermark.trim();
    }
  }

  return {
    originalCaption: rawCaption,
    cleanedCaption: cleaned,
    hasLinks,
    linksFound,
    removedCount: linksFound.length,
  };
}
