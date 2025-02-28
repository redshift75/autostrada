import { NextRequest, NextResponse } from 'next/server';
import { initializeAgent } from '@/lib/langchain';
import '@/lib/server-only';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }
    
    // Initialize the agent
    const agent = await initializeAgent();
    
    // Process the query
    const result = await agent.invoke({
      input: query
    });
    
    // Return the response
    return NextResponse.json({
      response: result.output,
      success: true
    });
  } catch (error) {
    console.error('Error processing agent query:', error);
    return NextResponse.json(
      { error: 'Failed to process query', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export const runtime = 'edge'; // Optional: Use edge runtime for better performance 