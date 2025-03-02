import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-8">
      <main className="w-full max-w-4xl mx-auto flex flex-col items-center text-center">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            Intelligent Automotive Analytics
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            View and analyze listings and auction results for your next vehicle purchase.
          </p>
        </div>

        <div className="flex gap-6 flex-col sm:flex-row justify-center mb-12">
          <Link
            href="/auctions"
            className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Auction Results
          </Link>
          <Link
            href="/listings"
            className="px-8 py-3 rounded-lg bg-white dark:bg-gray-800 border-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 font-medium text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Search Listings
          </Link>
          <Link
            href="/deal-finder"
            className="px-8 py-3 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Deal Finder
          </Link>
        </div>
        
        <div className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border-t-4 border-blue-600">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">About This Application</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4 text-lg">
            This application provides comprehensive data on vehicle markets, including auction results from Bring a Trailer and used car listings from across the web.
          </p>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Explore price trends, compare models, and make informed decisions with our interactive visualizations and search tools.
          </p>
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
              <h3 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">Auction Analytics</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Track historical auction prices and identify market trends for collectible and enthusiast vehicles.
              </p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
              <h3 className="font-semibold text-indigo-700 dark:text-indigo-400 mb-2">Listing Search</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Find your next vehicle with our powerful search tools and comprehensive database of listings.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">Deal Finder</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Discover underpriced auctions ending within the next 7 days by comparing current bids with historical sales data.
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="mt-16 text-center text-gray-500 dark:text-gray-400">
        <p>© 2025 Autostrada.AI - Intelligent Automotive Analytics</p>
      </footer>
    </div>
  );
}
