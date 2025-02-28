'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function ModelRedirect() {
  const router = useRouter();
  const params = useParams();
  
  // Extract make and model as plain strings
  const make = typeof params.make === 'string' ? params.make : Array.isArray(params.make) ? params.make[0] : '';
  const model = typeof params.model === 'string' ? params.model : Array.isArray(params.model) ? params.model[0] : '';
  
  useEffect(() => {
    // Redirect to the consolidated dashboard with query parameters
    router.replace(`/dashboard?make=${make}&model=${model}`);
  }, [router, make, model]);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
      <p className="text-center text-gray-600">Redirecting to the new dashboard...</p>
    </div>
  );
} 