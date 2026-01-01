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

		// Check if we're in a frontmatter property field - if so, let property paste handler take over
		const activeEl = document.activeElement as HTMLElement;
		if (activeEl && this.isFrontmatterField(activeEl)) {
			return false; // Let property paste handler handle it
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

		// Debug: Log that we detected a property field
		if (this.settings.debugMode) {
			console.log('[Image Manager] Property paste detected', {
				activeElement: activeEl.tagName,
				classes: activeEl.className,
				propertyName: this.getPropertyName(activeEl)
			});
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

		// Double-check we're still in a property field (element might have changed)
		// and that we have an active file before preventing default
		const currentEl = document.activeElement as HTMLElement;
		if (!currentEl || !this.isFrontmatterField(currentEl)) {
			return false;
		}

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			return false;
		}

		// We're handling this - stop all propagation
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();

		// Get the property name before processing
		const propertyName = this.getPropertyName(currentEl);
		if (!propertyName) {
			new Notice('Could not determine property name');
			return true;
		}

		// Process the image - show rename modal for property paste
		const result = await this.imageProcessor.processImageFile(
			imageFile,
			activeFile,
			true // Show rename modal for property paste
		);

		if (result.success && result.file) {
			// Get the formatted link value
			const linkValue = this.propertyHandler.formatPropertyLink(result.file, activeFile);
			
			// Update the frontmatter property directly
			await this.propertyHandler.setPropertyValue(
				activeFile,
				propertyName,
				result.file
			);
			
			// Wait for Obsidian to process the file change and update metadata cache
			await new Promise(resolve => setTimeout(resolve, 300));
			
			// Try multiple approaches to update the UI
			// Approach 1: Find and update the input field directly
			const propertyEl = document.querySelector(
				`.metadata-property[data-property-key="${propertyName}"]`
			);
			
			if (this.settings.debugMode) {
				console.log('[Image Manager] Updating property UI', {
					propertyName,
					linkValue,
					propertyElFound: !!propertyEl
				});
			}
			
			const inputEl = propertyEl?.querySelector(
				'.metadata-input-longtext, .metadata-input-text, input.metadata-input, textarea.metadata-input'
			) as HTMLElement | HTMLInputElement | HTMLTextAreaElement | null;
			
			if (inputEl) {
				if (this.settings.debugMode) {
					const currentValue = inputEl instanceof HTMLInputElement || inputEl instanceof HTMLTextAreaElement
						? inputEl.value
						: inputEl.textContent || inputEl.innerText;
					console.log('[Image Manager] Found input field, updating value', {
						elementType: inputEl.tagName,
						currentValue,
						newValue: linkValue
					});
				}
				
				// Handle both input/textarea elements and contenteditable divs
				if (inputEl instanceof HTMLInputElement || inputEl instanceof HTMLTextAreaElement) {
					// Standard input/textarea
					inputEl.value = linkValue;
				} else {
					// Contenteditable div (used for longtext properties)
					inputEl.textContent = linkValue;
					inputEl.innerText = linkValue;
				}
				
				// Trigger multiple events to ensure Obsidian recognizes the change
				const inputEvent = new Event('input', { bubbles: true, cancelable: true });
				const changeEvent = new Event('change', { bubbles: true, cancelable: true });
				const blurEvent = new Event('blur', { bubbles: true, cancelable: true });
				
				inputEl.dispatchEvent(inputEvent);
				
				// Small delay before change event
				setTimeout(() => {
					inputEl.dispatchEvent(changeEvent);
					
					// Focus and blur to trigger Obsidian's update mechanism
					if (inputEl instanceof HTMLElement) {
						inputEl.focus();
						setTimeout(() => {
							inputEl.blur();
							inputEl.dispatchEvent(blurEvent);
							
							// Focus the editor to complete the action
							setTimeout(() => {
								const view = this.app.workspace.getActiveViewOfType(MarkdownView);
								if (view?.editor) {
									view.editor.focus();
								}
							}, 50);
						}, 50);
					}
				}, 50);
			} else {
				// If we can't find the input, just focus the editor
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view?.editor) {
					view.editor.focus();
				}
			}
		}

		return true;
	}

	/**
	 * Check if an element is a supported frontmatter field
	 * Works for both MD and MDX files
	 */
	private isFrontmatterField(element: HTMLElement): boolean {
		// Check if element is inside a metadata property container
		const propertyEl = element.closest('.metadata-property');
		if (!propertyEl) {
			return false;
		}

		// Check for various property input types that can accept text/images
		// Obsidian uses different classes for different property types
		// Longtext properties use contenteditable divs, not input/textarea
		return (
			element.matches('.metadata-input-longtext') ||
			element.matches('.metadata-input-text') ||
			element.matches('input.metadata-input') ||
			element.matches('textarea.metadata-input') ||
			// Also check if the element itself is an input/textarea/div inside a property
			((element instanceof HTMLInputElement || 
			  element instanceof HTMLTextAreaElement ||
			  (element instanceof HTMLDivElement && element.classList.contains('metadata-input-longtext'))) &&
				propertyEl !== null)
		);
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
