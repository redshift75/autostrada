import { NextRequest, NextResponse } from 'next/server';
import { createAuctionResultsTool } from '../../../../lib/langchain/tools';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { make, model, yearMin, yearMax, maxPages } = body;
    
    // Validate required fields
    if (!make || !model) {
      return NextResponse.json(
        { error: 'Make and model are required fields' },
        { status: 400 }
      );
    }
    
    // Create the auction results tool
    const auctionResultsTool = createAuctionResultsTool();
    
    // Generate visualizations
    const result = await auctionResultsTool.invoke({
      make,
      model,
      yearMin: yearMin || 2015,
      yearMax: yearMax || 2023,
      maxPages: maxPages || 10,
      generateVisualizations: true
    });
    
    // Parse the result
    const parsedResult = JSON.parse(result);
    
    // Check if visualizations were generated
    if (!parsedResult.visualizations) {
      return NextResponse.json(
        { error: 'Failed to generate visualizations' },
        { status: 500 }
      );
    }
    
    // Convert SVG strings to base64 for embedding in HTML
    let timeSeriesBase64 = null;
    let priceHistogramBase64 = null;
    
    if (parsedResult.visualizations) {
      try {
        if (parsedResult.visualizations.timeSeriesChart) {
          timeSeriesBase64 = Buffer.from(parsedResult.visualizations.timeSeriesChart).toString('base64');
        }
        
        if (parsedResult.visualizations.priceHistogram) {
          priceHistogramBase64 = Buffer.from(parsedResult.visualizations.priceHistogram).toString('base64');
        }
      } catch (error) {
        console.error('Error converting SVG to base64:', error);
      }
    }
    
    // Prepare the response data with direct SVG strings or base64 encoded SVGs
    const visualizations = {
      timeSeriesChart: parsedResult.visualizations.timeSeriesChart 
        ? `data:image/svg+xml;base64,${timeSeriesBase64}` 
        : null,
      priceHistogram: parsedResult.visualizations.priceHistogram 
        ? `data:image/svg+xml;base64,${priceHistogramBase64}` 
        : null,
    };
    
    return NextResponse.json({
      message: 'Visualizations generated successfully',
      summary: parsedResult.summary,
      visualizations,
      results: parsedResult.results
    });
  } catch (error) {
    console.error('Error generating visualizations:', error);
    return NextResponse.json(
      { error: 'Failed to generate visualizations' },
      { status: 500 }
    );
  }
} 