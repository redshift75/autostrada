/**
 * Vehicle Attribute Standardization Utilities
 * 
 * This module provides functions for normalizing and standardizing vehicle attributes
 * across different data sources to ensure consistent data quality.
 */

import { z } from 'zod';

// Common vehicle makes with standardized names
const STANDARD_MAKES = {
  'mercedes': 'Mercedes-Benz',
  'mercedes benz': 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  'bmw': 'BMW',
  'porsche': 'Porsche',
  'ferrari': 'Ferrari',
  'aston': 'Aston Martin',
  'aston martin': 'Aston Martin',
  'aston-martin': 'Aston Martin',
  'rolls': 'Rolls-Royce',
  'rolls royce': 'Rolls-Royce',
  'rolls-royce': 'Rolls-Royce',
  'jaguar': 'Jaguar',
  'lamborghini': 'Lamborghini',
  'lambo': 'Lamborghini',
  'bentley': 'Bentley',
  'maserati': 'Maserati',
  'bugatti': 'Bugatti',
  'alfa': 'Alfa Romeo',
  'alfa romeo': 'Alfa Romeo',
  'alfa-romeo': 'Alfa Romeo',
  'chevrolet': 'Chevrolet',
  'chevy': 'Chevrolet',
  'ford': 'Ford',
  'dodge': 'Dodge',
  'plymouth': 'Plymouth',
  'pontiac': 'Pontiac',
  'cadillac': 'Cadillac',
  'oldsmobile': 'Oldsmobile',
  'buick': 'Buick',
  'shelby': 'Shelby',
  'austin': 'Austin',
  'austin healey': 'Austin-Healey',
  'austin-healey': 'Austin-Healey',
  'triumph': 'Triumph',
  'mg': 'MG',
  'lotus': 'Lotus',
  'toyota': 'Toyota',
  'datsun': 'Datsun',
  'nissan': 'Nissan',
  'honda': 'Honda',
  'mazda': 'Mazda',
  'vw': 'Volkswagen',
  'volkswagen': 'Volkswagen',
  'volvo': 'Volvo',
  'saab': 'Saab',
  'peugeot': 'Peugeot',
  'renault': 'Renault',
  'citroen': 'Citroën',
  'fiat': 'Fiat',
  'lancia': 'Lancia',
  'delorean': 'DeLorean',
  'de lorean': 'DeLorean',
  'de-lorean': 'DeLorean',
  'morgan': 'Morgan',
  'tvr': 'TVR',
  'sunbeam': 'Sunbeam',
  'jensen': 'Jensen',
  'iso': 'Iso',
  'detomaso': 'De Tomaso',
  'de tomaso': 'De Tomaso',
  'de-tomaso': 'De Tomaso',
  'mclaren': 'McLaren',
  'koenigsegg': 'Koenigsegg',
  'pagani': 'Pagani',
  'tucker': 'Tucker',
  'studebaker': 'Studebaker',
  'packard': 'Packard',
  'hudson': 'Hudson',
  'nash': 'Nash',
  'amc': 'AMC',
  'american motors': 'AMC',
  'american motors corporation': 'AMC',
};

/**
 * Normalize a vehicle make to a standard format
 * 
 * @param make - The make to normalize
 * @returns Normalized make name
 */
