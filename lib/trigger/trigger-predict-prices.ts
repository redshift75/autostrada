import { logger, schedules } from "@trigger.dev/sdk/v3";
import { processActiveListings } from '../../scripts/predict-prices';

export const predictPricesTask = schedules.task({
  id: "Predict Prices",
  // Every day at 6:00UTC
  cron: "0 7 * * *",
  // Set a maxDuration to prevent tasks from running indefinitely
  maxDuration: 3600, // 1 hour
  run: async (payload, { ctx }) => {
    logger.log("Starting price prediction job");

    // Predict prices for active listings
    await processActiveListings();
    } 
}); 