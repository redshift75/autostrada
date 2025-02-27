import { z } from 'zod';

/**
 * Validates data against a Zod schema and returns the result
 * @param schema The Zod schema to validate against
 * @param data The data to validate
 * @returns An object containing the validation result
 */
export function validateSchema<T>(schema: z.ZodType<T>, data: unknown): {
  success: boolean;
  data?: T;
  error?: z.ZodError;
} {
  try {
    const validatedData = schema.parse(data);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error,
      };
    }
    throw error;
  }
}

/**
 * Formats Zod validation errors into a user-friendly object
 * @param error The Zod error to format
 * @returns An object with field names as keys and error messages as values
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const formattedErrors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    formattedErrors[path || 'general'] = err.message;
  });
  
  return formattedErrors;
}

/**
 * Validates data against a schema and returns formatted errors if validation fails
 * @param schema The Zod schema to validate against
 * @param data The data to validate
 * @returns An object containing the validation result and formatted errors
 */
export function validateAndFormatErrors<T>(schema: z.ZodType<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
} {
  const result = validateSchema(schema, data);
  
  if (!result.success && result.error) {
    return {
      success: false,
      errors: formatZodErrors(result.error),
    };
  }
  
  return {
    success: true,
    data: result.data,
  };
} 