export function normalizeMake(make: string): string {
  if (!make) return '';
  
  const lowerMake = make.toLowerCase().trim();
  
  // Check if it's in our standard makes dictionary
  if (lowerMake in STANDARD_MAKES) {
    return STANDARD_MAKES[lowerMake as keyof typeof STANDARD_MAKES];
  }
  
  // If not found, capitalize first letter of each word
  return lowerMake
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalize a vehicle model to a standard format
 * 
 * @param model - The model to normalize
 * @param make - The make of the vehicle (helps with context-specific normalization)
 * @returns Normalized model name
 */
export function normalizeModel(model: string, make?: string): string {
  if (!model) return '';
  
  let normalizedModel = model.trim();
  
  // Make-specific model normalizations
  if (make) {
    const normalizedMake = normalizeMake(make);
    
    // Porsche-specific normalizations
    if (normalizedMake === 'Porsche') {
      // Convert "911 Turbo S" to "911 Turbo S"
      if (/911\s+turbo\s+s/i.test(normalizedModel)) {
        return '911 Turbo S';
      }
      // Convert "930 Turbo" to "911 Turbo (930)"
      if (/^930\s+turbo/i.test(normalizedModel)) {
        return '911 Turbo (930)';
      }
      // Normalize Carrera variants
      if (/911\s+carrera/i.test(normalizedModel)) {
        normalizedModel = normalizedModel.replace(/911\s+carrera\s+4s/i, '911 Carrera 4S');
        normalizedModel = normalizedModel.replace(/911\s+carrera\s+s/i, '911 Carrera S');
        normalizedModel = normalizedModel.replace(/911\s+carrera\s+4/i, '911 Carrera 4');
        normalizedModel = normalizedModel.replace(/911\s+carrera/i, '911 Carrera');
      }
    }
    
    // Ferrari-specific normalizations
    if (normalizedMake === 'Ferrari') {
      // Normalize 250 variants
      normalizedModel = normalizedModel.replace(/250\s+gt\s+lusso/i, '250 GT Lusso');
      normalizedModel = normalizedModel.replace(/250\s+gto/i, '250 GTO');
      normalizedModel = normalizedModel.replace(/250\s+gt\s+swb/i, '250 GT SWB');
      normalizedModel = normalizedModel.replace(/250\s+gt\s+lwb/i, '250 GT LWB');
      normalizedModel = normalizedModel.replace(/250\s+gt\s+california/i, '250 GT California');
      normalizedModel = normalizedModel.replace(/250\s+gt\s+california\s+swb/i, '250 GT California SWB');
      normalizedModel = normalizedModel.replace(/250\s+gt\s+california\s+lwb/i, '250 GT California LWB');
    }
    
    // Mercedes-specific normalizations
    if (normalizedMake === 'Mercedes-Benz') {
      // Normalize 300SL variants
      normalizedModel = normalizedModel.replace(/300\s*sl\s+gullwing/i, '300SL Gullwing');
      normalizedModel = normalizedModel.replace(/300\s*sl\s+roadster/i, '300SL Roadster');
      
      // Normalize modern class designations
      normalizedModel = normalizedModel.replace(/(\d+)\s*([a-z])\s+class/i, '$1$2-Class');
    }
  }
  
  // General model normalization
  // Capitalize first letter of each word except for common lowercase words
  const lowercaseWords = ['and', 'or', 'the', 'in', 'with', 'of', 'de', 'von', 'van', 'le'];
  
  return normalizedModel
    .split(' ')
    .map((word, index) => {
      const lowerWord = word.toLowerCase();
      
      // Keep lowercase words lowercase unless they're the first word
      if (index > 0 && lowercaseWords.includes(lowerWord)) {
        return lowerWord;
      }
      
      // Special case for model numbers with letters (e.g., 911S, 300SL)
      if (/^\d+[a-z]+$/i.test(word)) {
        const numbers = word.match(/^\d+/)?.[0] || '';
        const letters = word.match(/[a-z]+$/i)?.[0] || '';
        return numbers + letters.toUpperCase();
      }
      
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Normalize a vehicle year
 * 
 * @param year - The year to normalize
 * @returns Normalized year as a number, or null if invalid
 */
export function normalizeYear(year: string | number): number | null {
  if (year === null || year === undefined) return null;
  
  // Convert to string first
  const yearStr = String(year).trim();
  
  // Extract 4-digit year if embedded in text
  const yearMatch = yearStr.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    return parseInt(yearMatch[0], 10);
  }
  
  // Try direct conversion
  const yearNum = parseInt(yearStr, 10);
  
  // Validate year is in reasonable range for classic cars
  if (!isNaN(yearNum) && yearNum >= 1900 && yearNum <= new Date().getFullYear()) {
    return yearNum;
  }
  
  return null;
}

/**
 * Normalize vehicle mileage
 * 
 * @param mileage - The mileage to normalize
 * @returns Normalized mileage as a number, or null if invalid
 */
export function normalizeMileage(mileage: string | number): number | null {
  if (mileage === null || mileage === undefined) return null;
  
  // Convert to string first
  let mileageStr = String(mileage).trim();
  
  // Remove commas and non-numeric characters
  mileageStr = mileageStr.replace(/,/g, '').replace(/[^\d.]/g, '');
  
  // Convert to number
  const mileageNum = parseFloat(mileageStr);
  
  // Validate mileage is reasonable
  if (!isNaN(mileageNum) && mileageNum >= 0 && mileageNum < 1000000) {
    return Math.round(mileageNum);
  }
  
  return null;
}

/**
 * Normalize vehicle price
 * 
 * @param price - The price to normalize
 * @returns Normalized price as a number, or null if invalid
 */
export function normalizePrice(price: string | number): number | null {
  if (price === null || price === undefined) return null;
  
  // Convert to string first
  let priceStr = String(price).trim();
  
  // Remove currency symbols, commas, and other non-numeric characters
  priceStr = priceStr.replace(/[$€£¥,]/g, '').replace(/[^\d.]/g, '');
  
  // Convert to number
  const priceNum = parseFloat(priceStr);
  
  // Validate price is reasonable
  if (!isNaN(priceNum) && priceNum >= 0) {
    return Math.round(priceNum * 100) / 100; // Round to 2 decimal places
  }
  
  return null;
}

/**
 * Normalize vehicle VIN (Vehicle Identification Number)
 * 
 * @param vin - The VIN to normalize
 * @returns Normalized VIN, or empty string if invalid
 */
export function normalizeVin(vin: string): string {
  if (!vin) return '';
  
  // Remove spaces and convert to uppercase
  const normalizedVin = vin.replace(/\s/g, '').toUpperCase();
  
  // Basic VIN validation (modern VINs are 17 characters)
  // But classic cars might have shorter VINs
  if (normalizedVin.length > 0 && normalizedVin.length <= 17) {
    return normalizedVin;
  }
  
  return '';
}

/**
 * Normalize vehicle condition
 * 
 * @param condition - The condition to normalize
 * @returns Normalized condition string
 */
export function normalizeCondition(condition: string): string {
  if (!condition) return '';
  
  const lowerCondition = condition.toLowerCase().trim();
  
  // Map various condition descriptions to standard values
  if (/concours|perfect|flawless|pristine|museum/i.test(lowerCondition)) {
    return 'Concours';
  } else if (/excellent|superb|exceptional/i.test(lowerCondition)) {
    return 'Excellent';
  } else if (/very\s+good|great|nice/i.test(lowerCondition)) {
    return 'Very Good';
  } else if (/good|clean|solid/i.test(lowerCondition)) {
    return 'Good';
  } else if (/fair|average|decent|driver/i.test(lowerCondition)) {
    return 'Fair';
  } else if (/poor|project|needs\s+work|rough/i.test(lowerCondition)) {
    return 'Poor';
  } else if (/parts|salvage|not\s+running/i.test(lowerCondition)) {
    return 'Parts';
  }
  
  return 'Unknown';
}

/**
 * Normalize vehicle exterior color
 * 
 * @param color - The color to normalize
 * @returns Normalized color string
 */
export function normalizeColor(color: string): string {
  if (!color) return '';
  
  const lowerColor = color.toLowerCase().trim();
  
  // Map common color variations to standard colors
  const colorMap: Record<string, string> = {
    'blk': 'Black',
    'black': 'Black',
    'wht': 'White',
    'white': 'White',
    'slvr': 'Silver',
    'silver': 'Silver',
    'gry': 'Gray',
    'grey': 'Gray',
    'gray': 'Gray',
    'red': 'Red',
    'blu': 'Blue',
    'blue': 'Blue',
    'grn': 'Green',
    'green': 'Green',
    'ylw': 'Yellow',
    'yellow': 'Yellow',
    'brwn': 'Brown',
    'brown': 'Brown',
    'tan': 'Tan',
    'beige': 'Beige',
    'burg': 'Burgundy',
    'burgundy': 'Burgundy',
    'maroon': 'Burgundy',
    'navy': 'Navy Blue',
    'navy blue': 'Navy Blue',
    'navy-blue': 'Navy Blue',
    'cream': 'Cream',
    'ivory': 'Ivory',
    'gold': 'Gold',
    'bronze': 'Bronze',
    'copper': 'Copper',
    'orange': 'Orange',
    'purple': 'Purple',
    'violet': 'Purple',
    'pink': 'Pink',
    'teal': 'Teal',
    'turquoise': 'Turquoise',
    'champagne': 'Champagne',
  };
  
  // Check for exact matches in our map
  for (const [key, value] of Object.entries(colorMap)) {
    if (lowerColor === key) {
      return value;
    }
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(colorMap)) {
    if (lowerColor.includes(key)) {
      return value;
    }
  }
  
  // If no match found, capitalize first letter
  return color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
}

/**
 * Normalize transmission type
 * 
 * @param transmission - The transmission type to normalize
 * @returns Normalized transmission type
 */
export function normalizeTransmission(transmission: string): string {
  if (!transmission) return '';
  
  const lowerTransmission = transmission.toLowerCase().trim();
  
  if (/manual|stick|standard|spd|speed/i.test(lowerTransmission)) {
    // Extract number of speeds if present (e.g., "5-speed manual" -> "5-Speed Manual")
    const speedMatch = lowerTransmission.match(/(\d)[- ](?:spd|speed)/i);
    if (speedMatch) {
      return `${speedMatch[1]}-Speed Manual`;
    }
    return 'Manual';
  } else if (/auto|automatic/i.test(lowerTransmission)) {
    return 'Automatic';
  } else if (/semi[- ]auto|semi[- ]automatic|dual[- ]clutch|dct|pdk/i.test(lowerTransmission)) {
    return 'Semi-Automatic';
  } else if (/cvt|continuously/i.test(lowerTransmission)) {
    return 'CVT';
  } else if (/sequential/i.test(lowerTransmission)) {
    return 'Sequential';
  }
  
  return 'Unknown';
}

/**
 * Normalize drivetrain type
 * 
 * @param drivetrain - The drivetrain type to normalize
 * @returns Normalized drivetrain type
 */
export function normalizeDrivetrain(drivetrain: string): string {
  if (!drivetrain) return '';
  
  const lowerDrivetrain = drivetrain.toLowerCase().trim();
  
  if (/rwd|rear[- ]wheel|rear/i.test(lowerDrivetrain)) {
    return 'RWD';
  } else if (/fwd|front[- ]wheel|front/i.test(lowerDrivetrain)) {
    return 'FWD';
  } else if (/awd|all[- ]wheel|all/i.test(lowerDrivetrain)) {
    return 'AWD';
  } else if (/4wd|4x4|four[- ]wheel/i.test(lowerDrivetrain)) {
    return '4WD';
  }
  
  return 'Unknown';
}

/**
 * Normalize fuel type
 * 
 * @param fuel - The fuel type to normalize
 * @returns Normalized fuel type
 */
export function normalizeFuelType(fuel: string): string {
  if (!fuel) return '';
  
  const lowerFuel = fuel.toLowerCase().trim();
  
  if (/gas|gasoline|petrol/i.test(lowerFuel)) {
    return 'Gasoline';
  } else if (/diesel/i.test(lowerFuel)) {
    return 'Diesel';
  } else if (/electric|ev/i.test(lowerFuel)) {
    return 'Electric';
  } else if (/hybrid/i.test(lowerFuel)) {
    return 'Hybrid';
  } else if (/plug-in|plugin|phev/i.test(lowerFuel)) {
    return 'Plug-in Hybrid';
  } else if (/ethanol|e85/i.test(lowerFuel)) {
    return 'Ethanol';
  } else if (/cng|natural gas/i.test(lowerFuel)) {
    return 'CNG';
  } else if (/lpg|propane/i.test(lowerFuel)) {
    return 'LPG';
  } else if (/hydrogen/i.test(lowerFuel)) {
    return 'Hydrogen';
  }
  
  return 'Unknown';
}

/**
 * Normalize engine size (displacement)
 * 
 * @param engineSize - The engine size to normalize
 * @returns Normalized engine size in liters, or null if invalid
 */
export function normalizeEngineSize(engineSize: string | number): number | null {
  if (engineSize === null || engineSize === undefined) return null;
  
  // Convert to string first
  let sizeStr = String(engineSize).trim().toLowerCase();
  
  // Handle common formats
  
  // Format: "5.0L" or "5.0 L" -> 5.0
  let match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*l(?:iter)?s?$/);
  if (match) {
    return parseFloat(match[1]);
  }
  
  // Format: "302 cu in" or "302ci" -> convert to liters (cubic inches / 61.024)
  match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(?:cu(?:bic)?\s*in(?:ch(?:es)?)?|ci)$/);
  if (match) {
    const cubicInches = parseFloat(match[1]);
    return Math.round((cubicInches / 61.024) * 100) / 100; // Convert to liters and round to 2 decimal places
  }
  
  // Format: "2000cc" or "2000 cc" -> convert to liters (cc / 1000)
  match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*cc$/);
  if (match) {
    const cc = parseFloat(match[1]);
    return Math.round((cc / 1000) * 100) / 100; // Convert to liters and round to 2 decimal places
  }
  
  // Try direct conversion if it's just a number
  const sizeNum = parseFloat(sizeStr);
  if (!isNaN(sizeNum)) {
    // If the number is large (>10), assume it's in cc and convert to liters
    if (sizeNum > 10) {
      return Math.round((sizeNum / 1000) * 100) / 100;
    }
    // Otherwise assume it's already in liters
    return Math.round(sizeNum * 100) / 100;
  }
  
  return null;
}

