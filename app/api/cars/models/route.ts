import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY  || '';

// Check if Supabase credentials are configured
const isSupabaseConfigured = supabaseUrl && supabaseKey;

// Create client only if credentials are available
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

export async function GET(request: Request) {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured || !supabase) {
      console.error('Supabase environment variables are not configured');
      return NextResponse.json(
        { error: 'Database connection not configured. Check server environment variables.' }, 
        { status: 503 }
      );
    }

    // Get the query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const make = searchParams.get('make');

    if (!query) {
      return NextResponse.json([]);
    }

    console.log(`Querying models with: "${query}"${make ? ` for make: "${make}"` : ''}`);

    // Start building the query
    let supabaseQuery = supabase
      .from('allcars')
      .select('baseModel')
      .ilike('baseModel', `%${query}%`);

    // If make is provided, filter by make as well
    if (make) {
      supabaseQuery = supabaseQuery.eq('Make', make);
    }

    // Execute the query
    const { data, error } = await supabaseQuery
      .order('baseModel')
      .limit(20);

    if (error) {
      console.error('Error fetching models:', error);
      return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
    }

    // If no results, return empty array instead of null
    if (!data || !Array.isArray(data)) {
      console.log('No model results found or invalid data format');
      return NextResponse.json([]);
    }

    console.log(`Found ${data.length} models matching "${query}"${make ? ` for make: "${make}"` : ''}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in models API route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 