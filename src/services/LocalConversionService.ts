/**
 * Local Conversion Service
 * Converts remote/external images to local files
 */

import { App, TFile, requestUrl } from 'obsidian';
import { ImageManagerSettings } from '../types';
import { StorageManager } from './StorageManager';
import { ImageProcessor } from './ImageProcessor';
import { isMarkdownFile } from '../utils/mdx-frontmatter';

// Regex patterns for finding external images
// Updated to handle URLs with query parameters and fragments
const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
const HTML_IMAGE_REGEX = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/g;

export class LocalConversionService {
	private app: App;
	private settings: ImageManagerSettings;
	private storageManager: StorageManager;
	private imageProcessor: ImageProcessor;

	constructor(app: App, settings: ImageManagerSettings, storageManager: StorageManager, imageProcessor: ImageProcessor) {
		this.app = app;
		this.settings = settings;
		this.storageManager = storageManager;
		this.imageProcessor = imageProcessor;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: ImageManagerSettings): void {
		this.settings = settings;
		this.imageProcessor?.updateSettings(settings);
	}

	/**
	 * Process a file to convert all remote images to local
	 */
	async processFile(file: TFile): Promise<number> {
		if (!isMarkdownFile(file)) {
			return 0;
		}

		const content = await this.app.vault.read(file);
		const { newContent, count } = await this.processContent(content, file);

		if (count > 0) {
			await this.app.vault.modify(file, newContent);
		}

		return count;
	}

	/**
	 * Process content and replace remote images with local
	 */
	private async processContent(
		content: string,
		sourceFile: TFile
	): Promise<{ newContent: string; count: number }> {
		let newContent = content;
		let count = 0;

		// Find all external image URLs
		const externalImages = this.findExternalImages(content, sourceFile);

		for (const image of externalImages) {
			try {
				// Download and save temporarily
				const tempPath = await this.downloadAndSave(image.url, sourceFile);
				if (!tempPath) {
					continue;
				}

				const tempFile = this.app.vault.getAbstractFileByPath(tempPath);
				if (!(tempFile instanceof TFile)) {
					continue;
				}

				// Show rename modal if enabled (always show for conversion, unless auto-rename is on)
				let finalFile: TFile = tempFile;
				
				// Generate suggested name from alt text or URL
				const suggestedName = image.alt 
					? this.storageManager.sanitizeFileName(image.alt)
					: tempFile.basename;

				// Use ImageProcessor's rename flow (which handles descriptive images and rename modal)
				// For conversion, always show rename modal unless auto-rename is enabled
				const result = await this.imageProcessor.renameImageFile(
					tempFile,
					suggestedName,
					sourceFile
				);

				if (result && result.file) {
					finalFile = result.file;
				} else {
					// User cancelled rename, skip this image
					await this.app.fileManager.trashFile(tempFile);
					continue;
				}

				// Update the content with the final file
				// The replacement function needs the full path to generate proper relative links
				newContent = newContent.replace(image.fullMatch, image.replacement(finalFile.path));
				count++;
			} catch (error) {
				console.error(`Failed to convert image: ${image.url}`, error);
			}
		}

		return { newContent, count };
	}

