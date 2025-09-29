import { Lead } from '../context/LeadContext';
import { COLUMN_ORDER } from './columnConfig';

/**
 * Get dynamic export headers based on current header configuration
 * @param getDisplayName Function that returns the display name for a field
 * @returns Array of header names in COLUMN_ORDER sequence
 * @deprecated EXPORT_HEADERS (from all-leads) is static and won't reflect custom labels. Use this function for dynamic headers.
 */
export const getExportHeaders = (getDisplayName: (f: keyof Lead) => string): string[] => {
  return COLUMN_ORDER.map(getDisplayName);
};
