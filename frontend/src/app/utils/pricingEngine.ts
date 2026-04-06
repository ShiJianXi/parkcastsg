import { isSundayOrPublicHoliday } from './holidays';
import type { Carpark } from '../data/carparks';

interface LivePrices {
  car: string;
  motorcycle: string;
  heavy: string;
}

/**
 * Calculates current real-time prices for map UI.
 */
export function calculateLiveRates(carpark: Carpark): LivePrices {
  // Always use SGT
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
  const hour = now.getHours();
  // 1 = Monday, 6 = Saturday, 0 = Sunday
  const day = now.getDay(); 

  const isFree = carpark.freeParking === 'SUN & PH FR 7AM-10.30PM' && 
                 isSundayOrPublicHoliday(now) && 
                 (hour >= 7 && (hour < 22 || (hour === 22 && now.getMinutes() <= 30)));

  if (isFree) {
    return {
      car: 'Free',
      motorcycle: 'Free',
      heavy: '$2.40/hr' // Assuming heavy vehicles do not benefit from FPS generally
    };
  }

  // --- CAR ---
  let carPriceStr = '$1.20/hr'; // Standard
  const isNight = hour >= 22 && now.getMinutes() >= 30 || hour < 7;
  
  if (carpark.isPeak) {
    // Basic peak logic: we assume peak is active during 10am-6pm (simplification of peak times)
    if (day >= 1 && day <= 6 && hour >= 10 && hour < 18) {
      if (carpark.isCentral) {
         carPriceStr = '$2.80/hr';
      } else {
         carPriceStr = '$1.60/hr';
      }
    } else {
      if (carpark.isCentral && (day >= 1 && day <= 6) && hour >= 7 && hour < 17) {
        carPriceStr = '$2.40/hr'; // Normal central
      }
    }
  } else if (carpark.isCentral) {
    if ((day >= 1 && day <= 6) && hour >= 7 && hour < 17) {
      carPriceStr = '$2.40/hr';
    } else {
       carPriceStr = '$1.20/hr';
    }
  }

  // --- MOTORCYCLE ---
  const motorcyclePriceStr = '$0.65/sess';

  // --- HEAVY VEHICLE ---
  const heavyPriceStr = '$2.40/hr';

  return {
    car: carPriceStr,
    motorcycle: motorcyclePriceStr,
    heavy: heavyPriceStr
  };
}

/**
 * Generates detailed breakdowns for the detail page.
 */
export function generatePricingBreakdown(carpark: Carpark) {
  const breakdown = {
    car: [] as string[],
    motorcycle: [] as string[],
    heavy: [] as string[]
  };

  // Car Details
  if (carpark.isPeak) {
    if (carpark.isCentral) {
      breakdown.car.push("Peak Hours: $1.40 per half-hour");
      breakdown.car.push("Non-Peak (Mon-Sat 7am-5pm): $1.20 per half-hour");
      breakdown.car.push("Other Hours: $0.60 per half-hour");
    } else {
      breakdown.car.push("Peak Hours: $0.80 per half-hour");
      breakdown.car.push("Other Hours: $0.60 per half-hour");
    }
  } else if (carpark.isCentral) {
    breakdown.car.push("Mon-Sat (7:00am to 5:00pm): $1.20 per half-hour");
    breakdown.car.push("Other Hours: $0.60 per half-hour");
  } else {
    breakdown.car.push("All Hours: $0.60 per half-hour");
  }

  if (carpark.nightParking) {
    breakdown.car.push("Night Cap: $5.00 from 10:30pm to 7:00am");
    const cap = carpark.isCentral ? "$20.00" : "$12.00";
    breakdown.car.push(`Whole-day Cap: ${cap} (7:00am to 7:00am next day)`);
  } else {
    const cap = carpark.isCentral ? "$20.00" : "$12.00";
    breakdown.car.push(`Day Cap (7am to 10:30pm): ${cap}`);
  }

  if (carpark.freeParking === 'SUN & PH FR 7AM-10.30PM') {
    breakdown.car.push("Free Parking on Sundays & Public Holidays (7am to 10:30pm)");
  }

  // Motorcycle Details
  breakdown.motorcycle.push("Whole Day (7:00am to 10:30pm): $0.65 per session");
  breakdown.motorcycle.push("Whole Night (10:30pm to 7:00am): $0.65 per session");
  if (carpark.freeParking === 'SUN & PH FR 7AM-10.30PM') {
    breakdown.motorcycle.push("Free Parking on Sundays & Public Holidays (7am to 10:30pm)");
  }

  // Heavy Details
  breakdown.heavy.push("All Hours: $1.20 per half-hour ($2.40/hr)");

  return breakdown;
}
