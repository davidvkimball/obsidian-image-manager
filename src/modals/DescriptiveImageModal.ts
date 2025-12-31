/**
 * Descriptive Image Modal
 * Asks user to describe the image, uses description as display text and kebab-case for filename
 */

import { App, Modal, Setting, TFile } from 'obsidian';
import { toKebabCase } from '../utils/kebab-case';

export interface DescriptiveImageResult {
	description: string;
	fileName: string; // kebab-case version
	cancelled: boolean;
}

export class DescriptiveImageModal extends Modal {
	private imageFile: TFile;
	private description: string = '';
	private onSubmit: (result: DescriptiveImageResult) => void;

	private descriptionInput: HTMLTextAreaElement | null = null;
	private previewEl: HTMLElement | null = null;
	private fileNamePreviewEl: HTMLElement | null = null;
	private errorEl: HTMLElement | null = null;

	constructor(
		app: App,
		imageFile: TFile,
		onSubmit: (result: DescriptiveImageResult) => void
	) {
		super(app);
		this.imageFile = imageFile;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		
		this.containerEl.addClass('image-manager-rename-modal');
		titleEl.setText('Describe image');

		// Image preview
		this.renderImagePreview(contentEl);

		// Description input
		new Setting(contentEl)
			.setName('Image description')
			.setDesc('Describe this image. This will be used as display text and for the filename.')
			.addTextArea((text) => {
				this.descriptionInput = text.inputEl;
				text
					.setPlaceholder('A beautiful sunset over mountains')
					.setValue(this.description)
					.onChange((value) => {
						this.description = value;
						this.updatePreview();
					});

				// Handle enter key (submit)
				text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) {
						e.preventDefault();
						this.submit();
					}
				});
			});

		// Preview section
		const previewContainer = contentEl.createDiv({ cls: 'image-manager-info' });
		previewContainer.createEl('p', { text: 'Preview:' });
		
		const fileNamePreview = previewContainer.createEl('p');
		fileNamePreview.createEl('strong', { text: 'Filename: ' });
		this.fileNamePreviewEl = fileNamePreview.createEl('span');
		
		const linkPreview = previewContainer.createEl('p');
		linkPreview.createEl('strong', { text: 'Link: ' });
		this.previewEl = linkPreview.createEl('span', { cls: 'code' });

		// Error display
		this.errorEl = contentEl.createDiv({ cls: 'image-manager-error image-manager-error-hidden' });

		// Buttons
		new Setting(contentEl)
			.addButton((btn) => {
				btn
					.setButtonText('Insert')
					.setCta()
					.onClick(() => this.submit());
			})
			.addButton((btn) => {
				btn
					.setButtonText('Cancel')
					.onClick(() => this.cancel());
			});

		// Focus input
		setTimeout(() => {
			if (this.descriptionInput) {
				this.descriptionInput.focus();
			}
		}, 50);
	}

	private renderImagePreview(containerEl: HTMLElement): void {
		const previewContainer = containerEl.createDiv({ cls: 'image-manager-preview' });
		
		const img = previewContainer.createEl('img', {
			attr: {
				src: this.app.vault.getResourcePath(this.imageFile),
				alt: this.imageFile.name,
			},
		});

		img.addClass('image-manager-preview-img');
	}

	private updatePreview(): void {
		if (!this.description || this.description.trim() === '') {
			if (this.fileNamePreviewEl) {
				this.fileNamePreviewEl.setText('(enter description)');
			}
			if (this.previewEl) {
				this.previewEl.setText('(enter description)');
			}
			return;
		}

		const kebabName = toKebabCase(this.description);
		const extension = this.imageFile.extension;
		const fileName = `${kebabName}.${extension}`;
		const displayText = this.description.trim();

		if (this.fileNamePreviewEl) {
			this.fileNamePreviewEl.setText(fileName);
		}

		if (this.previewEl) {
			// Show preview as: ![[filename.jpg|display text]]
			this.previewEl.setText(`![[${fileName}|${displayText}]]`);
		}
	}

	private showError(message: string): void {
		if (this.errorEl) {
			this.errorEl.setText(message);
			this.errorEl.addClass('image-manager-error-visible');
			this.errorEl.removeClass('image-manager-error-hidden');
		}
	}

	private hideError(): void {
		if (this.errorEl) {
			this.errorEl.addClass('image-manager-error-hidden');
			this.errorEl.removeClass('image-manager-error-visible');
		}
	}

	private submit(): void {
		this.hideError();

		if (!this.description || this.description.trim() === '') {
			this.showError('Description cannot be empty');
			return;
		}

		const kebabName = toKebabCase(this.description);
		if (!kebabName || kebabName === '') {
			this.showError('Description must contain valid characters');
			return;
		}

		this.onSubmit({
			description: this.description.trim(),
			fileName: kebabName,
			cancelled: false,
		});
		this.close();
	}

	private cancel(): void {
		this.onSubmit({
			description: '',
			fileName: '',
			cancelled: true,
		});
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Open the descriptive image modal and return the result
 */
export function openDescriptiveImageModal(
	app: App,
	imageFile: TFile
): Promise<DescriptiveImageResult> {
	return new Promise((resolve) => {
		const modal = new DescriptiveImageModal(app, imageFile, resolve);
		modal.open();
	});
}
