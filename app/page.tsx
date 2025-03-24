import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

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
          <Button variant="gradient" size="lg" asChild>
            <Link href="/auctions">
              Auction Results
            </Link>
          </Button>
          
          <Button variant="outline" size="lg" asChild>
            <Link href="/listings">
              Search Listings
            </Link>
          </Button>
          
          <Button 
            variant="gradient" 
            size="lg" 
            className="bg-gradient-to-r from-green-600 to-emerald-600"
            asChild
          >
            <Link href="/deal-finder">
              Deal Finder
            </Link>
          </Button>
        </div>
        
        <Card className="w-full max-w-3xl border-t-4 border-blue-600">
          <CardHeader>
            <CardTitle>About This Application</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300 text-lg">
              This application provides comprehensive data on vehicle markets, including auction results from Bring a Trailer and used car listings from across the web.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-300 text-lg mb-8">
              Explore price trends, compare models, and make informed decisions with our interactive visualizations and search tools.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </CardContent>
        </Card>
      </main>
      
      <footer className="mt-16 text-center text-gray-500 dark:text-gray-400">
        <p>© 2025 Autostrada.AI - Intelligent Automotive Analytics</p>
      </footer>
    </div>
  );
}
