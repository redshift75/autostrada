import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-3xl font-bold">Auction Results</h1>
          <p className="text-center max-w-md">
            View and analyze auction results for classic cars with interactive visualizations.
          </p>
        </div>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <Link
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="/auctions"
          >
            Run Search
          </Link>
          <Link
            className="rounded-full border border-solid border-foreground transition-colors flex items-center justify-center bg-transparent text-foreground gap-2 hover:bg-foreground hover:text-background text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="/listings"
          >
            Browse Listings
          </Link>
        </div>
        
        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg max-w-2xl">
          <h2 className="text-xl font-semibold mb-4">About This Application</h2>
          <p className="mb-4">
            This application provides visualizations for auction results from Bring a Trailer. 
            You can view price trends over time and price distributions for various makes and models.
          </p>
          <p>
            The visualizations are generated using Vega-Lite and are served through a Next.js application.
          </p>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
      </footer>
    </div>
  );
}
