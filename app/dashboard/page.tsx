'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Define types for auction results
type AuctionResult = {
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
};

export default function Dashboard() {
  const [visualizations, setVisualizations] = useState<{
    timeSeriesChart?: string;
    priceHistogram?: string;
  } | null>(null);
  
  const [summary, setSummary] = useState<{
    totalResults?: number;
    averageSoldPrice?: string;
    highestSoldPrice?: string;
    lowestSoldPrice?: string;
    soldPercentage?: string;
  } | null>(null);
  
  const [results, setResults] = useState<AuctionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchVisualizations() {
      try {
        setLoading(true);
        const response = await fetch('/api/visualizations/latest');
        
        if (!response.ok) {
          throw new Error(`Error fetching visualizations: ${response.statusText}`);
        }
        
        const data = await response.json();
        setVisualizations(data.visualizations);
        setSummary(data.summary);
        
        // Set auction results if available
        if (data.results && Array.isArray(data.results)) {
          setResults(data.results);
        }
      } catch (err) {
        console.error('Error fetching visualizations:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }
    
    fetchVisualizations();
  }, []);
  
  // Function to extract image URL from auction title or use a placeholder
  const getImageUrl = (result: AuctionResult) => {
    // First check if we have the images object with small image URL from BAT API
    if (result.images && result.images.small && result.images.small.url) {
      return result.images.small.url;
    }
    
    // Fall back to image_url if available
    if (result.image_url) return result.image_url;
    
    // Use placeholder as last resort
    const make = result.make || 'Car';
    const model = result.model || '';
    return `https://via.placeholder.com/100x75?text=${make}+${model}`;
  };
  
  // Function to format price for display
  const formatPrice = (price: string) => {
    if (price === 'Not sold') return 'Not sold';
    return price;
  };
  
  // Extract make and model from title if not provided
  const extractMakeModel = (result: AuctionResult) => {
    if (result.make && result.model) {
      return { make: result.make, model: result.model };
    }
    
    // Try to extract from title
    const titleParts = result.title.split(' ');
    if (titleParts.length >= 2) {
      return {
        make: titleParts[0],
        model: titleParts[1]
      };
    }
    
    return { make: 'Unknown', model: '' };
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Auction Results Dashboard</h1>
      
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-600">View and analyze auction results for classic cars.</p>
        <Link 
          href="/dashboard/generate"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Generate New Visualizations
        </Link>
      </div>
      
      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          <p className="mt-2">
            Please make sure you have generated visualizations first by running one of the test scripts.
          </p>
        </div>
      )}
      
      {!loading && !error && summary && (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left column - Summary and Visualizations */}
          <div className="lg:w-2/3">
            <div className="bg-white shadow-md rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-500 text-sm">Total Results</p>
                  <p className="text-2xl font-bold">{summary.totalResults}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-500 text-sm">Average Sold Price</p>
                  <p className="text-2xl font-bold">{summary.averageSoldPrice}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-500 text-sm">Highest Sold Price</p>
                  <p className="text-2xl font-bold">{summary.highestSoldPrice}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-500 text-sm">Sold Percentage</p>
                  <p className="text-2xl font-bold">{summary.soldPercentage}</p>
                </div>
              </div>
            </div>
            
            {visualizations && (
              <div className="grid grid-cols-1 gap-8">
                {visualizations.timeSeriesChart && (
                  <div className="bg-white shadow-md rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Price Trends Over Time</h2>
                    <img 
                      src={visualizations.timeSeriesChart} 
                      alt="Price Trends Over Time" 
                      className="w-full h-auto"
                    />
                  </div>
                )}
                
                {visualizations.priceHistogram && (
                  <div className="bg-white shadow-md rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">Price Distribution</h2>
                    <img 
                      src={visualizations.priceHistogram} 
                      alt="Price Distribution" 
                      className="w-full h-auto"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Right column - Detailed Results */}
          <div className="lg:w-1/3">
            <div className="bg-white shadow-md rounded-lg p-6 h-full overflow-auto">
              <h2 className="text-xl font-semibold mb-4">Detailed Results</h2>
              
              {results.length === 0 ? (
                <p className="text-gray-500">No detailed results available.</p>
              ) : (
                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                  {results.map((result, index) => {
                    const { make, model } = extractMakeModel(result);
                    return (
                      <div key={index} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="w-24 h-18 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                            <img 
                              src={getImageUrl(result)} 
                              alt={result.title} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate" title={result.title}>
                              {result.title}
                            </h3>
                            <div className="flex items-center mt-1">
                              <span className={`text-sm font-semibold ${result.status === 'sold' ? 'text-green-600' : 'text-red-600'}`}>
                                {formatPrice(result.sold_price)}
                              </span>
                              <span className="mx-2 text-gray-400">•</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                result.status === 'sold' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {result.status === 'sold' ? 'Sold' : 'Not Sold'}
                              </span>
                            </div>
                            {result.sold_date && (
                              <p className="text-xs text-gray-500 mt-1">
                                {result.sold_date}
                              </p>
                            )}
                            <div className="flex items-center mt-1 space-x-2">
                              <a 
                                href={result.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline inline-block"
                              >
                                View Original
                              </a>
                              <Link 
                                href={`/dashboard/${make}/${model}`}
                                className="text-xs text-blue-600 hover:underline inline-block"
                              >
                                View All {make} {model}
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-8">
        <Link 
          href="/"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
} 