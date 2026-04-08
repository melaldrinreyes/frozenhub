/**
 * Date utility functions for promo display
 */

/**
 * Format a date to readable string
 */
export function formatDate(date: Date | string | any): string {
  if (!date) return '';
  
  try {
    let dateObj: Date;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date.toDate && typeof date.toDate === 'function') {
      // Firestore Timestamp
      dateObj = date.toDate();
    } else if (date.seconds) {
      // Firestore Timestamp object
      dateObj = new Date(date.seconds * 1000);
    } else {
      dateObj = new Date(date);
    }
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string | any): string {
  if (!date) return '';
  
  try {
    let dateObj: Date;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date.toDate && typeof date.toDate === 'function') {
      // Firestore Timestamp
      dateObj = date.toDate();
    } else if (date.seconds) {
      // Firestore Timestamp object
      dateObj = new Date(date.seconds * 1000);
    } else {
      dateObj = new Date(date);
    }
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return '';
  }
}

/**
 * Calculate time remaining until a date
 */
export function getTimeRemaining(endDate: Date | string | any): {
  days: number;
  hours: number;
  minutes: number;
  total: number;
  isExpired: boolean;
  formatted: string;
} {
  if (!endDate) {
    return { days: 0, hours: 0, minutes: 0, total: 0, isExpired: true, formatted: 'Expired' };
  }
  
  try {
    let endDateObj: Date;
    
    if (endDate instanceof Date) {
      endDateObj = endDate;
    } else if (typeof endDate === 'string') {
      endDateObj = new Date(endDate);
    } else if (endDate.toDate && typeof endDate.toDate === 'function') {
      // Firestore Timestamp
      endDateObj = endDate.toDate();
    } else if (endDate.seconds) {
      // Firestore Timestamp object
      endDateObj = new Date(endDate.seconds * 1000);
    } else {
      endDateObj = new Date(endDate);
    }
    
    if (isNaN(endDateObj.getTime())) {
      return { days: 0, hours: 0, minutes: 0, total: 0, isExpired: true, formatted: 'Invalid Date' };
    }
    
    const now = new Date().getTime();
    const end = endDateObj.getTime();
    const total = end - now;
    
    if (total <= 0) {
      return { days: 0, hours: 0, minutes: 0, total: 0, isExpired: true, formatted: 'Expired' };
    }
    
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
    
    let formatted = '';
    if (days > 0) {
      formatted = `${days}d ${hours}h`;
    } else if (hours > 0) {
      formatted = `${hours}h ${minutes}m`;
    } else {
      formatted = `${minutes}m`;
    }
    
    return { days, hours, minutes, total, isExpired: false, formatted };
  } catch (error) {
    console.error('Error calculating time remaining:', error);
    return { days: 0, hours: 0, minutes: 0, total: 0, isExpired: true, formatted: 'Error' };
  }
}

/**
 * Check if a promo is currently active
 */
export function isPromoActive(startDate: any, endDate: any): boolean {
  try {
    const now = new Date();
    
    let start: Date, end: Date;
    
    // Handle Firestore Timestamps
    if (startDate?.toDate) start = startDate.toDate();
    else if (startDate?.seconds) start = new Date(startDate.seconds * 1000);
    else start = new Date(startDate);
    
    if (endDate?.toDate) end = endDate.toDate();
    else if (endDate?.seconds) end = new Date(endDate.seconds * 1000);
    else end = new Date(endDate);
    
    return now >= start && now <= end;
  } catch (error) {
    console.error('Error checking promo active status:', error);
    return false;
  }
}

/**
 * Get promo status text
 */
export function getPromoStatus(startDate: any, endDate: any): {
  status: 'upcoming' | 'active' | 'expired';
  text: string;
  color: string;
} {
  try {
    const now = new Date();
    
    let start: Date, end: Date;
    
    // Handle Firestore Timestamps
    if (startDate?.toDate) start = startDate.toDate();
    else if (startDate?.seconds) start = new Date(startDate.seconds * 1000);
    else start = new Date(startDate);
    
    if (endDate?.toDate) end = endDate.toDate();
    else if (endDate?.seconds) end = new Date(endDate.seconds * 1000);
    else end = new Date(endDate);
    
    if (now < start) {
      return { status: 'upcoming', text: 'Coming Soon', color: 'bg-blue-500' };
    } else if (now > end) {
      return { status: 'expired', text: 'Expired', color: 'bg-gray-500' };
    } else {
      const timeLeft = getTimeRemaining(end);
      return { status: 'active', text: `Ending Soon`, color: 'bg-orange-500' };
    }
  } catch (error) {
    console.error('Error getting promo status:', error);
    return { status: 'expired', text: 'Error', color: 'bg-gray-500' };
  }
}