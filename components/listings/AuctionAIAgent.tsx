import { useState, useRef, useEffect } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

// Define the AuctionResult type
export type AuctionResult = {
  title: string;
  sold_price: string;
  bid_amount: string;
  sold_date: string;
  status: string;
  url: string;
  image_url?: string;
  make?: string;
  model?: string;
  images?: {
    small?: {
      url: string;
      width: number;
      height: number;
    };
    large?: {
      url: string;
      width: number;
      height: number;
    };
  };
  price?: number;
};

// Helper function to convert URLs in text to clickable links
const formatMessageWithLinks = (text: string): React.ReactNode[] => {
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

  try {
    // Simple approach: directly look for markdown links with regex
    // This is more reliable for the specific format we're seeing
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
};

type AuctionAIAgentProps = {
  auctionResults: AuctionResult[];
};

export default function AuctionAIAgent({ auctionResults }: AuctionAIAgentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of messages when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when agent is opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    // Add user message
    const userMessage: Message = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input
    setQuery('');
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Format auction results to ensure price values are properly handled
      const formattedAuctionResults = auctionResults.map(result => {
        // Extract numeric price values if available
        let price: string | number | null = null;
        
        if (result.status === 'sold' && result.sold_price) {
          // Extract numeric value from sold_price string
          const numericPrice = result.sold_price.replace(/[^0-9.]/g, '');
          price = numericPrice ? parseFloat(numericPrice) : null;
        } else if (result.bid_amount) {
          // Extract numeric value from bid_amount string
          const numericPrice = result.bid_amount.replace(/[^0-9.]/g, '');
          price = numericPrice ? parseFloat(numericPrice) : null;
        } else if (result.price) {
          // Use price field if available
          price = result.price;
        }
        
        return {
          title: result.title,
          price: price,
          sold_price: result.status === 'sold' ? result.sold_price : null,
          bid_amount: result.status !== 'sold' ? result.bid_amount : null,
          status: result.status,
          sold_date: result.sold_date || null,
          url: result.url,
          make: result.make || result.title.split(' ')[1] || '',
          model: result.model || result.title.split(' ')[2] || '',
          image_url: result.image_url || (result.images?.small?.url || null)
        };
      });
      
      // Send query to API with current auction results context
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          context: {
            auctionResults: formattedAuctionResults,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from AI agent');
      }
      
      const data = await response.json();
      
      // Add assistant message
      const assistantMessage: Message = { role: 'assistant', content: data.response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error querying AI agent:', error);
      
      // Add error message
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg flex items-center justify-center"
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden flex flex-col" style={{ height: '500px' }}>
          {/* Header */}
          <div className="bg-blue-600 text-white p-4">
            <h3 className="font-medium">Auction Results AI Assistant</h3>
            <p className="text-sm text-blue-100">Ask questions about the auction results</p>
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 my-8">
                <p>Ask me questions about the auction results!</p>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg inline-block cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => setQuery("What's the highest selling price?")}>What's the highest selling price?</p>
                  <p className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg inline-block cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => setQuery("What's the average selling price?")}>What's the average selling price?</p>
                  <p className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg inline-block cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => setQuery("Which auction had the best deal?")}>Which auction had the best deal?</p>
                  <p className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg inline-block cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => setQuery("What percentage of auctions resulted in a sale?")}>What percentage of auctions resulted in a sale?</p>
                  <p className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg inline-block cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => setQuery("Summarize these auction results for me")}>Summarize these auction results for me</p>
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {message.role === 'user' ? (
                      message.content
                    ) : (
                      formatMessageWithLinks(message.content)
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-3 bg-gray-100 dark:bg-gray-700">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t dark:border-gray-700">
            <div className="flex">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about these auction results..."
                className="flex-1 border rounded-l-md p-2 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-r-md px-4 py-2 disabled:bg-blue-400"
                disabled={isLoading || !query.trim()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
} 