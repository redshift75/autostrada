/**
 * Decodes HTML entities in a string using the browser's built-in HTML parsing
 * @param text - The text containing HTML entities to decode
 * @returns The decoded text with proper characters
 */
export const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x2F;': '/',
    '&nbsp;': ' ',
    '&copy;': '©',
    '&reg;': '®',
    '&deg;': '°',
    '&trade;': '™',
    '&euro;': '€',
    '&pound;': '£',
    '&cent;': '¢',
    '&mdash;': '—',
    '&ndash;': '–'
  };

  // Replace numeric entities (both decimal and hexadecimal)
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Replace named entities
  return text.replace(/&[a-z0-9]+;/gi, entity => entities[entity] || entity);
}; 