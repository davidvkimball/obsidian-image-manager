/**
 * Kebab-case utility
 * Converts strings to kebab-case for safe filenames
 * Based on Astro Composer's implementation
 */

/**
 * Convert a string to kebab-case
 */
export function toKebabCase(str: string): string {
	return str
		.toLowerCase()
		// Remove or replace problematic characters for filenames
		.replace(/[<>:"/\\|?*]/g, '') // Remove Windows/Unix invalid filename characters
		.replace(/['"]/g, '') // Remove quotes
		.replace(/[^\w\s-]/g, '') // Remove other special characters but keep letters, numbers, spaces, hyphens
		.trim()
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}
