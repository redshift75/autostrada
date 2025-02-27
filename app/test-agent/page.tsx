'use client';

import { useState } from 'react';

export default function TestAgentPage() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sample queries for testing
  const sampleQueries = [
    "What's the current market value of a 1973 Porsche 911 Carrera RS?",
    "How have Ferrari Testarossa prices changed over the last 5 years?",
    "Compare the investment potential of a Mercedes 300SL Gullwing versus an Aston Martin DB5",
    "What are the most collectible classic cars under $100,000?",
    "Is now a good time to buy a classic Jaguar E-Type?"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }
    
    setLoading(true);
    setError('');
    setResponse('');
    
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response from agent');
      }
      
      setResponse(data.response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const useSampleQuery = (sample: string) => {
    setQuery(sample);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Classic Car Market Intelligence Agent</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Sample Queries</h2>
        <div className="flex flex-wrap gap-2">
          {sampleQueries.map((sample, index) => (
            <button
              key={index}
              onClick={() => useSampleQuery(sample)}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label htmlFor="query" className="block text-sm font-medium mb-2">
            Ask about classic cars:
          </label>
          <textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md"
            rows={3}
            placeholder="e.g., What's the current market value of a 1973 Porsche 911 Carrera RS?"
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
        >
          {loading ? 'Processing...' : 'Submit Query'}
        </button>
      </form>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
          {error}
        </div>
      )}
      
      {response && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Agent Response:</h2>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md whitespace-pre-wrap">
            {response}
          </div>
        </div>
      )}
    </div>
  );
} 