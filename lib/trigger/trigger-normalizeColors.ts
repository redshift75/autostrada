import { logger, schedules } from "@trigger.dev/sdk/v3";
import { processCarColors } from '../../scripts/normalize-colors';

export const normalizeColorsTask = schedules.task({
  id: "Normalize Car Colors",
  // Every day at 6:00UTC
  cron: "0 7 * * *",
  // Set a maxDuration to prevent tasks from running indefinitely
  maxDuration: 1800, // 30 minutes
  run: async (payload, { ctx }) => {
    try {
      logger.log("Starting car color normalization job");
      
      // Call the processCarColors function with default parameters
      // This will process all available records and update the database
      const results = await processCarColors({
        shouldUpsert: true
      });
      
      logger.log(`Completed normalization for ${results.length} car colors`);
      
      return {
        success: true,
        normalizedCount: results.length
      };
    } catch (error: any) {
      logger.error('Error in car color normalization job:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
}); 