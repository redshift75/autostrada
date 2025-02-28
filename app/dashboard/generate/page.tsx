'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GenerateRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the consolidated dashboard with a query parameter to show the form
    router.replace('/dashboard?showForm=true');
  }, [router]);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
      <p className="text-center text-gray-600">Redirecting to the new dashboard...</p>
    </div>
  );
} 