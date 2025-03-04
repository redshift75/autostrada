import { fetchDetailsFromListingPage } from './lib/utils/BATDetailsExtractor';

async function testBATDetailsExtractor() {
  try {
    const url = 'https://bringatrailer.com/listing/2005-porsche-carrera-gt-22/';
    console.log(`Testing fetchDetailsFromListingPage with URL: ${url}`);
    
    const data = await fetchDetailsFromListingPage(url);
    console.log('Extracted data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error testing details extractor:', error);
  }
}

testBATDetailsExtractor(); 