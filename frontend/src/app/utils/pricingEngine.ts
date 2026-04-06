import { isSundayOrPublicHoliday } from './holidays';
import type { Carpark } from '../data/carparks';

interface LivePrices {
  car: string;
  motorcycle: string;
  heavy: string;
}

interface PeakWindow {
  days: number[]; // 0=Sun, 1=Mon...6=Sat
  startHour: number; // 24-h format
  endHour: number;
}
type PeakConfig = Record<string, PeakWindow[]>;

const PEAK_CARPARKS: PeakConfig = {
  // ACB, CY: Weekdays, 10:00am to 6:00pm; Weekends, 8:00am to 7:00pm
  "ACB": [{ days: [1,2,3,4,5], startHour: 10, endHour: 18 }, { days: [0,6], startHour: 8, endHour: 19 }],
  "CY": [{ days: [1,2,3,4,5], startHour: 10, endHour: 18 }, { days: [0,6], startHour: 8, endHour: 19 }],
  // SE21, SE22: Monday to Saturday, 10:00am to 10:00pm
  "SE21": [{ days: [1,2,3,4,5,6], startHour: 10, endHour: 22 }],
  "SE22": [{ days: [1,2,3,4,5,6], startHour: 10, endHour: 22 }],
  // SE24: Daily, 10:00am to 10:00pm
  "SE24": [{ days: [0,1,2,3,4,5,6], startHour: 10, endHour: 22 }],
  // MP14, MP15, MP16: Daily, 8:00am to 8:00pm
  "MP14": [{ days: [0,1,2,3,4,5,6], startHour: 8, endHour: 20 }],
  "MP15": [{ days: [0,1,2,3,4,5,6], startHour: 8, endHour: 20 }],
  "MP16": [{ days: [0,1,2,3,4,5,6], startHour: 8, endHour: 20 }],
  // HG9, HG9T, HG15, HG16: Weekdays, 11:00am to 8:00pm; Weekends, 9:00am to 8:00pm
  "HG9": [{ days: [1,2,3,4,5], startHour: 11, endHour: 20 }, { days: [0,6], startHour: 9, endHour: 20 }],
  "HG9T": [{ days: [1,2,3,4,5], startHour: 11, endHour: 20 }, { days: [0,6], startHour: 9, endHour: 20 }],
  "HG15": [{ days: [1,2,3,4,5], startHour: 11, endHour: 20 }, { days: [0,6], startHour: 9, endHour: 20 }],
  "HG16": [{ days: [1,2,3,4,5], startHour: 11, endHour: 20 }, { days: [0,6], startHour: 9, endHour: 20 }],
};

function isPeakActive(id: string, day: number, hour: number): boolean {
  const config = PEAK_CARPARKS[id];
  if (!config) return false;
  return config.some(window => window.days.includes(day) && hour >= window.startHour && hour < window.endHour);
}

function checkIsFreeParkingActive(freeParkingSpec: string | undefined, now: Date): boolean {
  if (!freeParkingSpec || freeParkingSpec === 'NO' || freeParkingSpec.trim() === '') {
    return false;
  }
  // Assume it's SUN & PH
  if (!freeParkingSpec.includes('SUN & PH')) return false;
  if (!isSundayOrPublicHoliday(now)) return false;

  const hour = now.getHours();
  const min = now.getMinutes();

  // Try to parse basic "7AM-10.30PM" vs "1PM-10.30PM" out of the string roughly
  let startHour = 7;
  if (freeParkingSpec.includes('1PM-')) startHour = 13;
  if (freeParkingSpec.includes('8AM-')) startHour = 8;
  
  // They nearly always end at 10.30pm
  let endHour = 22;
  let endMin = 30;

  if (hour < startHour) return false;
  if (hour > endHour || (hour === endHour && min >= endMin)) return false;

  return true;
}

/**
 * Calculates current real-time prices for map UI.
 */
