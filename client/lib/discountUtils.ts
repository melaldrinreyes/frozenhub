/**
 * Discount calculation utilities
 * These functions mirror the server-side logic for consistency
 */

export interface Promo {
  id: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount?: number | null;
  min_purchase?: number | null;
  product_ids?: string[];
}

/**
 * Calculate the discount amount for a single item
 * @param price - Item price
 * @param discountType - Type of discount (percentage or fixed)
 * @param discountValue - Value of the discount
 * @param maxDiscount - Maximum discount cap (optional)
 * @returns The discount amount
 */
export function calculateItemDiscount(
  price: number,
  discountType: 'percentage' | 'fixed',
  discountValue: number,
  maxDiscount?: number | null
): number {
  if (discountType === 'percentage') {
    const discount = (price * discountValue) / 100;
    return maxDiscount && discount > maxDiscount ? maxDiscount : discount;
  } else {
    // Fixed discount per item
    const discount = discountValue;
    return maxDiscount && discount > maxDiscount ? maxDiscount : discount;
  }
}

/**
 * Calculate the discount amount for multiple items (used in cart/sales)
 * @param price - Item price
 * @param quantity - Number of items
 * @param discountType - Type of discount (percentage or fixed)
 * @param discountValue - Value of the discount
 * @param maxDiscount - Maximum discount cap (optional)
 * @returns The total discount amount for all items
 */
export function calculatePromoDiscount(
  price: number,
  quantity: number,
  discountType: 'percentage' | 'fixed',
  discountValue: number,
  maxDiscount?: number | null
): number {
  const subtotal = price * quantity;
  
  if (discountType === 'percentage') {
    const discount = (subtotal * discountValue) / 100;
    return maxDiscount && discount > maxDiscount ? maxDiscount : discount;
  } else {
    // Fixed discount applies per item
    const discount = discountValue * quantity;
    return maxDiscount && discount > maxDiscount ? maxDiscount : discount;
  }
}

/**
 * Calculate the final price after discount for a single item
 * @param price - Original price
 * @param promo - Promo details
 * @returns The discounted price (never below 0)
 */
export function getDiscountedPrice(price: number, promo: Promo | null | undefined, cartSubtotal?: number): number {
  if (!promo) return price;

  // Check minimum purchase requirement if cartSubtotal is provided
  if (cartSubtotal !== undefined && promo.min_purchase && promo.min_purchase > 0) {
    if (!meetsMinimumPurchase(cartSubtotal, promo.min_purchase)) {
      return price; // Return original price if minimum purchase not met
    }
  }

  const discount = calculateItemDiscount(
    price,
    promo.discount_type,
    promo.discount_value,
    promo.max_discount
  );

  return Math.max(0, price - discount);
}

/**
 * Get discount amount for an item with promo
 * @param price - Item price
 * @param promo - Promo details
 * @param cartSubtotal - Cart subtotal (optional, for minimum purchase validation)
 * @returns The discount amount
 */
export function getDiscountAmount(price: number, promo: Promo | null | undefined, cartSubtotal?: number): number {
  if (!promo) return 0;

  // Check minimum purchase requirement if cartSubtotal is provided
  if (cartSubtotal !== undefined && promo.min_purchase && promo.min_purchase > 0) {
    if (!meetsMinimumPurchase(cartSubtotal, promo.min_purchase)) {
      return 0; // Don't apply discount if minimum purchase not met
    }
  }

  return calculateItemDiscount(
    price,
    promo.discount_type,
    promo.discount_value,
    promo.max_discount
  );
}

/**
 * Check if cart meets minimum purchase requirement for a promo
 * @param cartSubtotal - Total cart subtotal (before discount)
 * @param minPurchase - Minimum purchase requirement
 * @returns Whether the cart meets the requirement
 */
export function meetsMinimumPurchase(cartSubtotal: number, minPurchase?: number | null): boolean {
  if (!minPurchase || minPurchase <= 0) return true;
  return cartSubtotal >= minPurchase;
}

/**
 * Check if a promo qualifies based on minimum purchase
 * @param promo - Promo details
 * @param cartSubtotal - Current cart subtotal
 * @returns Whether the promo qualifies
 */
export function promoQualifies(promo: Promo | null | undefined, cartSubtotal: number): boolean {
  if (!promo) return false;
  return meetsMinimumPurchase(cartSubtotal, promo.min_purchase);
}

/**
 * Calculate the final subtotal and discount for cart items
 * @param items - Array of cart items with price, quantity, and optional promo
 * @returns Object with subtotal, totalDiscount, and finalTotal
 */
