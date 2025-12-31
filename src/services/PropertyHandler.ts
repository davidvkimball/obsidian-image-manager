/**
 * Property Handler Service
 * Handles inserting images into frontmatter properties (MD and MDX)
 */

import { App, TFile, Notice } from 'obsidian';
import { ImageManagerSettings, PropertyLinkFormat } from '../types';
import { isMdxFile, processMdxFrontMatter } from '../utils/mdx-frontmatter';
import { StorageManager } from './StorageManager';
import { ImageProcessor } from './ImageProcessor';

export class PropertyHandler {
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
	 * Set an image property value in frontmatter
	 */
	async setPropertyValue(
		noteFile: TFile,
		propertyName: string,
		imageFile: TFile
	): Promise<void> {
		const linkValue = this.formatPropertyLink(imageFile, noteFile);

		try {
			if (isMdxFile(noteFile)) {
				await this.setMdxProperty(noteFile, propertyName, linkValue);
			} else {
				await this.setMdProperty(noteFile, propertyName, linkValue);
			}
			new Notice(`Image added to property: ${propertyName}`);
		} catch (error) {
			console.error('Failed to update property:', error);
			new Notice(`Failed to update property: ${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	/**
	 * Set property in MD file using Obsidian's API
	 */
	private async setMdProperty(
		file: TFile,
		propertyName: string,
		value: string
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			frontmatter[propertyName] = value;
		});
	}

	/**
	 * Set property in MDX file using custom handler
	 */
	private async setMdxProperty(
		file: TFile,
		propertyName: string,
		value: string
	): Promise<void> {
		await processMdxFrontMatter(this.app, file, (frontmatter) => {
			frontmatter[propertyName] = value;
		});
	}

	/**
	 * Format the image link according to settings
	 * Public method so PasteHandler can get the formatted value for UI updates
	 */
	formatPropertyLink(imageFile: TFile, noteFile: TFile): string {
		let pathToUse: string;

		switch (this.settings.propertyLinkFormat) {
			case PropertyLinkFormat.RelativePath:
				// Use relative path: always use ./image.jpg format for consistency
				// This works whether same folder or different folder
				pathToUse = `./${imageFile.name}`;
				break;
			case PropertyLinkFormat.Path:
			default:
				pathToUse = this.getRelativePath(noteFile, imageFile);
				break;
		}

		switch (this.settings.propertyLinkFormat) {
			case PropertyLinkFormat.Wikilink:
				return `[[${pathToUse}]]`;
			case PropertyLinkFormat.Markdown:
				return `![](${encodeURI(pathToUse)})`;
			case PropertyLinkFormat.Custom:
				// Replace {image-url} placeholder with the image path
				return this.settings.customPropertyLinkFormat.replace(
					/\{image-url\}/gi,
					pathToUse
				);
			case PropertyLinkFormat.RelativePath:
			case PropertyLinkFormat.Path:
			default:
				return pathToUse;
		}
	}

	/**
	 * Get relative path from note to image
	 */
	private getRelativePath(fromFile: TFile, toFile: TFile): string {
		// If using wikilinks, we can use just the file name
		// Access Obsidian's internal config 
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		const useMarkdownLinks = ((this.app.vault as any).config?.useMarkdownLinks as boolean) ?? false;
		const useWikilinks = !useMarkdownLinks;

		if (useWikilinks && this.settings.propertyLinkFormat === PropertyLinkFormat.Wikilink) {
			// For wikilinks, just use the file name
			return toFile.name;
		}

		// For markdown links and paths, use relative path
		return this.storageManager.getRelativePath(fromFile, toFile);
	}

	/**
	 * Get the current value of a property
	 */
	async getPropertyValue(
		file: TFile,
		propertyName: string
	): Promise<unknown> {
		const cache = this.app.metadataCache.getFileCache(file);
		return cache?.frontmatter?.[propertyName];
	}

	/**
	 * Check if a property exists in frontmatter
	 */
	async hasProperty(file: TFile, propertyName: string): Promise<boolean> {
		const cache = this.app.metadataCache.getFileCache(file);
		return cache?.frontmatter?.[propertyName] !== undefined;
	}

	/**
	 * Insert an image from a URL into a property
	 * Downloads the image, saves it locally, and sets the property
	 */
	async insertImageFromUrl(
		imageUrl: string,
		noteFile: TFile,
		propertyName: string
	): Promise<void> {
		// Use ImageProcessor to handle the download and save
		// This ensures consistent naming, deduplication, and rename modal handling
		const result = await this.imageProcessor.processImageUrl(
			imageUrl,
			noteFile,
			true // Show rename modal if enabled
		);

		if (!result.success || !result.file) {
			throw new Error(result.error || 'Failed to process image');
		}

		// Set the property
		await this.setPropertyValue(noteFile, propertyName, result.file);
	}
}