export function calculateLiveRates(carpark: Carpark): LivePrices {
  if (carpark.shortTermParking === 'NO') {
    return {
      car: 'Unavailable',
      motorcycle: 'Unavailable',
      heavy: 'Unavailable'
    };
  }

  // Always use SGT
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
  const hour = now.getHours();
  const day = now.getDay(); 

  const isFree = checkIsFreeParkingActive(carpark.freeParking, now);

  if (isFree) {
    return {
      car: 'Free*',
      motorcycle: 'Free*',
      heavy: '$2.40/hr' // Assuming heavy vehicles do not benefit from FPS
    };
  }

  // --- CAR ---
  let carPriceStr = '$1.20/hr'; // Standard non-central or central non-office-hours
  const hasPeakData = !!PEAK_CARPARKS[carpark.id];

  if (carpark.isPeak && hasPeakData) {
    if (isPeakActive(carpark.id, day, hour)) {
      carPriceStr = carpark.isCentral ? '$2.80/hr' : '$1.60/hr';
    } else {
      // Standard rates apply outside peak. Central bounds apply? 
      // HDB says: Central $1.20 per half hour from 7am-5pm. Outside 5pm it's $0.60.
      if (carpark.isCentral && day >= 1 && day <= 6 && hour >= 7 && hour < 17) {
        carPriceStr = '$2.40/hr';
      } else {
        carPriceStr = '$1.20/hr';
      }
    }
  } else if (carpark.isPeak) {
      // Without exact data, return standard but with warning
      if (carpark.isCentral && day >= 1 && day <= 6 && hour >= 7 && hour < 17) {
        carPriceStr = '$2.40/hr (Peak surcharge may apply)';
      } else {
        carPriceStr = '$1.20/hr (Peak surcharge may apply)';
      }
  } else if (carpark.isCentral) {
    // Normal central rules: 7am - 5pm Mon-Sat is double
    if (day >= 1 && day <= 6 && hour >= 7 && hour < 17) {
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

  if (carpark.shortTermParking === 'NO') {
    const unav = "Short-term parking unavailable";
    return { car: [unav], motorcycle: [unav], heavy: [unav] };
  }

  // Car Details
  if (carpark.isPeak) {
    const peakStr = PEAK_CARPARKS[carpark.id] ? "during specific peak hours" : "(Specific Peak-hour surcharge may apply)";
    if (carpark.isCentral) {
      breakdown.car.push(`Peak Hours: $1.40 per half-hour ${peakStr}`);
      breakdown.car.push("Non-Peak (Mon-Sat 7am-5pm): $1.20 per half-hour");
      breakdown.car.push("Other Hours: $0.60 per half-hour");
    } else {
      breakdown.car.push(`Peak Hours: $0.80 per half-hour ${peakStr}`);
      breakdown.car.push("Other Hours: $0.60 per half-hour");
    }
  } else if (carpark.isCentral) {
    breakdown.car.push("Mon-Sat (7:00am to 5:00pm): $1.20 per half-hour");
    breakdown.car.push("Other Hours: $0.60 per half-hour");
  } else {
    breakdown.car.push("All Hours: $0.60 per half-hour");
  }

  // Caps
  if (!carpark.isPeak) {
    if (carpark.nightParking) {
      breakdown.car.push("Night Cap: $5.00 from 10:30pm to 7:00am");
      const cap = carpark.isCentral ? "$20.00" : "$12.00";
      breakdown.car.push(`Whole-day Cap: ${cap} (7:00am to 7:00am next day)`);
    } else {
      const cap = carpark.isCentral ? "$20.00" : "$12.00";
      breakdown.car.push(`Whole-day Cap: ${cap} (7:00am to 7:00am next day)`);
    }
  } else {
      breakdown.car.push("Caps: Whole-day caps are not applicable to peak-hour carparks.");
  }

  if (carpark.freeParking && carpark.freeParking !== 'NO') {
    breakdown.car.push(`Free Parking: ${carpark.freeParking}`);
    breakdown.car.push("* Free parking excludes season-parking-reserved lots");
  }

  // Motorcycle Details
  breakdown.motorcycle.push("Whole Day (7:00am to 10:30pm): $0.65 per session");
  breakdown.motorcycle.push("Whole Night (10:30pm to 7:00am): $0.65 per session");
  if (carpark.freeParking && carpark.freeParking !== 'NO') {
    breakdown.motorcycle.push(`Free Parking: ${carpark.freeParking}`);
    breakdown.motorcycle.push("* Free parking excludes season-parking-reserved lots");
  }

  // Heavy Details
  breakdown.heavy.push("All Hours: $1.20 per half-hour ($2.40/hr)");

  return breakdown;
}