/**
 * Normalize horsepower value
 * 
 * @param horsepower - The horsepower value to normalize
 * @returns Normalized horsepower as a number, or null if invalid
 */
export function normalizeHorsepower(horsepower: string | number): number | null {
  if (horsepower === null || horsepower === undefined) return null;
  
  // Convert to string first
  let hpStr = String(horsepower).trim().toLowerCase();
  
  // Remove "hp", "bhp", etc. and any non-numeric characters
  hpStr = hpStr.replace(/\s*(?:hp|bhp|ps|cv)\b/i, '').replace(/[^\d.]/g, '');
  
  // Convert to number
  const hpNum = parseFloat(hpStr);
  
  // Validate horsepower is reasonable
  if (!isNaN(hpNum) && hpNum > 0 && hpNum < 2000) {
    return Math.round(hpNum);
  }
  
  return null;
}

/**
 * Normalize torque value
 * 
 * @param torque - The torque value to normalize
 * @returns Normalized torque as a number (in lb-ft), or null if invalid
 */
export function normalizeTorque(torque: string | number): number | null {
  if (torque === null || torque === undefined) return null;
  
  // Convert to string first
  let torqueStr = String(torque).trim().toLowerCase();
  
  // Handle lb-ft format
  let match = torqueStr.match(/(\d+(?:\.\d+)?)\s*(?:lb[- ]?ft|ft[- ]?lb)/i);
  if (match) {
    return Math.round(parseFloat(match[1]));
  }
  
  // Handle Nm format and convert to lb-ft (Nm * 0.7376)
  match = torqueStr.match(/(\d+(?:\.\d+)?)\s*(?:nm|n[- ]?m)/i);
  if (match) {
    const nm = parseFloat(match[1]);
    return Math.round(nm * 0.7376);
  }
  
  // Remove non-numeric characters and try direct conversion
  torqueStr = torqueStr.replace(/[^\d.]/g, '');
  const torqueNum = parseFloat(torqueStr);
  
  // Validate torque is reasonable
  if (!isNaN(torqueNum) && torqueNum > 0 && torqueNum < 2000) {
    return Math.round(torqueNum);
  }
  
  return null;
}

