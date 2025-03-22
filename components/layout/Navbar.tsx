'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const isActive = (path: string) => {
    return pathname === path;
  };
  
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  return (
    <nav className="bg-white dark:bg-gray-900 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <div className="relative w-8 h-8 mr-2">
                <Image 
                  src="/autostrada logo small.jpg" 
                  alt="Autostrada.AI Logo" 
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Autostrada.AI
              </span>
            </Link>
          </div>
          
          <div className="hidden md:flex space-x-4">
            <Link 
              href="/" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/') 
                  ? 'bg-gray-900 text-white dark:bg-gray-700' 
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Home
            </Link>
            <Link 
              href="/auctions" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/auctions') 
                  ? 'bg-gray-900 text-white dark:bg-gray-700' 
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Auction Results
            </Link>
            <Link 
              href="/listings" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/listings') 
                  ? 'bg-gray-900 text-white dark:bg-gray-700' 
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Listings
            </Link>
            <Link 
              href="/deal-finder" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/deal-finder') 
                  ? 'bg-gray-900 text-white dark:bg-gray-700' 
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Deal Finder
            </Link>
              <SignedOut>
                <SignInButton><button type="button" className="px-3 py-2 text-sm font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">Sign In</button></SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
          </div>
          
          <div className="md:hidden">
            <button 
              onClick={toggleMobileMenu}
              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-md"
              aria-label="Toggle mobile menu"
            >
              <svg 
                className="h-6 w-6" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 6h16M4 12h16M4 18h16" 
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      <div className={`md:hidden ${isMobileMenuOpen ? 'block' : 'hidden'} transition-all duration-300 ease-in-out`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white dark:bg-gray-900 shadow-lg">
          <Link 
            href="/" 
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              isActive('/') 
                ? 'bg-gray-900 text-white dark:bg-gray-700' 
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Home
          </Link>
          <Link 
            href="/auctions" 
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              isActive('/auctions') 
                ? 'bg-gray-900 text-white dark:bg-gray-700' 
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Auctions
          </Link>
          <Link 
            href="/listings" 
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              isActive('/listings') 
                ? 'bg-gray-900 text-white dark:bg-gray-700' 
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Listings
          </Link>
          <Link 
            href="/deal-finder" 
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              isActive('/deal-finder') 
                ? 'bg-gray-900 text-white dark:bg-gray-700' 
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Deal Finder
          </Link>
          <div className={`block px-3 py-2 rounded-md text-base font-medium`}>
          <SignedOut>
              <SignInButton><button type="button" className="px-3 py-2 text-sm font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">Sign In</button></SignInButton>
          </SignedOut>
          <SignedIn>
              <UserButton />
          </SignedIn>
          </div>
        </div>
      </div>
    </nav>
  );
} 