export function calculateCartTotals(
  items: Array<{
    price: number;
    quantity: number;
    promo?: Promo | null;
  }>
): {
  subtotal: number;
  totalDiscount: number;
  finalTotal: number;
  appliedPromos: string[];
  notAppliedPromos: Array<{ name: string; reason: string; minPurchase: number }>;
} {
  let subtotal = 0;
  let totalDiscount = 0;
  const appliedPromos: string[] = [];
  const notAppliedPromos: Array<{ name: string; reason: string; minPurchase: number }> = [];

  // Calculate subtotal and apply discounts
  for (const item of items) {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    
    if (item.promo) {
      const discount = calculatePromoDiscount(
        item.price,
        item.quantity,
        item.promo.discount_type,
        item.promo.discount_value,
        item.promo.max_discount
      );
      totalDiscount += discount;
      
      if (!appliedPromos.includes(item.promo.name)) {
        appliedPromos.push(item.promo.name);
      }
    }
  }

  const finalTotal = Math.max(0, subtotal - totalDiscount);

  return {
    subtotal,
    totalDiscount,
    finalTotal,
    appliedPromos,
    notAppliedPromos
  };
}

/**
 * Format currency value
 * @param amount - Amount to format (can be number or string)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '₱0.00';
  return `₱${numAmount.toFixed(2)}`;
}

/**
 * Calculate percentage discount based on original and final prices
 * @param originalPrice - Original price
 * @param finalPrice - Final price after discount
 * @returns Percentage discount
 */
export function calculatePercentageDiscount(originalPrice: number, finalPrice: number): number {
  if (originalPrice <= 0) return 0;
  return ((originalPrice - finalPrice) / originalPrice) * 100;
}

/**
 * Format a date from various formats (Firestore Timestamp, Date object, string)
 */
export function formatPromoDate(dateValue: any): string {
  if (!dateValue) return '';
  
  try {
    let date: Date;
    
    // Handle Firestore Timestamp
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      date = dateValue.toDate();
    }
    // Handle milliseconds timestamp  
    else if (typeof dateValue === 'number') {
      date = new Date(dateValue);
    }
    // Handle Date object
    else if (dateValue instanceof Date) {
      date = dateValue;
    }
    // Handle string date
    else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    }
    // Handle object with seconds (Firestore format)
    else if (dateValue.seconds) {
      date = new Date(dateValue.seconds * 1000);
    }
    else {
      return '';
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return date.toLocaleDateString('en-US', {
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
 * Get countdown text for promo (e.g., "2 days left", "Expired")
 */
export function getPromoCountdown(endDate: any): string {
  if (!endDate) return '';
  
  try {
    let date: Date;
    
    // Handle different date formats same as formatPromoDate
    if (endDate.toDate && typeof endDate.toDate === 'function') {
      date = endDate.toDate();
    } else if (typeof endDate === 'number') {
      date = new Date(endDate);
    } else if (endDate instanceof Date) {
      date = endDate;
    } else if (typeof endDate === 'string') {
      date = new Date(endDate);
    } else if (endDate.seconds) {
      date = new Date(endDate.seconds * 1000);
    } else {
      return '';
    }
    
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const now = new Date();
    const timeDiff = date.getTime() - now.getTime();
    
    if (timeDiff <= 0) {
      return 'Expired';
    }
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} left`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} left`;
    } else {
      return 'Ending soon';
    }
  } catch (error) {
    console.error('Error getting countdown:', error);
    return '';
  }
}

/**
 * Get promo status badge info
 */
export function getPromoStatus(startDate: any, endDate: any): { status: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  const now = new Date();
  
  try {
    let start: Date, end: Date;
    
    // Parse start date
    if (startDate?.toDate) start = startDate.toDate();
    else if (startDate?.seconds) start = new Date(startDate.seconds * 1000);
    else if (startDate) start = new Date(startDate);
    else return { status: 'Unknown', variant: 'outline' };
    
    // Parse end date  
    if (endDate?.toDate) end = endDate.toDate();
    else if (endDate?.seconds) end = new Date(endDate.seconds * 1000);
    else if (endDate) end = new Date(endDate);
    else return { status: 'Unknown', variant: 'outline' };
    
    if (now < start) {
      return { status: 'Upcoming', variant: 'secondary' };
    } else if (now > end) {
      return { status: 'Expired', variant: 'destructive' };
    } else {
      return { status: 'Active', variant: 'default' };
    }
  } catch (error) {
    return { status: 'Unknown', variant: 'outline' };
  }
}

/**
 * Format promo description safely
 */
export function formatPromoDescription(promo: any, discountDisplay: string): string {
  if (promo.description && promo.description.trim()) {
    return promo.description;
  }
  return `Get ${discountDisplay} on ${promo.product_count || 'selected'} product${(promo.product_count && promo.product_count !== 1) ? 's' : ''}`;
}

/**
 * Format discount display text
 */
export function formatDiscountDisplay(promo: any): string {
  if (!promo || !promo.discount_value || promo.discount_value <= 0) {
    return '0% OFF';
  }
  
  return promo.discount_type === 'percentage'
    ? `${promo.discount_value}% OFF`
    : `₱${promo.discount_value.toFixed(2)} OFF`;
}
