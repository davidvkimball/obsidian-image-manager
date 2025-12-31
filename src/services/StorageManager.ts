/**
 * Storage Manager Service
 * Handles file storage, path resolution, and Obsidian attachment location integration
 */

import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { ImageManagerSettings, AttachmentLocation } from '../types';

export class StorageManager {
	private app: App;
	private settings: ImageManagerSettings;

	constructor(app: App, settings: ImageManagerSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: ImageManagerSettings): void {
		this.settings = settings;
	}

	/**
	 * Get the attachment folder path for a given note
	 */
	async getAttachmentFolder(noteFile: TFile): Promise<string> {
		const notePath = noteFile.parent?.path ?? '';

		switch (this.settings.attachmentLocation) {
			case AttachmentLocation.SameFolder:
				return notePath;

			case AttachmentLocation.Subfolder:
				return normalizePath(this.joinPaths(notePath, this.settings.customAttachmentPath));

			case AttachmentLocation.VaultFolder:
				return normalizePath(this.settings.customAttachmentPath);

			case AttachmentLocation.ObsidianDefault:
			default:
				return this.getObsidianAttachmentFolder(noteFile);
		}
	}

	/**
	 * Get Obsidian's configured attachment folder
	 */
	private getObsidianAttachmentFolder(noteFile: TFile): string {
		// Access Obsidian's internal config for attachment folder
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		const attachmentFolderPath: string = ((this.app.vault as any).config?.attachmentFolderPath as string) ?? '/';
		const notePath = noteFile.parent?.path ?? '';

		if (attachmentFolderPath === '/') {
			// Vault root
			return '';
		} else if (attachmentFolderPath === './') {
			// Same folder as note
			return notePath;
		} else if (attachmentFolderPath.startsWith('./')) {
			// Relative to note
			const relativePath = attachmentFolderPath.slice(2);
			return normalizePath(this.joinPaths(notePath, relativePath));
		} else {
			// Absolute path in vault
			return normalizePath(attachmentFolderPath);
		}
	}
	
	/**
	 * Join path segments
	 */
	private joinPaths(...parts: string[]): string {
		return parts.filter(p => p).join('/');
	}

