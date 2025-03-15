import { NextResponse } from 'next/server';

type AutocompleteResponse = {
  terms: string[];
};

export async function GET(request: Request) {
  try {
    // Get the URL parameters
    const { searchParams } = new URL(request.url);
    const field = searchParams.get('field');
    const input = searchParams.get('input') || ``;
    const make = searchParams.get('make'); // For model searches
    const model = searchParams.get('model') || ''; // For trim searches
    const trim = searchParams.get('trim') || ''; // For trim searches

    // Validate required parameters
    if (!field || !make) {
      return NextResponse.json(
        { error: 'Field and make parameter is required' },
        { status: 400 }
      );
    }

    // Get API key from environment variables
    const apiKey = process.env.MARKETCHECK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 503 }
      );
    }

    // Build query parameters
    const params = new URLSearchParams();
    params.append('api_key', apiKey);
    params.append('field', field);
    params.append('input', input);
    params.append('make', make);
    if (field === 'model') {
      params.append('model', model);
    } else if (field === 'trim') {
      params.append('model', model);
      params.append('trim', trim);
    }

    // Call MarketCheck API
    console.log(`MC API: ${params.toString()}`);
    const response = await fetch(
      `https://mc-api.marketcheck.com/v2/search/car/auto-complete?${params.toString()}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MarketCheck API error:', response.status, errorText);
      return NextResponse.json(
        { error: `API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data: AutocompleteResponse = await response.json();
    
    // Return the suggestions
    return NextResponse.json({
      suggestions: data.terms || []
    });

  } catch (error) {
    console.error('Error processing autocomplete request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 