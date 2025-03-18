import { useState, useRef, useEffect } from 'react';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

// Generic interface for common data properties
export interface DataFormatter<T> {
  formatData: (data: T[]) => any;
}

interface AIAgentProps {
  title: string;
  subtitle: string;
  initialSuggestions?: string[];
  formatData: (data: any[]) => any;
  data: any[];
}

/**
 * A reusable AI Agent component that can be extended for different data types
 */
export default function AIAgent({ 
  title, 
  subtitle, 
  initialSuggestions = [], 
  formatData, 
  data 
}: AIAgentProps) {
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
      // Format data for the API
      const formattedData = formatData(data);
      
      // Send query to API with current context
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          context: formattedData,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from AI agent');
      }
      
      const responseData = await response.json();
      
      // Add assistant message
      const assistantMessage: Message = { role: 'assistant', content: responseData.response };
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
        className="group bg-blue-600 hover:bg-blue-700 text-white rounded-full p-5 shadow-lg flex items-center gap-3 transition-all duration-300 animate-fade-in"
        aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
      >
        {isOpen ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span className="pr-2">Close Assistant</span>
          </>
        ) : (
          <>
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-300"></span>
              </span>
            </div>
            <span className="pr-2">Ask AI Assistant</span>
          </>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-96 sm:w-[450px] bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden flex flex-col" style={{ height: '500px' }}>
          {/* Header */}
          <div className="bg-blue-600 text-white p-4">
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-blue-100">{subtitle}</p>
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 my-8">
                <p>Ask me questions about the data!</p>
                {initialSuggestions.length > 0 && (
                  <div className="mt-4 space-y-2 text-sm">
                    {initialSuggestions.map((suggestion, index) => (
                      <p 
                        key={index}
                        className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg inline-block cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600" 
                        onClick={() => setQuery(suggestion)}
                      >
                        {suggestion}
                      </p>
                    ))}
                  </div>
                )}
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
                      <ReactMarkdown
                        components={{
                          pre: ({ children, className, ...props }) => (
                            <div className="overflow-auto my-2 bg-gray-800 dark:bg-gray-900 rounded-lg p-2">
                              <pre className={className} {...props}>
                                {children}
                              </pre>
                            </div>
                          )
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
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
            <div className="flex space-x-2">
              <input
                type="text"
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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