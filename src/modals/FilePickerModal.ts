/**
 * File Picker Modal
 * Opens the OS native file dialog for selecting local images
 */

import { App, Modal, Notice, MarkdownView, TFile } from 'obsidian';
import { ImageProcessor } from '../services/ImageProcessor';
import { PropertyHandler } from '../services/PropertyHandler';

export class FilePickerModal extends Modal {
	private imageProcessor: ImageProcessor;
	private propertyHandler: PropertyHandler;
	private insertToProperty: boolean;
	private propertyName?: string;

	constructor(
		app: App,
		imageProcessor: ImageProcessor,
		propertyHandler: PropertyHandler,
		insertToProperty: boolean = false,
		propertyName?: string
	) {
		super(app);
		this.imageProcessor = imageProcessor;
		this.propertyHandler = propertyHandler;
		this.insertToProperty = insertToProperty;
		this.propertyName = propertyName;
	}

	onOpen(): void {
		const { contentEl } = this;

		// Create hidden file input
		const input = contentEl.createEl('input', {
			type: 'file',
			attr: {
				accept: 'image/*',
				multiple: 'true',
				style: 'display: none;',
			},
		});

		// Handle file selection
		input.addEventListener('change', () => { void this.handleFileSelection(input); });

		// Handle cancel
		input.addEventListener('cancel', () => {
			this.close();
		});

		// Trigger the file dialog immediately
		input.click();
	}

	private async handleFileSelection(input: HTMLInputElement): Promise<void> {
			this.close();

			const files = input.files;
			if (!files || files.length === 0) {
				new Notice('No files selected');
				return;
			}

			const activeFile = this.getActiveFile();
			if (!activeFile) {
				new Notice('No active file');
				return;
			}

			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			const editor = view?.editor;

			// Process each selected file
			for (let i = 0; i < files.length; i++) {
				const file = files.item(i);
				if (!file || !file.type.startsWith('image/')) {
					continue;
				}

				if (this.insertToProperty) {
					// Validate property name
					if (!this.propertyName || this.propertyName.trim() === '') {
						new Notice('Please specify a property name in settings');
						return;
					}

					// Insert into property (create if it doesn't exist)
					// Skip descriptive images for property insertions (display text doesn't apply to properties)
					const result = await this.imageProcessor.processImageFile(
						file,
						activeFile,
						true, // Show rename modal
						true // isPropertyInsertion - skip descriptive images
					);

					if (result.success && result.file) {
						await this.propertyHandler.setPropertyValue(
							activeFile,
							this.propertyName,
							result.file
						);
					}
				} else {
					// Insert into note body
					const result = await this.imageProcessor.processImageFile(
						file,
						activeFile,
						true // Show rename modal
					);

					if (result.success && result.linkText && editor) {
						editor.replaceSelection(result.linkText);
					}
				}
			}

		new Notice(`Added ${files.length} image(s)`);
	}

	private getActiveFile(): TFile | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.file ?? null;
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Open the file picker and process selected images
 */
export function openFilePicker(
	app: App,
	imageProcessor: ImageProcessor,
	propertyHandler: PropertyHandler,
	insertToProperty: boolean = false,
	propertyName?: string
): void {
	new FilePickerModal(app, imageProcessor, propertyHandler, insertToProperty, propertyName).open();
}