/**
 * Normalize a complete vehicle object by standardizing all attributes
 * 
 * @param vehicle - The vehicle object to normalize
 * @returns A new object with normalized attributes
 */
export function normalizeVehicle(vehicle: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = { ...vehicle };
  
  // Apply normalization to each field if present
  if ('make' in vehicle) {
    normalized.make = normalizeMake(vehicle.make);
  }
  
  if ('model' in vehicle) {
    normalized.model = normalizeModel(vehicle.model, normalized.make);
  }
  
  if ('year' in vehicle) {
    normalized.year = normalizeYear(vehicle.year);
  }
  
  if ('mileage' in vehicle) {
    normalized.mileage = normalizeMileage(vehicle.mileage);
  }
  
  if ('price' in vehicle) {
    normalized.price = normalizePrice(vehicle.price);
  }
  
  if ('vin' in vehicle) {
    normalized.vin = normalizeVin(vehicle.vin);
  }
  
  if ('condition' in vehicle) {
    normalized.condition = normalizeCondition(vehicle.condition);
  }
  
  if ('exteriorColor' in vehicle) {
    normalized.exteriorColor = normalizeColor(vehicle.exteriorColor);
  }
  
  if ('interiorColor' in vehicle) {
    normalized.interiorColor = normalizeColor(vehicle.interiorColor);
  }
  
  if ('transmission' in vehicle) {
    normalized.transmission = normalizeTransmission(vehicle.transmission);
  }
  
  if ('drivetrain' in vehicle) {
    normalized.drivetrain = normalizeDrivetrain(vehicle.drivetrain);
  }
  
  if ('fuelType' in vehicle) {
    normalized.fuelType = normalizeFuelType(vehicle.fuelType);
  }
  
  if ('engineSize' in vehicle) {
    normalized.engineSize = normalizeEngineSize(vehicle.engineSize);
  }
  
  if ('horsepower' in vehicle) {
    normalized.horsepower = normalizeHorsepower(vehicle.horsepower);
  }
  
  if ('torque' in vehicle) {
    normalized.torque = normalizeTorque(vehicle.torque);
  }
  
  return normalized;
}

