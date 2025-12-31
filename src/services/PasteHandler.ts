/**
 * Paste Handler Service
 * Handles paste events for images in the editor and frontmatter properties
 */

import { App, MarkdownView, Notice, Editor } from 'obsidian';
import { ImageManagerSettings } from '../types';
import { ImageProcessor } from './ImageProcessor';
import { PropertyHandler } from './PropertyHandler';

export class PasteHandler {
	private app: App;
	private settings: ImageManagerSettings;
	private imageProcessor: ImageProcessor;
	private propertyHandler: PropertyHandler;

	constructor(
		app: App,
		settings: ImageManagerSettings,
		imageProcessor: ImageProcessor,
		propertyHandler: PropertyHandler
	) {
		this.app = app;
		this.settings = settings;
		this.imageProcessor = imageProcessor;
		this.propertyHandler = propertyHandler;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: ImageManagerSettings): void {
		this.settings = settings;
	}

	/**
	 * Handle editor paste event
	 * This is registered via workspace.on('editor-paste')
	 */
	async handleEditorPaste(
		evt: ClipboardEvent,
		editor: Editor,
		view: MarkdownView
	): Promise<boolean> {
		if (!this.settings.enableRenameOnPaste) {
			return false; // Let Obsidian handle it
		}

		const files = evt.clipboardData?.files;
		if (!files || files.length === 0) {
			return false; // No files, let Obsidian handle it
		}

		// Check if any of the files are images
		const imageFiles: File[] = [];
		for (let i = 0; i < files.length; i++) {
			const file = files.item(i);
			if (file && file.type.startsWith('image/')) {
				imageFiles.push(file);
			}
		}

		if (imageFiles.length === 0) {
			return false; // No images, let Obsidian handle it
		}

		// We're handling this - prevent default
		evt.preventDefault();

		const activeFile = view.file;
		if (!activeFile) {
			new Notice('No active file');
			return true;
		}

			// Process each image
		for (let i = 0; i < imageFiles.length; i++) {
			const imageFile = imageFiles[i];
			if (!imageFile) continue;
			
			const result = await this.imageProcessor.processImageFile(
				imageFile,
				activeFile,
				true // Show rename modal
			);

			if (result.success && result.linkText) {
				// Insert the link at cursor
				editor.replaceSelection(result.linkText);
			}
		}

		return true;
	}

	/**
	 * Handle paste into frontmatter property
	 * This is registered via document paste event with property detection
	 */
	async handlePropertyPaste(evt: ClipboardEvent): Promise<boolean> {
		if (!this.settings.enablePropertyPaste) {
			return false;
		}

		const activeEl = document.activeElement as HTMLElement;
		if (!activeEl) {
			return false;
		}

		// Check if we're in a frontmatter property field
		if (!this.isFrontmatterField(activeEl)) {
			return false;
		}

		const files = evt.clipboardData?.files;
		if (!files || files.length === 0) {
			return false;
		}

		// Check for image files
		let imageFile: File | null = null;
		for (let i = 0; i < files.length; i++) {
			const f = files.item(i);
			if (f && f.type.startsWith('image/')) {
				imageFile = f;
				break;
			}
		}

		if (!imageFile) {
			return false;
		}

		// We're handling this - stop all propagation
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();

		// Get the property name before processing
		const propertyName = this.getPropertyName(activeEl);
		if (!propertyName) {
			new Notice('Could not determine property name');
			return true;
		}

		// Get active file
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No active file');
			return true;
		}

		// Blur the input field to prevent Obsidian's autocomplete from interfering
		if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
			activeEl.blur();
			activeEl.value = '';
		}

		// Process the image - skip rename modal for property paste to avoid conflicts
		// We'll use auto-rename with a simple template
		const result = await this.imageProcessor.processImageFile(
			imageFile,
			activeFile,
			false // Don't show rename modal for property paste
		);

		if (result.success && result.file) {
			// Update the frontmatter property directly
			await this.propertyHandler.setPropertyValue(
				activeFile,
				propertyName,
				result.file
			);
			
			// Get the formatted link value to update the UI
			const linkValue = this.propertyHandler.formatPropertyLink(result.file, activeFile);
			
			// Update the input field directly to show the value immediately
			if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
				activeEl.value = linkValue;
				// Trigger input event to notify Obsidian's property editor
				activeEl.dispatchEvent(new Event('input', { bubbles: true }));
			}
			
			// Wait a bit for UI to update and Obsidian to process the change
			await new Promise(resolve => setTimeout(resolve, 200));
			
			// Force focus away from the property editor to prevent autocomplete
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view?.editor) {
				view.editor.focus();
			}
		}

		return true;
	}

	/**
	 * Check if an element is a supported frontmatter field
	 */
	private isFrontmatterField(element: HTMLElement): boolean {
		// Check for text property fields (the only type that supports images)
		return element.matches('.metadata-input-longtext');
	}

	/**
	 * Get the property name from a frontmatter field element
	 */
	private getPropertyName(element: HTMLElement): string | null {
		const propertyEl = element.closest('.metadata-property');
		return propertyEl?.getAttribute('data-property-key') ?? null;
	}
}

export class DropHandler {
	private app: App;
	private settings: ImageManagerSettings;
	private imageProcessor: ImageProcessor;

	constructor(
		app: App,
		settings: ImageManagerSettings,
		imageProcessor: ImageProcessor
	) {
		this.app = app;
		this.settings = settings;
		this.imageProcessor = imageProcessor;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: ImageManagerSettings): void {
		this.settings = settings;
	}

	/**
	 * Handle editor drop event
	 */
	async handleEditorDrop(
		evt: DragEvent,
		editor: Editor,
		view: MarkdownView
	): Promise<boolean> {
		if (!this.settings.enableRenameOnDrop) {
			return false;
		}

		const files = evt.dataTransfer?.files;
		if (!files || files.length === 0) {
			return false;
		}

		// Check for image files
		const imageFiles: File[] = [];
		for (let i = 0; i < files.length; i++) {
			const f = files.item(i);
			if (f && f.type.startsWith('image/')) {
				imageFiles.push(f);
			}
		}

		if (imageFiles.length === 0) {
			return false;
		}

		// We're handling this
		evt.preventDefault();

		const activeFile = view.file;
		if (!activeFile) {
			new Notice('No active file');
			return true;
		}

		// Process each image
		for (let i = 0; i < imageFiles.length; i++) {
			const imageFile = imageFiles[i];
			if (!imageFile) continue;
			
			const result = await this.imageProcessor.processImageFile(
				imageFile,
				activeFile,
				true
			);

			if (result.success && result.linkText) {
				editor.replaceSelection(result.linkText);
			}
		}

		return true;
	}
}
