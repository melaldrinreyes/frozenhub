/**
 * SKU Generator Utility
 * Generates unique SKU codes for products
 */

import crypto from "crypto";

/**
 * Generate SKU from product name and category
 * Format: [CATEGORY-PREFIX]-[NAME-PREFIX]-[RANDOM]
 * Example: BEV-COK-A1B2C3 (Beverage - Coke - Random)
 */
export function generateSKU(productName: string, category: string): string {
  // Get category prefix (first 3 letters, uppercase)
  const categoryPrefix = category
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, "X");

  // Get product prefix (first 3 consonants or letters, uppercase)
  const consonants = productName
    .replace(/[^a-zA-Z]/g, "")
    .replace(/[aeiouAEIOU]/g, "")
    .substring(0, 3)
    .toUpperCase();
  
  const productPrefix = consonants.length >= 3
    ? consonants.substring(0, 3)
    : productName
        .replace(/[^a-zA-Z]/g, "")
        .substring(0, 3)
        .toUpperCase()
        .padEnd(3, "X");

  // Generate random alphanumeric suffix (6 characters)
  const randomSuffix = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return `${categoryPrefix}-${productPrefix}-${randomSuffix}`;
}

/**
 * Generate sequential SKU with counter
 * Format: [CATEGORY]-[COUNTER]
 * Example: BEV-0001, BEV-0002
 */
export function generateSequentialSKU(category: string, counter: number): string {
  const categoryPrefix = category
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, "X");

  const counterStr = counter.toString().padStart(4, "0");
  return `${categoryPrefix}-${counterStr}`;
}

/**
 * Generate SKU with timestamp
 * Format: [CATEGORY]-[TIMESTAMP]
 * Example: BEV-20251108123456
 */
export function generateTimestampSKU(category: string): string {
  const categoryPrefix = category
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, "X");

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .substring(0, 14);

  return `${categoryPrefix}-${timestamp}`;
}

/**
 * Validate SKU format
 * Checks if SKU matches expected pattern
 */
export function validateSKU(sku: string): boolean {
  // Basic validation: 3+ chars, alphanumeric and hyphens only
  const skuRegex = /^[A-Z0-9-]{3,}$/;
  return skuRegex.test(sku);
}

/**
 * Generate multiple unique SKUs and pick one not in database
 * Used when there might be collisions
 */
export function generateUniqueSKUs(
  productName: string,
  category: string,
  count: number = 3
): string[] {
  const skus: string[] = [];
  
  for (let i = 0; i < count; i++) {
    skus.push(generateSKU(productName, category));
  }
  
  return skus;
}

/**
 * Clean product name for SKU generation
 * Removes special characters and normalizes
 */
export function cleanProductName(name: string): string {
  return name
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .toUpperCase();
}
