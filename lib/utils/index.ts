// Import React hooks for the debounce function
import { useState, useEffect } from 'react';

// Export visualization utilities
export * from './visualization';

// Debounce function to delay execution
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    // Set a timeout to update the debounced value after the specified delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    // Clear the timeout if the value changes before the delay expires
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

// Format price for display
export function formatPrice(price: string | number | null | undefined): string {
  if (price === null || price === undefined || price === '') return 'N/A';
  
  // If price is a string, convert to number
  let numericPrice: number;
  if (typeof price === 'string') {
    // Remove any non-numeric characters except decimal point
    const cleanedPrice = price.replace(/[^0-9.]/g, '');
    numericPrice = parseFloat(cleanedPrice);
    if (isNaN(numericPrice)) return 'N/A';
  } else {
    numericPrice = price;
  }
  
  // Format with commas and dollar sign
  return numericPrice.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Format number with commas
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  
  // If value is a string, convert to number
  let numericValue: number;
  if (typeof value === 'string') {
    // Remove any non-numeric characters except decimal point
    const cleanedValue = value.replace(/[^0-9.]/g, '');
    numericValue = parseFloat(cleanedValue);
    if (isNaN(numericValue)) return 'N/A';
  } else {
    numericValue = value;
  }
  
  // Format with commas
  return numericValue.toLocaleString('en-US');
} 