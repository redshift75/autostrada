import * as React from 'react';

// Function to ensure URL has proper format
const formatUrl = (url: string): string => {
  // If URL doesn't have a protocol, add https://
  if (!url.match(/^https?:\/\//i)) {
    // If it starts with www., just add https://
    if (url.startsWith('www.')) {
      return `https://${url}`;
    }
    // Otherwise add https://www.
    return `https://www.${url}`;
  }
  return url;
};

// Helper function to convert URLs in text to clickable links
export function formatMessageWithLinks(text: string): React.ReactNode[] {
  try {
    // Simple approach: directly look for markdown links with regex
    const result: React.ReactNode[] = [];
    
    // Pattern for markdown links: [text](url)
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    let lastIndex = 0;
    let match;
    
    // Reset the regex
    linkPattern.lastIndex = 0;
    
    // Find all markdown links
    while ((match = linkPattern.exec(text)) !== null) {
      const [fullMatch, linkText, url] = match;
      const matchIndex = match.index;
      
      // Add text before the link
      if (matchIndex > lastIndex) {
        result.push(text.substring(lastIndex, matchIndex));
      }
      
      // Format the URL properly
      const formattedUrl = formatUrl(url);
      
      // Add the link as a React element
      result.push(
        <a 
          key={`link-${Math.random().toString(36).substring(2, 9)}`}
          href={formattedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          {linkText}
        </a>
      );
      
      lastIndex = matchIndex + fullMatch.length;
    }
    
    // Add any remaining text
    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }
    
    return result.length > 0 ? result : [text];
  } catch (error) {
    console.error('Error processing links:', error);
    return [text]; // Return original text if there's an error
  }
} 