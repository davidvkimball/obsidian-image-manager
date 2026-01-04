/**
 * Template Engine for Image Naming
 * Renders name templates with variable substitution
 */

import { TFile, App } from 'obsidian';
import { NameTemplateVariables } from '../types';

/**
 * Available template variables and their descriptions
 */
export const TEMPLATE_VARIABLES = {
	'{{fileName}}': 'Name of the current note (without extension)',
	'{{dirName}}': 'Name of the containing folder',
	'{{imageNameKey}}': 'Value from imageNameKey property',
	'{{firstHeading}}': 'First H1 heading in the note',
	'{{DATE:format}}': 'Current date (e.g., {{DATE:YYYY-MM-DD}})',
	'{{TIME:format}}': 'Current time (e.g., {{TIME:HH-mm-ss}})',
};

/**
 * Render a template string with variable substitution
 */
export function renderTemplate(
	template: string,
	variables: NameTemplateVariables,
	frontmatter?: Record<string, unknown>
): string {
	let result = template;

	// Basic variables
	result = result.replace(/\{\{fileName\}\}/g, variables.fileName);
	result = result.replace(/\{\{dirName\}\}/g, variables.dirName);
	result = result.replace(/\{\{imageNameKey\}\}/g, variables.imageNameKey ?? '');
	result = result.replace(/\{\{firstHeading\}\}/g, variables.firstHeading ?? '');

	// Date formatting
	result = result.replace(/\{\{DATE:([^}]+)\}\}/g, (_, format: string) => {
		return formatDate(new Date(), format);
	});

	// Time formatting
	result = result.replace(/\{\{TIME:([^}]+)\}\}/g, (_, format: string) => {
		return formatTime(new Date(), format);
	});

	// Frontmatter variables (if provided)
	if (frontmatter) {
		result = result.replace(/\{\{fm:([^}]+)\}\}/g, (_, key: string) => {
			const value = frontmatter[key.trim()];
			if (value == null) return '';
			if (typeof value === 'string') return value;
			if (typeof value === 'number' || typeof value === 'boolean') return String(value);
			return '';
		});
	}

	return result;
}

/**
 * Format a date using a simple format string
 * Supports: YYYY, YY, MM, DD, M, D
 */
function formatDate(date: Date, format: string): string {
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();

	return format
		.replace('YYYY', String(year))
		.replace('YY', String(year).slice(-2))
		.replace('MM', String(month).padStart(2, '0'))
		.replace('DD', String(day).padStart(2, '0'))
		.replace('M', String(month))
		.replace('D', String(day));
}

/**
 * Format time using a simple format string
 * Supports: HH, mm, ss, H, m, s
 */
function formatTime(date: Date, format: string): string {
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const seconds = date.getSeconds();

	return format
		.replace('HH', String(hours).padStart(2, '0'))
		.replace('mm', String(minutes).padStart(2, '0'))
		.replace('ss', String(seconds).padStart(2, '0'))
		.replace('H', String(hours))
		.replace('m', String(minutes))
		.replace('s', String(seconds));
}

/**
 * Build template variables from a file and app context
 */
export function buildTemplateVariables(
	app: App,
	activeFile: TFile
): NameTemplateVariables {
	const cache = app.metadataCache.getFileCache(activeFile);
	const frontmatter = cache?.frontmatter;
	
	// Get first H1 heading
	let firstHeading = '';
	if (cache?.headings) {
		for (const heading of cache.headings) {
			if (heading.level === 1) {
				firstHeading = heading.heading;
				break;
			}
		}
	}

	return {
		fileName: activeFile.basename,
		dirName: activeFile.parent?.name ?? '',
		imageNameKey: frontmatter?.imageNameKey as string | undefined,
		firstHeading,
		date: formatDate(new Date(), 'YYYY-MM-DD'),
		time: formatTime(new Date(), 'HH-mm-ss'),
	};
}

/**
 * Check if a rendered template result is meaningful (not empty/whitespace)
 */
export function isTemplateMeaningful(result: string, delimiter: string): boolean {
	// Remove delimiters and whitespace to check if there's actual content
	const meaninglessRegex = new RegExp(`[${escapeRegExp(delimiter)}\\s]`, 'gm');
	return result.replace(meaninglessRegex, '') !== '';
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
