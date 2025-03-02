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

// Helper function to improve formatting by replacing ' - ' with newlines
const improveFormatting = (text: string): string => {
  // For debugging in development
  const isDebug = process.env.NODE_ENV === 'development';
  
  // Check for the exact pattern from the example
  const auctionPattern = /(\d+\.\s+\*\*[\w\s]+\*\*)\s+-\s+(\*\*Sold Price:\*\*\s+\$[\d,]+)\s+-\s+(\*\*Average Price for Similar Vehicles:\*\*\s+\$[\d,]+)\s+-\s+(\*\*Percent Below Average:\*\*\s+\d+%)\s+-\s+(\*\*Date Sold:\*\*\s+[\d\/]+)\s+-\s+(\*\*View Listing\*\*)/g;
  
  if (text.match(auctionPattern)) {
    if (isDebug) console.log('Exact auction pattern match found');
    
    // Replace with perfect formatting for this exact pattern
    return text.replace(auctionPattern, 
      '$1\n$2\n$3\n$4\n$5\n$6'
    );
  }
  
  // First, handle the specific auction listing format from the example
  if (text.includes("**Sold Price:**") && text.includes("**Average Price for Similar Vehicles:**")) {
    if (isDebug) console.log('Detected auction listing format');
    
    // This is likely an auction listing format
    
    // Step 1: Format the numbered list items
    let formattedText = text.replace(/(\d+\.\s+\*\*[\w\s]+\*\*)\s+-\s+/g, '$1\n');
    if (isDebug && formattedText !== text) console.log('Step 1 applied');
    
    // Step 2: Replace " - " between key details with newlines
    const step2a = formattedText.replace(/(\*\*[\w\s:]+\*\*:?\s*[$\d,]+)\s+-\s+/g, '$1\n');
    if (isDebug && step2a !== formattedText) console.log('Step 2a applied');
    formattedText = step2a;
    
    const step2b = formattedText.replace(/(\*\*[\w\s:]+\*\*:?\s*[\w\s\/]+)\s+-\s+/g, '$1\n');
    if (isDebug && step2b !== formattedText) console.log('Step 2b applied');
    formattedText = step2b;
    
    const step2c = formattedText.replace(/(\d+%)\s+-\s+/g, '$1\n');
    if (isDebug && step2c !== formattedText) console.log('Step 2c applied');
    formattedText = step2c;
    
    // Step 3: Handle "View Listing" at the end of each item
    const step3 = formattedText.replace(/(\*\*Date Sold:\*\*\s*[\d\/]+)\s+-\s+(\*\*View Listing\*\*)/g, '$1\n$2');
    if (isDebug && step3 !== formattedText) console.log('Step 3 applied');
    formattedText = step3;
    
    if (isDebug) {
      console.log('Original text:', text);
      console.log('Formatted text:', formattedText);
    }
    
    return formattedText;
  }
  
  // For other general cases, apply a more generic approach
  if (isDebug) console.log('Using generic formatting approach');
  
  let formattedText = text;
  
  // Replace " - " after bold text or after a colon with a newline
  const step1 = formattedText.replace(/(\*\*[^*]+\*\*)\s+-\s+/g, '$1\n');
  if (isDebug && step1 !== formattedText) console.log('Generic step 1 applied');
  formattedText = step1;
  
  const step2 = formattedText.replace(/([^-]+:)\s+-\s+/g, '$1\n');
  if (isDebug && step2 !== formattedText) console.log('Generic step 2 applied');
  formattedText = step2;
  
  // Replace " - " before bold text with a newline
  const step3 = formattedText.replace(/\s+-\s+(\*\*)/g, '\n$1');
  if (isDebug && step3 !== formattedText) console.log('Generic step 3 applied');
  formattedText = step3;
  
  // Replace " - " after percentages or numbers with a newline
  const step4 = formattedText.replace(/(\d+%|\$\d+(?:,\d+)*)\s+-\s+/g, '$1\n');
  if (isDebug && step4 !== formattedText) console.log('Generic step 4 applied');
  formattedText = step4;
  
  if (isDebug) {
    console.log('Original text:', text);
    console.log('Formatted text:', formattedText);
  }
  
  return formattedText;
};

// Helper function to convert URLs in text to clickable links
export function formatMessageWithLinks(text: string): React.ReactNode[] {
  try {
    // First improve the formatting
    const formattedText = improveFormatting(text);
    
    // Simple approach: directly look for markdown links with regex
    const result: React.ReactNode[] = [];
    
    // Pattern for markdown links: [text](url)
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    let lastIndex = 0;
    let match;
    
    // Reset the regex
    linkPattern.lastIndex = 0;
    
    // Find all markdown links
    while ((match = linkPattern.exec(formattedText)) !== null) {
      const [fullMatch, linkText, url] = match;
      const matchIndex = match.index;
      
      // Add text before the link
      if (matchIndex > lastIndex) {
        // Handle newlines in the text
        const textBeforeLink = formattedText.substring(lastIndex, matchIndex);
        if (textBeforeLink.includes('\n')) {
          const segments = textBeforeLink.split('\n');
          for (let i = 0; i < segments.length; i++) {
            result.push(segments[i]);
            if (i < segments.length - 1) {
              result.push(<br key={`br-${i}-${Math.random().toString(36).substring(2, 9)}`} />);
            }
          }
        } else {
          result.push(textBeforeLink);
        }
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
    if (lastIndex < formattedText.length) {
      const remainingText = formattedText.substring(lastIndex);
      if (remainingText.includes('\n')) {
        const segments = remainingText.split('\n');
        for (let i = 0; i < segments.length; i++) {
          result.push(segments[i]);
          if (i < segments.length - 1) {
            result.push(<br key={`br-end-${i}-${Math.random().toString(36).substring(2, 9)}`} />);
          }
        }
      } else {
        result.push(remainingText);
      }
    }
    
    return result.length > 0 ? result : [formattedText];
  } catch (error) {
    console.error('Error processing links:', error);
    return [text]; // Return original text if there's an error
  }
} 