	/**
	 * Ensure a folder exists, creating it if necessary
	 */
	async ensureFolderExists(folderPath: string): Promise<void> {
		if (!folderPath) return;

		const normalizedPath = normalizePath(folderPath);
		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!folder) {
			await this.app.vault.createFolder(normalizedPath);
		} else if (!(folder instanceof TFolder)) {
			throw new Error(`Path exists but is not a folder: ${normalizedPath}`);
		}
	}

	/**
	 * Generate a unique file path for an image
	 */
	async getAvailablePath(baseName: string, extension: string, noteFile: TFile): Promise<string> {
		const folder = await this.getAttachmentFolder(noteFile);
		await this.ensureFolderExists(folder);

		const sanitizedName = this.sanitizeFileName(baseName);
		let fileName = `${sanitizedName}.${extension}`;
		let filePath = folder ? normalizePath(this.joinPaths(folder, fileName)) : normalizePath(fileName);

		// Check for duplicates
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(filePath)) {
			if (this.settings.dupNumberAtStart) {
				fileName = `${counter}${this.settings.dupNumberDelimiter}${sanitizedName}.${extension}`;
			} else {
				fileName = `${sanitizedName}${this.settings.dupNumberDelimiter}${counter}.${extension}`;
			}
			filePath = folder ? normalizePath(this.joinPaths(folder, fileName)) : normalizePath(fileName);
			counter++;
		}

		return filePath;
	}

	/**
	 * Save binary data as a file
	 */
	async saveFile(data: ArrayBuffer, filePath: string): Promise<TFile> {
		const normalizedPath = normalizePath(filePath);
		
		// Ensure parent folder exists
		const lastSlash = normalizedPath.lastIndexOf('/');
		const parentPath = lastSlash > 0 ? normalizedPath.slice(0, lastSlash) : '';
		if (parentPath) {
			await this.ensureFolderExists(parentPath);
		}

		return await this.app.vault.createBinary(normalizedPath, data);
	}

	/**
	 * Generate markdown image link for a file
	 * Ensures the link includes '!' for images
	 * @param displayText Optional display text to add after the link (e.g., ![[image.jpg|display text]])
	 */
	generateMarkdownLink(file: TFile, sourcePath: string, displayText?: string): string {
		const link = this.app.fileManager.generateMarkdownLink(file, sourcePath);
		// Obsidian's generateMarkdownLink should include '!' for images, but ensure it does
		let imageLink = link;
		if (this.isImageFile(file) && !link.startsWith('!')) {
			// If it's an image but doesn't start with '!', add it
			imageLink = `!${link}`;
		}
		
		// Add display text if provided (for wikilinks: ![[path|text]], for markdown: ![text](path))
		if (displayText && displayText.trim()) {
			if (imageLink.startsWith('![') && imageLink.includes('](')) {
				// Markdown link: ![alt](path) -> ![displayText](path)
				imageLink = imageLink.replace(/^!\[([^\]]*)\]/, `![${displayText}]`);
			} else if (imageLink.startsWith('![') && imageLink.includes(']]')) {
				// Wikilink: ![[path]] -> ![[path|displayText]]
				imageLink = imageLink.replace(/\]\]$/, `|${displayText}]]`);
			}
		}
		
		return imageLink;
	}

	/**
	 * Get relative path from source file to target file
	 */
	getRelativePath(from: TFile, to: TFile): string {
		const fromDir = from.parent?.path ?? '';
		const toPath = to.path;

		if (!fromDir) {
			return toPath;
		}

		// Simple relative path calculation
		// For same directory, just return file name
		const toDir = to.parent?.path ?? '';
		if (fromDir === toDir) {
			return to.name;
		}

		// Otherwise return the full path
		return toPath;
	}

	/**
	 * Sanitize a file name
	 */
	sanitizeFileName(name: string): string {
		// Remove or replace invalid characters
		return name
			.replace(/[\\/:*?"<>|]/g, '-')  // Replace Windows invalid chars
			.replace(/\s+/g, ' ')            // Normalize whitespace
			.replace(/^\.+/, '')             // Remove leading dots
			.replace(/\.+$/, '')             // Remove trailing dots
			.trim();
	}

	/**
	 * Get file extension from MIME type
	 */
	getExtensionFromMimeType(mimeType: string): string {
		const mimeToExt: Record<string, string> = {
			'image/jpeg': 'jpg',
			'image/jpg': 'jpg',
			'image/png': 'png',
			'image/gif': 'gif',
			'image/webp': 'webp',
			'image/svg+xml': 'svg',
			'image/bmp': 'bmp',
			'image/tiff': 'tiff',
			'image/avif': 'avif',
		};

		return mimeToExt[mimeType] ?? 'png';
	}

	/**
	 * Check if a file is an image based on extension
	 */
	isImageFile(file: TFile): boolean {
		const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'avif'];
		return imageExtensions.includes(file.extension.toLowerCase());
	}

	/**
	 * Check if a URL points to an external image
	 */
	isExternalImageUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			if (!['http:', 'https:'].includes(parsed.protocol)) {
				return false;
			}

			// Check if URL ends with common image extensions
			const pathname = parsed.pathname.toLowerCase();
			const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.avif'];
			
			// Also check for image-related query params or paths
			if (imageExtensions.some(ext => pathname.endsWith(ext))) {
				return true;
			}

			// Common image hosting patterns
			const imageHosts = [
				'images.unsplash.com',
				'images.pexels.com',
				'pixabay.com',
				'i.imgur.com',
				'cdn.discordapp.com',
			];

			return imageHosts.some(host => parsed.hostname.includes(host));
		} catch {
			return false;
		}
	}
}
