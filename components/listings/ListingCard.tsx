import Image from 'next/image';

// Define the Listing type
export type Listing = {
  title: string;
  price: number;
  mileage: number;
  exterior_color: string;
  interior_color: string;
  drive_train: string;
  transmission: string;
  engine: string;
  body_style: string;
  fuel_type: string;
  mpg_city: number;
  mpg_highway: number;
  url: string;
  image_url: string | null;
  images: {
    small: { url: string; width: number; height: number };
    large: { url: string; width: number; height: number };
  } | null;
  dealer: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
  };
  description: string;
  listed_date: string;
  make: string;
  model: string;
  year: number;
  vin: string;
};

// Helper function to ensure URLs have proper protocol
function ensureAbsoluteUrl(url: string | null): string | null {
  if (!url) return null;
  
  // If the URL starts with '//', add https: to make it absolute
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  
  // If the URL is relative (starts with '/'), add the base domain
  if (url.startsWith('/') && !url.startsWith('//')) {
    return `https://auto.dev${url}`;
  }
  
  // If the URL already has a protocol, return it as is
  return url;
}

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

// Format number with commas
const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US').format(value);
};

type ListingCardProps = {
  listing: Listing;
};

export default function ListingCard({ listing }: ListingCardProps) {
  // Ensure image URL has proper protocol
  const imageUrl = ensureAbsoluteUrl(listing.image_url);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="relative h-48 bg-gray-200">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={listing.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-200 dark:bg-gray-700">
            <span className="text-gray-400">No image available</span>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2 line-clamp-2">{listing.title}</h3>
        
        <div className="flex justify-between mb-2">
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(listing.price)}
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            {formatNumber(listing.mileage)} mi
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 text-sm">
          <div className="flex items-center">
            <span className="text-gray-500 dark:text-gray-400 mr-1">Year:</span>
            <span>{listing.year}</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-500 dark:text-gray-400 mr-1">Ext:</span>
            <span>{listing.exterior_color || 'N/A'}</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-500 dark:text-gray-400 mr-1">Trans:</span>
            <span>{listing.transmission || 'N/A'}</span>
          </div>
          <div className="flex items-center">
            <span className="text-gray-500 dark:text-gray-400 mr-1">Drive:</span>
            <span>{listing.drive_train || 'N/A'}</span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {listing.dealer?.city}, {listing.dealer?.state}
          </div>
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
          >
            View Details →
          </a>
        </div>
      </div>
    </div>
  );
} 