'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TopLevelSpec } from 'vega-lite';

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

// VegaChart component for client-side rendering
function VegaChart({ spec, className }: { spec: TopLevelSpec, className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !spec) return;

    // Dynamically import vega-embed to avoid SSR issues
    import('vega-embed').then(({ default: vegaEmbed }) => {
      // Create a modified spec with responsive width
      const responsiveSpec = {
        ...spec,
        width: "container", // Make width responsive to container
        autosize: {
          type: "fit",
          contains: "padding"
        }
      };

      vegaEmbed(containerRef.current!, responsiveSpec as any, {
        actions: { export: true, source: false, compiled: false, editor: false },
        renderer: 'svg'
      }).catch(console.error);
    });

    // Cleanup function
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [spec]);

  return <div ref={containerRef} className={className} />;
}

// Create a client component that uses useSearchParams
function DashboardContent() {
  const router = useRouter();
  
  // Form state for generating new visualizations
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    yearMin: 1950,
    yearMax: 2025,
    maxPages: 2,
  });
  
  // State for auction results and loading status
  const [results, setResults] = useState<AuctionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  // State for visualizations
  const [visualizations, setVisualizations] = useState<{
    timeSeriesChart: TopLevelSpec | null;
    priceHistogram: TopLevelSpec | null;
  } | null>(null);
  
  // State for summary
  const [summary, setSummary] = useState<any | null>(null);
  
  // State for current search
  const [currentSearch, setCurrentSearch] = useState<{
    make: string;
    model: string;
  } | null>(null);
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'yearMin' || name === 'yearMax' || name === 'maxPages' ? parseInt(value) : value,
    });
  };
  
  // Format price for display
  const formatPrice = (price: string) => {
    if (!price) return 'N/A';
    
    // Remove any non-numeric characters except decimal point
    const numericPrice = price.replace(/[^0-9.]/g, '');
    
    // Convert to number and format with commas
    const formattedPrice = parseFloat(numericPrice).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    
    return formattedPrice;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults([]);
    setVisualizations(null);
    setSummary(null);
    
    try {
      const response = await fetch('/api/visualizations/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update state with results
      setResults(data.results || []);
      setVisualizations(data.visualizations || null);
      setSummary(data.summary || null);
      setCurrentSearch({
        make: formData.make,
        model: formData.model
      });
      
      // Hide the form after successful search
      setShowForm(false);
    } catch (err) {
      setError('Failed to generate visualizations. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Auction Results Dashboard</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition duration-200"
        >
          {showForm ? 'Hide Form' : 'Generate New Visualizations'}
        </button>
      </div>
      
      {showForm && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Generate Visualizations</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="make" className="block text-sm font-medium text-gray-700 mb-1">
                  Make
                </label>
                <input
                  type="text"
                  id="make"
                  name="make"
                  value={formData.make}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  id="model"
                  name="model"
                  value={formData.model}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="yearMin" className="block text-sm font-medium text-gray-700 mb-1">
                  Year Min
                </label>
                <input
                  type="number"
                  id="yearMin"
                  name="yearMin"
                  value={formData.yearMin}
                  onChange={handleInputChange}
                  min="1900"
                  max="2025"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="yearMax" className="block text-sm font-medium text-gray-700 mb-1">
                  Year Max
                </label>
                <input
                  type="number"
                  id="yearMax"
                  name="yearMax"
                  value={formData.yearMax}
                  onChange={handleInputChange}
                  min="1900"
                  max="2025"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="maxPages" className="block text-sm font-medium text-gray-700 mb-1">
                  Max Pages to Scrape
                </label>
                <input
                  type="number"
                  id="maxPages"
                  name="maxPages"
                  value={formData.maxPages}
                  onChange={handleInputChange}
                  min="1"
                  max="20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition duration-200 disabled:bg-blue-400"
                  disabled={loading}
                >
                  {loading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}
      
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Generating visualizations and fetching results...</p>
          <p className="text-gray-500 text-sm mt-2">This may take a minute or two.</p>
        </div>
      )}
      
      {!loading && currentSearch && (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">
              {currentSearch.make} {currentSearch.model} Auction Results
            </h2>
            
            {summary && (
              <div className="bg-blue-50 p-4 rounded-md mb-6">
                <h3 className="text-lg font-semibold mb-2">Market Summary</h3>
                <div className="text-gray-700 space-y-2">
                  {summary.totalResults && (
                    <p><strong>Total Results:</strong> {summary.totalResults}</p>
                  )}
                  {summary.averageSoldPrice && (
                    <p><strong>Average Sold Price:</strong> {formatPrice(summary.averageSoldPrice)}</p>
                  )}
                  {summary.highestSoldPrice && (
                    <p><strong>Highest Sold Price:</strong> {formatPrice(summary.highestSoldPrice)}</p>
                  )}
                  {summary.lowestSoldPrice && (
                    <p><strong>Lowest Sold Price:</strong> {formatPrice(summary.lowestSoldPrice)}</p>
                  )}
                  {summary.soldPercentage && (
                    <p><strong>Sold Percentage:</strong> {summary.soldPercentage}</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Restructured layout with side-by-side charts and results */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Charts section */}
              <div className="lg:w-2/3 flex-shrink-0 overflow-hidden">
                {visualizations && (
                  <div className="grid grid-cols-1 gap-6 mb-4">
                    {visualizations.timeSeriesChart && (
                      <div className="bg-gray-50 p-4 rounded-md">
                        <h3 className="text-lg font-semibold mb-2">Price Trends Over Time</h3>
                        <div className="w-full" style={{ maxWidth: '100%' }}>
                          <VegaChart 
                            spec={visualizations.timeSeriesChart} 
                            className="w-full h-auto"
                          />
                        </div>
                      </div>
                    )}
                    
                    {visualizations.priceHistogram && (
                      <div className="bg-gray-50 p-4 rounded-md">
                        <h3 className="text-lg font-semibold mb-2">Price Distribution</h3>
                        <div className="w-full" style={{ maxWidth: '100%' }}>
                          <VegaChart 
                            spec={visualizations.priceHistogram} 
                            className="w-full h-auto"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Scrollable side panel for results */}
              <div className="lg:w-1/3 flex-shrink-0">
                <div className="bg-white rounded-lg border border-gray-200 h-full">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-xl font-semibold">Recent Auction Results</h3>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh)" }}>
                    {results.length === 0 ? (
                      <p className="text-gray-500 p-4">No results found.</p>
                    ) : (
                      <div className="p-4 space-y-4">
                        {results.map((result, index) => {
                          // Extract make and model from the title if not provided
                          const titleParts = result.title.split(' ');
                          const make = result.make || titleParts[0];
                          const model = result.model || titleParts[1];
                          
                          return (
                            <div key={index} className="border rounded-lg overflow-hidden bg-gray-50 hover:shadow-md transition-shadow duration-200">
                              <div className="p-4">
                                <div className="flex items-start space-x-4">
                                  <div className="flex-shrink-0 w-20 h-20 bg-gray-200 rounded-md overflow-hidden">
                                    <img 
                                      src={result.image_url || result.images?.small?.url || '/placeholder-car.jpg'} 
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
                                        {result.status === 'sold' ? formatPrice(result.sold_price) : formatPrice(result.bid_amount)}
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
                                    </div>
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
            </div>
          </div>
        </div>
      )}
      
      {!loading && !currentSearch && !showForm && (
        <div className="text-center py-12 bg-white shadow-md rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Welcome to the Auction Results Dashboard</h2>
          <p className="text-gray-600 mb-8">Click "Generate New Visualizations" to search for auction results</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md transition duration-200"
          >
            Get Started
          </button>
        </div>
      )}
      
      <div className="mt-8">
      </div>
    </div>
  );
}

// Main dashboard component with Suspense boundary
export default function Dashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
} 