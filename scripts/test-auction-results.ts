import { createAuctionResultsTool } from '../lib/langchain/tools';

async function testAuctionResultsTool() {
  try {
    console.log('Initializing auction results tool...');
    const auctionResultsTool = createAuctionResultsTool();
    
    // Test with Porsche 911
    console.log('Testing auction results for Porsche 911...');
    const result = await auctionResultsTool.invoke({
      make: 'Porsche',
      model: '911',
      yearMin: 2015,
      yearMax: 2023,
      maxPages: 1
    });
    
    // Parse the result and display a summary
    const parsedResult = JSON.parse(result);
    
    console.log('\nQuery:', parsedResult.query);
    console.log('\nSummary:');
    console.log('- Total Results:', parsedResult.summary.totalResults);
    console.log('- Average Sold Price:', parsedResult.summary.averageSoldPrice);
    console.log('- Highest Sold Price:', parsedResult.summary.highestSoldPrice);
    console.log('- Lowest Sold Price:', parsedResult.summary.lowestSoldPrice);
    console.log('- Sold Percentage:', parsedResult.summary.soldPercentage);
    
    console.log('\nFirst 5 Results:');
    parsedResult.results.slice(0, 5).forEach((item: any, index: number) => {
      console.log(`\n${index + 1}. ${item.title}`);
      console.log(`   Price: ${item.sold_price}`);
      console.log(`   Date: ${item.sold_date}`);
      console.log(`   URL: ${item.url}`);
    });
    
  } catch (error) {
    console.error('Error testing auction results tool:', error);
  }
}

// Run the test
testAuctionResultsTool(); 