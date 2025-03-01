import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

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

    // Get the query parameter
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json([]);
    }

    console.log(`Querying makes with: "${query}"`);

    // Query the database for makes that match the search term
    const { data, error } = await supabase
      .from('allcars')
      .select('Make')
      .ilike('Make', `%${query}%`)
      .order('Make')
      .limit(20);

    if (error) {
      console.error('Error fetching makes:', error);
      return NextResponse.json({ error: 'Failed to fetch makes' }, { status: 500 });
    }

    // If no results, return empty array instead of null
    if (!data || !Array.isArray(data)) {
      console.log('No make results found or invalid data format');
      return NextResponse.json([]);
    }

    console.log(`Found ${data.length} makes matching "${query}"`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in makes API route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 