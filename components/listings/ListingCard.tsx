import Image from 'next/image';
import { useState } from 'react';

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

// List of allowed image domains from next.config.js
const ALLOWED_DOMAINS = [
  'auto.dev',
  'production-assets2.auto.dev',
  'vehicle-photos-published.vauto.com',
  'cdn.max.auto',
  'pictures.dealer.com',
  'images.dealersync.com',
  'content.homenetiol.com',
  'via.placeholder.com',
  'placehold.co'
];

// Check if an image URL is from an allowed domain
function isAllowedImageDomain(url: string | null): boolean {
  if (!url) return false;
  
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_DOMAINS.some(domain => hostname.includes(domain));
  } catch (e) {
    return false;
  }
}

// Get a fallback image URL
function getFallbackImageUrl(make: string, model: string): string {
  return `https://placehold.co/600x400/png?text=${encodeURIComponent(`${make} ${model}`)}`;
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
  // State to track image loading errors
  const [imageError, setImageError] = useState(false);
  
  // Ensure image URL has proper protocol
  const processedImageUrl = ensureAbsoluteUrl(listing.image_url);
  
  // Determine which image URL to use
  const fallbackImageUrl = getFallbackImageUrl(listing.make, listing.model);
  const isImageAllowed = isAllowedImageDomain(processedImageUrl);
  
  // Use fallback image if original image is not from an allowed domain or if there was an error
  const imageUrl = (!imageError && isImageAllowed && processedImageUrl) 
    ? processedImageUrl 
    : fallbackImageUrl;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="relative h-48 bg-gray-200">
        {imageUrl ? (
          <>
            {isImageAllowed ? (
              <Image
                src={imageUrl}
                alt={listing.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              // For non-allowed domains, use a regular img tag as fallback
              <div className="h-full w-full relative">
                <img
                  src={fallbackImageUrl}
                  alt={listing.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
            )}
          </>
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