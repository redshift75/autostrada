import axios from "axios";

// Base API client with common configuration
const createApiClient = (baseURL: string, apiKey?: string) => {
  return axios.create({
    baseURL,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    timeout: 30000,
  });
};

// Example client for a vehicle data API (placeholder)
export const vehicleDataClient = createApiClient(
  "https://api.vehicledata.example.com/v1",
  process.env.VEHICLE_DATA_API_KEY
);

// Example client for auction data (placeholder)
export const auctionDataClient = createApiClient(
  "https://api.auctiondata.example.com/v1",
  process.env.AUCTION_DATA_API_KEY
);

// Utility function to handle API errors consistently
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  errorMessage: string = "API call failed"
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    throw new Error(errorMessage);
  }
} 