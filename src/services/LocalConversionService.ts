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
	 * @param file - The file to process
	 * @param isBackground - If true, skip conversion if user interaction (modal) would be required
	 */
	async processFile(file: TFile, isBackground: boolean = false): Promise<number> {
		if (!isMarkdownFile(file)) {
			return 0;
		}

		const content = await this.app.vault.read(file);
		const { newContent, count } = await this.processContent(content, file, isBackground);

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
		sourceFile: TFile,
		isBackground: boolean = false
	): Promise<{ newContent: string; count: number }> {
		let newContent = content;
		let count = 0;

		// Find all external image URLs (now async - verifies with HEAD requests)
		const externalImages = await this.findExternalImages(content, sourceFile);

		for (const image of externalImages) {
			try {
				// If background and modals are required but not allowed, skip this image
				// Note: autoRename setting is handled within renameImageFile, 
				// but we check it here to avoid downloading if we're going to skip anyway
				if (isBackground && !this.settings.autoRename) {
					// Skip conversion to avoid showing a modal in the background
					continue;
				}

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
		const fencedPositions: boolean[] = Array.from({ length: content.length }, () => false);
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
	 * Verifies each URL with HEAD request to ensure it actually serves an image
	 */
	private async findExternalImages(content: string, sourceFile: TFile): Promise<ExternalImageMatch[]> {
		const candidateMatches: Array<{
			fullMatch: string;
			url: string;
			alt?: string;
			replacement: (localPath: string) => string;
		}> = [];

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
			// Only process if it's an external URL and passes preliminary filter
			if (url && this.isExternalUrl(url) && this.isImageUrl(url)) {
				const sourceFileRef = sourceFile; // Capture for closure
				candidateMatches.push({
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
						const localFile = this.app.vault.getAbstractFileByPath(localPath);
						if (localFile instanceof TFile) {
							const relativePath = this.storageManager.getRelativePath(sourceFileRef, localFile);
							return `![${alt}](${encodeURI(relativePath)})`;
						}
						return `![${alt}](${encodeURI(localPath)})`;
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
			// Only process if it's an external URL and passes preliminary filter
			if (url && this.isExternalUrl(url) && this.isImageUrl(url)) {
				candidateMatches.push({
					fullMatch,
					url,
					replacement: (localPath: string) => `![](${encodeURI(localPath)})`,
				});
			}
		}

		// Verify each candidate URL with HEAD request
		const verifiedMatches: ExternalImageMatch[] = [];
		for (const candidate of candidateMatches) {
			const isImage = await this.verifyImageUrl(candidate.url);
			if (isImage) {
				verifiedMatches.push(candidate);
			}
		}

		return verifiedMatches;
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
	 * Check if a URL should be considered for image conversion
	 * Returns false for known non-image embed domains (YouTube, etc.)
	 * This is a preliminary filter - actual image verification happens via HEAD request
	 */
	private isImageUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			const hostname = parsed.hostname.toLowerCase();

			// Exclude known non-image embed domains
			const nonImageDomains = [
				'youtube.com',
				'www.youtube.com',
				'youtu.be',
				'm.youtube.com',
				'youtube-nocookie.com',
				'www.youtube-nocookie.com',
				'vimeo.com',
				'www.vimeo.com',
				'spotify.com',
				'open.spotify.com',
				'soundcloud.com',
				'www.soundcloud.com',
			];

			if (nonImageDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
				return false;
			}

			// Allow all other external URLs - we'll verify with HEAD request
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Verify if a URL actually serves an image by checking Content-Type header
	 * Uses HEAD request to avoid downloading non-image content
	 */
	private async verifyImageUrl(url: string): Promise<boolean> {
		try {
			const response = await requestUrl({ url, method: 'HEAD' });
			const contentType = response.headers['content-type']?.toLowerCase() ?? '';
			
			// Check if Content-Type starts with 'image/'
			return contentType.startsWith('image/');
		} catch {
			// On error (network issues, CORS, etc.), return false to skip this URL
			return false;
		}
	}

	/**
	 * Download an image and save it locally
	 * Includes Content-Type validation as a safety net
	 */
	private async downloadAndSave(url: string, sourceFile: TFile): Promise<string | null> {
		try {
			const response = await requestUrl({ url });
			if (response.status >= 400) {
				throw new Error(`HTTP ${response.status}`);
			}

			const contentType = response.headers['content-type'] ?? '';
			
			// Safety net: verify Content-Type is actually an image
			// This provides defense in depth in case HEAD request was bypassed or Content-Type changed
			if (!contentType.toLowerCase().startsWith('image/')) {
				console.warn(`Skipping ${url}: Content-Type is ${contentType}, not an image`);
				return null;
			}

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
