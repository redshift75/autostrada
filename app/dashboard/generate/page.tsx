'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function GenerateVisualizations() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    yearMin: 2015,
    yearMax: 2023,
    maxPages: 10,
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'yearMin' || name === 'yearMax' || name === 'maxPages' 
        ? parseInt(value, 10) 
        : value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.make || !formData.model) {
      setError('Make and Model are required fields');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/visualizations/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate visualizations');
      }
      
      const data = await response.json();
      setSuccess('Visualizations generated successfully!');
      
      // Redirect to the visualizations page after a short delay
      setTimeout(() => {
        router.push(`/dashboard/${formData.make}/${formData.model}`);
      }, 1500);
      
    } catch (err) {
      console.error('Error generating visualizations:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Generate Auction Visualizations</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p>{success}</p>
        </div>
      )}
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="make" className="block text-sm font-medium text-gray-700 mb-1">
                Make *
              </label>
              <input
                type="text"
                id="make"
                name="make"
                value={formData.make}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. Porsche"
                required
              />
            </div>
            
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                Model *
              </label>
              <input
                type="text"
                id="model"
                name="model"
                value={formData.model}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. 911"
                required
              />
            </div>
            
            <div>
              <label htmlFor="yearMin" className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Year
              </label>
              <input
                type="number"
                id="yearMin"
                name="yearMin"
                value={formData.yearMin}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                min="1900"
                max={new Date().getFullYear()}
              />
            </div>
            
            <div>
              <label htmlFor="yearMax" className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Year
              </label>
              <input
                type="number"
                id="yearMax"
                name="yearMax"
                value={formData.yearMax}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                min="1900"
                max={new Date().getFullYear()}
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
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                min="1"
                max="50"
              />
              <p className="text-xs text-gray-500 mt-1">Higher values will take longer but provide more data.</p>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                'Generate Visualizations'
              )}
            </button>
          </div>
        </form>
      </div>
      
      <div className="mt-4">
        <Link 
          href="/dashboard"
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
} 