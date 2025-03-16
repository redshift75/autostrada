/**
 * Decodes HTML entities in a string using the browser's built-in HTML parsing
 * @param text - The text containing HTML entities to decode
 * @returns The decoded text with proper characters
 */
export const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}; 