'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TopLevelSpec } from 'vega-lite';
import VegaChart from '@/components/shared/VegaChart';
import { formatPrice } from '@/lib/utils/index';

// Define types for the Deal Finder page
type Deal = {
  activeListing: {
    id: number;
    url: string;
    title: string;
    year: string;
    make: string;
    model: string;
    current_bid: number;
    current_bid_formatted: string;
    endDate: number;
    image_url: string;
    image_url_thumb: string;
    location: string;
    seller_username?: string;
    seller_id?: string;
    reserve_met?: boolean;
    reserve_not_met?: boolean;
    no_reserve?: boolean;
    premium?: boolean;
    featured?: boolean;
  };
  historicalData: {
    averagePrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    recentSales: Array<{
      title: string;
      sold_price: string;
      sold_date: string;
      url: string;
      image_url?: string;
    }>;
  };
  priceDifference: number;
  percentageDifference: number;
  dealScore: number;
  endingSoon: boolean;
};

// Debug response type
type DebugResponse = {
  activeListings: any[];
  totalActiveListings: number;
};

export default function DealFinder() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [debugData, setDebugData] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    yearMin: '',
    yearMax: '',
    maxDeals: '10',
    debug: false
  });

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle checkbox changes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDeals([]);
    setDebugData(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (formData.make) params.append('make', formData.make);
      if (formData.model) params.append('model', formData.model);
      if (formData.yearMin) params.append('yearMin', formData.yearMin);
      if (formData.yearMax) params.append('yearMax', formData.yearMax);
      if (formData.maxDeals) params.append('maxDeals', formData.maxDeals);
      if (formData.debug) params.append('debug', 'true');

      // Fetch deals from the API
      const response = await fetch(`/api/deal-finder?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle debug mode response
      if (formData.debug && data.activeListings) {
        setDebugData(data);
        return;
      }
      
      // Handle error message from API
      if (data.message) {
        setError(data.message);
        setDebugData(data);
        return;
      }
      
      if (data.deals && data.deals.length > 0) {
        setDeals(data.deals);
      } else {
        setError('No deals found matching your criteria. Try different search parameters.');
      }
    } catch (error) {
      console.error('Error fetching deals:', error);
      setError('Failed to fetch deals. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (endDate: number) => {
    const now = new Date();
    const end = new Date(endDate);
    const diffMs = end.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Ended';
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHrs}h`;
    }
    
    return `${diffHrs}h ${diffMins}m`;
  };

  // Generate price comparison chart
  const generatePriceComparisonChart = (deal: Deal): TopLevelSpec => {
    const data = [
      { 
        category: 'Current Bid', 
        price: deal.activeListing.current_bid,
        color: deal.dealScore >= 7 ? '#10b981' : deal.dealScore <= 3 ? '#ef4444' : '#3b82f6'
      },
      { 
        category: 'Average Price', 
        price: deal.historicalData.averagePrice,
        color: '#6b7280'
      },
      { 
        category: 'Median Price', 
        price: deal.historicalData.medianPrice,
        color: '#9ca3af'
      }
    ];

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Price Comparison',
      width: "container",
      height: 300,
      autosize: {
        type: "fit",
        contains: "padding",
        resize: true
      },
      data: { values: data },
      mark: {
        type: 'bar',
        tooltip: true
      },
      encoding: {
        x: { field: 'category', type: 'nominal', axis: { labelAngle: 0 } },
        y: { 
          field: 'price', 
          type: 'quantitative',
          axis: { title: 'Price ($)', format: '~s' }
        },
        color: {
          field: 'color',
          type: 'nominal',
          scale: null
        },
        tooltip: [
          { field: 'category', type: 'nominal', title: 'Category' },
          { field: 'price', type: 'quantitative', title: 'Price', format: '$,.0f' }
        ]
      }
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            Deal Finder
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-lg text-gray-500 dark:text-gray-300">
            Find underpriced auctions ending within the next 7 days on Bring a Trailer
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-6 sm:gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="make" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Make
              </label>
              <input
                type="text"
                id="make"
                name="make"
                value={formData.make}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="e.g. Porsche"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Model
              </label>
              <input
                type="text"
                id="model"
                name="model"
                value={formData.model}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="e.g. 911"
              />
            </div>
            <div>
              <label htmlFor="yearMin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Year Min
              </label>
              <input
                type="number"
                id="yearMin"
                name="yearMin"
                value={formData.yearMin}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="e.g. 2015"
              />
            </div>
            <div>
              <label htmlFor="yearMax" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Year Max
              </label>
              <input
                type="number"
                id="yearMax"
                name="yearMax"
                value={formData.yearMax}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="e.g. 2023"
              />
            </div>
            <div className="sm:col-span-6 flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="debug"
                  name="debug"
                  type="checkbox"
                  checked={formData.debug}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="debug" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Debug Mode
                </label>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Find Deals'}
              </button>
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Data */}
        {debugData && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8 overflow-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Debug Information</h2>
            {debugData.activeListings ? (
              <>
                <p className="mb-2">Total Active Listings: {debugData.totalActiveListings}</p>
                <h3 className="text-lg font-semibold mb-2">Sample Active Listings:</h3>
                <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md overflow-auto text-sm">
                  {JSON.stringify(debugData.activeListings, null, 2)}
                </pre>
              </>
            ) : debugData.sampleListings ? (
              <>
                <p className="mb-2">Total Active Listings: {debugData.totalActive}</p>
                <p className="mb-2">After Filtering: {debugData.afterFiltering}</p>
                <h3 className="text-lg font-semibold mb-2">Sample Listings After Filtering:</h3>
                <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md overflow-auto text-sm">
                  {JSON.stringify(debugData.sampleListings, null, 2)}
                </pre>
              </>
            ) : (
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md overflow-auto text-sm">
                {JSON.stringify(debugData, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Results */}
        {!loading && deals.length > 0 && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {deals.length} Deal{deals.length !== 1 ? 's' : ''} Found
            </h2>
            
            {deals.map((deal, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex flex-col md:flex-row">
                    {/* Image */}
                    <div className="md:w-1/3 mb-4 md:mb-0 md:pr-6">
                      <div className="relative h-64 w-full rounded-lg overflow-hidden">
                        <Image
                          src={deal.activeListing.image_url || '/placeholder-car.jpg'}
                          alt={deal.activeListing.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="mt-4 flex justify-between items-center">
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            deal.dealScore >= 8 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                            deal.dealScore >= 6 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                            deal.dealScore >= 4 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                            'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                          }`}>
                            Deal Score: {deal.dealScore}/10
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {deal.endingSoon && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                              Ending Soon!
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Details */}
                    <div className="md:w-2/3">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        <a href={deal.activeListing.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {deal.activeListing.title}
                        </a>
                      </h3>
                      
                      <div className="mt-2 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Current Bid</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {deal.activeListing.current_bid_formatted}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Time Remaining</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {formatTimeRemaining(deal.activeListing.endDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Average Historical Price</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {formatPrice(deal.historicalData.averagePrice)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Price Difference</p>
                          <p className={`text-lg font-semibold ${
                            deal.priceDifference > 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {deal.priceDifference > 0 ? '+' : ''}{formatPrice(deal.priceDifference)} 
                            ({deal.percentageDifference > 0 ? '+' : ''}{deal.percentageDifference.toFixed(1)}%)
                          </p>
                        </div>
                      </div>
                      
                      {/* Price Comparison Chart */}
                      <div className="mt-4">
                        <VegaChart 
                          spec={generatePriceComparisonChart(deal)} 
                          className="w-full h-auto"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Recent Sales */}
                  <div className="mt-6">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                      Recent Similar Sales
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                              Vehicle
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                              Sold Price
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                              Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {deal.historicalData.recentSales.map((sale, idx) => (
                            <tr key={idx}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                <a href={sale.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                  {sale.title}
                                </a>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                {sale.sold_price}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                {sale.sold_date}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 