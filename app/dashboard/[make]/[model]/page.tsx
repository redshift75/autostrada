'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ModelVisualizations() {
  const params = useParams();
  const make = params.make as string;
  const model = params.model as string;
  
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
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchVisualizations() {
      try {
        setLoading(true);
        const response = await fetch(`/api/visualizations?make=${make}&model=${model}`);
        
        if (!response.ok) {
          throw new Error(`Error fetching visualizations: ${response.statusText}`);
        }
        
        const data = await response.json();
        setVisualizations(data.visualizations);
        setSummary(data.summary);
      } catch (err) {
        console.error('Error fetching visualizations:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }
    
    if (make && model) {
      fetchVisualizations();
    }
  }, [make, model]);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        {make} {model} Auction Results
      </h1>
      
      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
          <p className="mt-2">
            Please make sure you have generated visualizations for this make and model first.
          </p>
        </div>
      )}
      
      {!loading && !error && summary && (
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
      )}
      
      {!loading && !error && visualizations && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
      
      <div className="mt-8 flex space-x-4">
        <Link 
          href="/dashboard"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back to Dashboard
        </Link>
        
        <Link 
          href="/"
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
} 