	/**
	 * Check if a position in content is inside a code block
	 */
	private isInsideCodeBlock(content: string, position: number): boolean {
		// Check for fenced code blocks (```...```)
		const fencedCodeBlockRegex = /```[\s\S]*?```/g;
		let match;
		while ((match = fencedCodeBlockRegex.exec(content)) !== null) {
			const start = match.index;
			const end = start + match[0].length;
			if (position >= start && position < end) {
				return true;
			}
		}

		// Check for inline code (`...`)
		// We need to be careful - only match backticks that aren't part of fenced blocks
		// First, mark all fenced code block positions
		const fencedPositions: boolean[] = new Array(content.length).fill(false);
		const fencedRegex = /```[\s\S]*?```/g;
		while ((match = fencedRegex.exec(content)) !== null) {
			for (let i = match.index; i < match.index + match[0].length; i++) {
				fencedPositions[i] = true;
			}
		}

		// Now check for inline code, but skip positions inside fenced blocks
		const inlineCodeRegex = /`[^`\n]+`/g;
		while ((match = inlineCodeRegex.exec(content)) !== null) {
			// Skip if this match is inside a fenced code block
			if (fencedPositions[match.index]) {
				continue;
			}
			const start = match.index;
			const end = start + match[0].length;
			if (position >= start && position < end) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Find all external images in content
	 */
	private findExternalImages(content: string, sourceFile: TFile): ExternalImageMatch[] {
		const matches: ExternalImageMatch[] = [];

		// Markdown images: ![alt](url)
		let match;
		const mdRegex = new RegExp(MARKDOWN_IMAGE_REGEX.source, 'g');
		while ((match = mdRegex.exec(content)) !== null) {
			const matchIndex = match.index;
			// Skip if inside a code block
			if (this.isInsideCodeBlock(content, matchIndex)) {
				continue;
			}

			const fullMatch = match[0];
			const alt = match[1] ?? '';
			const url = match[2];
			if (url && this.isExternalUrl(url)) {
				const sourceFileRef = sourceFile; // Capture for closure
				matches.push({
					fullMatch,
					url,
					alt,
					replacement: (localPath: string) => {
						// Get the saved file to generate proper markdown link
						const savedFile = this.app.vault.getAbstractFileByPath(localPath);
						if (savedFile instanceof TFile) {
							const link = this.storageManager.generateMarkdownLink(savedFile, sourceFileRef.path);
							// If we have alt text and link is wikilink, add display text
							if (alt && link.startsWith('![') && link.includes(']]')) {
								return link.replace(']]', `|${alt}]]`);
							}
							// For markdown links, replace the URL but keep alt
							if (link.startsWith('![') && link.includes('](')) {
								// Extract just the path part from the generated link and use it with alt
								const pathMatch = link.match(/\]\(([^)]+)\)/);
								if (pathMatch) {
									return `![${alt}](${pathMatch[1]})`;
								}
								return `![${alt}](${encodeURI(localPath)})`;
							}
							return link;
						}
						// Fallback - use relative path
						const relativePath = this.storageManager.getRelativePath(sourceFileRef, this.app.vault.getAbstractFileByPath(localPath) as TFile);
						return `![${alt}](${encodeURI(relativePath)})`;
					},
				});
			}
		}

		// HTML images: <img src="url">
		const htmlRegex = new RegExp(HTML_IMAGE_REGEX.source, 'g');
		while ((match = htmlRegex.exec(content)) !== null) {
			const matchIndex = match.index;
			// Skip if inside a code block
			if (this.isInsideCodeBlock(content, matchIndex)) {
				continue;
			}
			const fullMatch = match[0];
			const url = match[1];
			if (url && this.isExternalUrl(url)) {
				matches.push({
					fullMatch,
					url,
					replacement: (localPath: string) => `![](${encodeURI(localPath)})`,
				});
			}
		}

		return matches;
	}

	/**
	 * Check if a URL is external
	 */
	private isExternalUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			return ['http:', 'https:'].includes(parsed.protocol);
		} catch {
			return false;
		}
	}

	/**
	 * Download an image and save it locally
	 */
	private async downloadAndSave(url: string, sourceFile: TFile): Promise<string | null> {
		try {
			const response = await requestUrl({ url });
			if (response.status >= 400) {
				throw new Error(`HTTP ${response.status}`);
			}

			const contentType = response.headers['content-type'] ?? 'image/png';
			const extension = this.storageManager.getExtensionFromMimeType(contentType);
			const arrayBuffer = response.arrayBuffer;

			// Generate a name based on URL or hash
			const urlPath = new URL(url).pathname;
			const urlFileName = urlPath.split('/').pop()?.split('.')[0] ?? 'image';
			const baseName = this.storageManager.sanitizeFileName(urlFileName);

			const filePath = await this.storageManager.getAvailablePath(baseName, extension, sourceFile);
			await this.storageManager.saveFile(arrayBuffer, filePath);

			// Return full vault path - the replacement function will handle conversion
			return filePath;
		} catch (error) {
			console.error(`Failed to download ${url}:`, error);
			return null;
		}
	}

	/**
	 * Process all files in the vault
	 */
	async processAllFiles(): Promise<number> {
		const files = this.app.vault.getMarkdownFiles();
		let totalCount = 0;

		for (const file of files) {
			if (this.settings.supportedExtensions.includes(file.extension)) {
				const count = await this.processFile(file);
				totalCount += count;
			}
		}

		return totalCount;
	}

	/**
	 * Register event handlers for automatic conversion
	 */
	registerEventHandlers(
		onNoteOpen: (file: TFile) => void,
		onNoteSave: (file: TFile) => void
	): void {
		// These handlers should be registered by the main plugin
		// This method is provided for documentation purposes
	}
}

interface ExternalImageMatch {
	fullMatch: string;
	url: string;
	alt?: string;
	replacement: (localPath: string) => string;
}
