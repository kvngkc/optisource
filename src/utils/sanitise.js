/**
 * Strips all HTML/script tags from a string and trims whitespace.
 * Safe to apply before any DB insert on free-text fields.
 * @param {string} str - Raw input
 * @param {number} maxLen - Maximum length (default 255)
 * @returns {string}
 */
export function sanitise(str, maxLen = 255) {
  if (!str) return ''
  return String(str)
    .replace(/<[^>]*>/g, '')        // strip all HTML tags
    .replace(/[<>'"]/g, '')         // strip remaining dangerous chars
    .trim()
    .slice(0, maxLen)
}
