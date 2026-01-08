/**
 * Image Processor Service
 * Core image handling, downloading, and processing
 */

import { App, TFile, Notice, MarkdownView, requestUrl } from 'obsidian';
import { ImageManagerSettings, ProcessedImage } from '../types';
import { StorageManager } from './StorageManager';
import { renderTemplate, buildTemplateVariables, isTemplateMeaningful } from '../utils/template';
import { openRenameModal } from '../modals/RenameModal';
import { openDescriptiveImageModal } from '../modals/DescriptiveImageModal';

export class ImageProcessor {
	private app: App;
	private settings: ImageManagerSettings;
	private storageManager: StorageManager;

	constructor(app: App, settings: ImageManagerSettings, storageManager: StorageManager) {
		this.app = app;
		this.settings = settings;
		this.storageManager = storageManager;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: ImageManagerSettings): void {
		this.settings = settings;
		this.storageManager.updateSettings(settings);
	}

	/**
	 * Process a pasted/dropped image file
	 * This is called from our event handlers (user-initiated action)
	 * @param isPropertyInsertion - If true, skip descriptive images (only applies to note body)
	 */
	async processImageFile(
		file: File,
		activeFile: TFile,
		showRenameModal: boolean = true,
		isPropertyInsertion: boolean = false
	): Promise<ProcessedImage> {
		try {
			// Read file data
			const arrayBuffer = await file.arrayBuffer();
			const extension = this.getExtension(file);

			// Generate suggested name from template
			const suggestedName = this.generateSuggestedName(activeFile);

			// Get the name to use
			let finalName = suggestedName;

			if (showRenameModal && !this.settings.autoRename) {
				// Create a temporary file to show in modal
				const tempPath = await this.storageManager.getAvailablePath(
					`temp-${Date.now()}`,
					extension,
					activeFile
				);
				const tempFile = await this.storageManager.saveFile(arrayBuffer, tempPath);

				let finalName: string;
				let displayText: string | undefined;

				// Show descriptive image modal if enabled, otherwise show rename modal
				if (this.settings.enableDescriptiveImages) {
					const descResult = await openDescriptiveImageModal(this.app, tempFile);
					
					if (descResult.cancelled) {
						// User cancelled - delete temp file and return
						await this.app.fileManager.trashFile(tempFile);
						return {
							file: null,
							path: '',
							linkText: '',
							success: false,
							error: 'Cancelled by user',
						};
					}

					finalName = descResult.fileName;
					displayText = descResult.description;
				} else {
					// Show rename modal
					const result = await openRenameModal(this.app, tempFile, suggestedName);

					if (result.cancelled) {
						// User cancelled - delete temp file and return
						await this.app.fileManager.trashFile(tempFile);
						return {
							file: null,
							path: '',
							linkText: '',
							success: false,
							error: 'Cancelled by user',
						};
					}

					finalName = result.newName;
				}

				// Rename the temp file to the final name
				const finalPath = await this.getDeduplicatedPath(finalName, extension, activeFile);
				await this.app.fileManager.renameFile(tempFile, finalPath);

				const abstractFile = this.app.vault.getAbstractFileByPath(finalPath);
				if (!(abstractFile instanceof TFile)) {
					throw new Error('Renamed file not found');
				}
				const renamedFile = abstractFile;
				const linkText = this.storageManager.generateMarkdownLink(
					renamedFile,
					activeFile.path,
					displayText,
					this.settings.insertSize
				);

				if (!this.settings.disableRenameNotice) {
					new Notice(`Image saved as: ${renamedFile.name}`);
				}

				return {
					file: renamedFile,
					path: finalPath,
					linkText,
					success: true,
				};
			} else {
				// Auto-rename without modal
				const finalPath = await this.getDeduplicatedPath(finalName, extension, activeFile);
				const savedFile = await this.storageManager.saveFile(arrayBuffer, finalPath);
				const linkText = this.storageManager.generateMarkdownLink(
					savedFile,
					activeFile.path,
					undefined,
					this.settings.insertSize
				);

				if (!this.settings.disableRenameNotice) {
					new Notice(`Image saved as: ${savedFile.name}`);
				}

				return {
					file: savedFile,
					path: finalPath,
					linkText,
					success: true,
				};
			}
		} catch (error) {
			console.error('Error processing image:', error);
			return {
				file: null,
				path: '',
				linkText: '',
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Process an image from a URL (download and save locally)
	 * @param isPropertyInsertion - If true, skip descriptive images (only applies to note body)
	 * @param suggestedNameOverride - Optional override for suggested name (e.g., from search term)
	 */
	async processImageUrl(
		url: string,
		activeFile: TFile,
		showRenameModal: boolean = true,
		isPropertyInsertion: boolean = false,
		suggestedNameOverride?: string
	): Promise<ProcessedImage> {
		try {
			// Download the image
			const response = await requestUrl({ url });
			if (response.status >= 400) {
				throw new Error(`Failed to download image: ${response.status}`);
			}

			const arrayBuffer = response.arrayBuffer;
			const contentType = response.headers['content-type'] ?? 'image/png';
			const extension = this.storageManager.getExtensionFromMimeType(contentType);

			// Generate suggested name (use override if provided, otherwise generate from template)
			const suggestedName = suggestedNameOverride ?? this.generateSuggestedName(activeFile);

			// Get final name
			let finalName = suggestedName;

			if (showRenameModal && !this.settings.autoRename) {
				// Save temp file first
				const tempPath = await this.storageManager.getAvailablePath(
					`temp-${Date.now()}`,
					extension,
					activeFile
				);
				const tempFile = await this.storageManager.saveFile(arrayBuffer, tempPath);

				let finalName: string;
				let displayText: string | undefined;

				// Show descriptive image modal if enabled and NOT inserting to property, otherwise show rename modal
				if (this.settings.enableDescriptiveImages && !isPropertyInsertion) {
					const descResult = await openDescriptiveImageModal(this.app, tempFile, suggestedName);
					
					if (descResult.cancelled) {
						await this.app.fileManager.trashFile(tempFile);
						return {
							file: null,
							path: '',
							linkText: '',
							success: false,
							error: 'Cancelled by user',
						};
					}

					finalName = descResult.fileName;
					displayText = descResult.description;
				} else {
					// Show rename modal
					const result = await openRenameModal(this.app, tempFile, suggestedName);

					if (result.cancelled) {
						await this.app.fileManager.trashFile(tempFile);
						return {
							file: null,
							path: '',
							linkText: '',
							success: false,
							error: 'Cancelled by user',
						};
					}

					finalName = result.newName;
				}

				const finalPath = await this.getDeduplicatedPath(finalName, extension, activeFile);
				await this.app.fileManager.renameFile(tempFile, finalPath);

				const abstractFile = this.app.vault.getAbstractFileByPath(finalPath);
				if (!(abstractFile instanceof TFile)) {
					throw new Error('Renamed file not found');
				}
				const renamedFile = abstractFile;
				const linkText = this.storageManager.generateMarkdownLink(
					renamedFile,
					activeFile.path,
					displayText,
					this.settings.insertSize
				);

				if (!this.settings.disableRenameNotice) {
					new Notice(`Image downloaded and saved as: ${renamedFile.name}`);
				}

				return {
					file: renamedFile,
					path: finalPath,
					linkText,
					success: true,
				};
			} else {
				const finalPath = await this.getDeduplicatedPath(finalName, extension, activeFile);
				const savedFile = await this.storageManager.saveFile(arrayBuffer, finalPath);
				const linkText = this.storageManager.generateMarkdownLink(
					savedFile,
					activeFile.path,
					undefined,
					this.settings.insertSize
				);

				if (!this.settings.disableRenameNotice) {
					new Notice(`Image downloaded and saved as: ${savedFile.name}`);
				}

				return {
					file: savedFile,
					path: finalPath,
					linkText,
					success: true,
				};
			}
		} catch (error) {
			console.error('Error processing image URL:', error);
			return {
				file: null,
				path: '',
				linkText: '',
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Generate a suggested name based on the template
	 */
	generateSuggestedName(activeFile: TFile): string {
		const variables = buildTemplateVariables(this.app, activeFile);
		const rendered = renderTemplate(this.settings.imageNameTemplate, variables);

		// Check if the result is meaningful
		if (isTemplateMeaningful(rendered, this.settings.dupNumberDelimiter)) {
			return this.storageManager.sanitizeFileName(rendered);
		}

		// Fallback to file name
		return activeFile.basename;
	}

	/**
	 * Get a deduplicated file path
	 */
	private async getDeduplicatedPath(
		baseName: string,
		extension: string,
		activeFile: TFile
	): Promise<string> {
		return await this.storageManager.getAvailablePath(baseName, extension, activeFile);
	}

	/**
	 * Get file extension from File object
	 */
	private getExtension(file: File): string {
		// Try to get from file name first
		const nameParts = file.name.split('.');
		if (nameParts.length > 1) {
			const nameExt = nameParts[nameParts.length - 1]?.toLowerCase();
			if (nameExt) {
				return nameExt;
			}
		}

		// Fall back to MIME type
		return this.storageManager.getExtensionFromMimeType(file.type);
	}

	/**
	 * Insert link text at cursor position
	 */
	insertLinkAtCursor(linkText: string): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view?.editor) {
			view.editor.replaceSelection(linkText);
		}
	}

	/**
	 * Get the active markdown file
	 */
	getActiveFile(): TFile | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.file ?? null;
	}

	/**
	 * Rename an existing image file with optional rename modal
	 * Used by LocalConversionService to rename converted images
	 */
	async renameImageFile(
		imageFile: TFile,
		suggestedName: string,
		activeFile: TFile
	): Promise<ProcessedImage | null> {
		try {
			const extension = imageFile.extension;
			let finalName = suggestedName;
			let displayText = '';

			// Handle descriptive images if enabled (note: this is for renaming existing files, not property insertion)
			// If descriptive images is enabled, it handles the naming and we skip the rename modal
			if (this.settings.enableDescriptiveImages) {
				const descResult = await openDescriptiveImageModal(this.app, imageFile, suggestedName);
				if (descResult.cancelled) {
					return null; // User cancelled
				}
				displayText = descResult.description;
				finalName = descResult.fileName; // Already kebab-cased
			} else if (!this.settings.autoRename) {
				// Only show rename modal if descriptive images is disabled AND auto-rename is off
				const result = await openRenameModal(
					this.app,
					imageFile,
					finalName
				);
				if (result.cancelled) {
					return null; // User cancelled
				}
				finalName = result.newName;
			}

			// Rename the file
			const finalPath = await this.getDeduplicatedPath(finalName, extension, activeFile);
			await this.app.fileManager.renameFile(imageFile, finalPath);

			const abstractFile = this.app.vault.getAbstractFileByPath(finalPath);
			if (!(abstractFile instanceof TFile)) {
				throw new Error('Renamed file not found');
			}
			const renamedFile = abstractFile;
			const linkText = this.storageManager.generateMarkdownLink(
				renamedFile,
				activeFile.path,
				displayText,
				this.settings.insertSize
			);

			return {
				file: renamedFile,
				path: finalPath,
				linkText,
				success: true,
			};
		} catch (error) {
			console.error('Error renaming image file:', error);
			return {
				file: null,
				path: '',
				linkText: '',
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Debug logging
	 */
	private log(...args: unknown[]): void {
		if (this.settings.debugMode) {
			console.debug('[Image Manager]', ...args);
		}
	}
}