/**
 * Zod schema for validating vehicle data
 */
export const vehicleValidationSchema = z.object({
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().int().min(1900).max(new Date().getFullYear()),
  vin: z.string().optional(),
  mileage: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
  condition: z.string().optional(),
  exteriorColor: z.string().optional(),
  interiorColor: z.string().optional(),
  transmission: z.string().optional(),
  drivetrain: z.string().optional(),
  fuelType: z.string().optional(),
  engineSize: z.number().min(0).optional(),
  horsepower: z.number().int().min(0).optional(),
  torque: z.number().int().min(0).optional(),
});

/**
 * Validate and normalize vehicle data
 * 
 * @param vehicle - The vehicle data to validate and normalize
 * @returns Object with success status, normalized data, and any validation errors
 */
export function validateAndNormalizeVehicle(vehicle: Record<string, any>): {
  success: boolean;
  data?: Record<string, any>;
  errors?: Record<string, string>;
} {
  try {
    // First normalize the data
    const normalizedVehicle = normalizeVehicle(vehicle);
    
    // Then validate using Zod schema
    const result = vehicleValidationSchema.safeParse(normalizedVehicle);
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      // Format validation errors
      const errors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        errors[err.path.join('.')] = err.message;
      });
      
      return {
        success: false,
        errors
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: {
        general: (error as Error).message
      }
    };
  }
} 