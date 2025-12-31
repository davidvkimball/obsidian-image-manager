/**
 * Rename Modal
 * Dialog for renaming images with preview and template suggestions
 */

import { App, Modal, Setting, TFile } from 'obsidian';

export interface RenameResult {
	newName: string;
	cancelled: boolean;
}

export class RenameModal extends Modal {
	private imageFile: TFile;
	private suggestedName: string;
	private currentName: string;
	private onSubmit: (result: RenameResult) => void;

	private nameInput: HTMLInputElement | null = null;
	private previewEl: HTMLElement | null = null;
	private errorEl: HTMLElement | null = null;

	constructor(
		app: App,
		imageFile: TFile,
		suggestedName: string,
		onSubmit: (result: RenameResult) => void
	) {
		super(app);
		this.imageFile = imageFile;
		this.suggestedName = suggestedName;
		this.currentName = suggestedName;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		
		this.containerEl.addClass('image-manager-rename-modal');
		titleEl.setText('Rename image');

		// Image preview
		this.renderImagePreview(contentEl);

		// File info
		this.renderFileInfo(contentEl);

		// Name input
		this.renderNameInput(contentEl);

		// Error display
		this.errorEl = contentEl.createDiv({ cls: 'image-manager-error image-manager-error-hidden' });

		// Buttons
		this.renderButtons(contentEl);

		// Focus and select input
		setTimeout(() => {
			if (this.nameInput) {
				this.nameInput.focus();
				this.nameInput.select();
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

		// Add class for preview styling (styles in styles.css)
		img.addClass('image-manager-preview-img');
	}

	private renderFileInfo(containerEl: HTMLElement): void {
		const infoContainer = containerEl.createDiv({ cls: 'image-manager-info' });
		
		const infoList = infoContainer.createEl('ul');
		
		// Original path
		const originalItem = infoList.createEl('li');
		originalItem.createEl('strong', { text: 'Original: ' });
		originalItem.createEl('span', { text: this.imageFile.path });

		// New path preview
		const newItem = infoList.createEl('li');
		newItem.createEl('strong', { text: 'New path: ' });
		this.previewEl = newItem.createEl('span', { text: this.getNewPath(this.currentName) });
	}

	private renderNameInput(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('New name')
			.setDesc('Enter a new name for the image (without extension)')
			.addText((text) => {
				this.nameInput = text.inputEl;
				text
					.setPlaceholder('Enter name')
					.setValue(this.currentName)
					.onChange((value) => {
						this.currentName = this.sanitizeName(value);
						this.updatePreview();
					});

				// Handle enter key
				text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter' && !e.isComposing) {
						e.preventDefault();
						this.submit();
					}
				});
			});
	}

	private renderButtons(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.addButton((btn) => {
				btn
					.setButtonText('Rename')
					.setCta()
					.onClick(() => this.submit());
			})
			.addButton((btn) => {
				btn
					.setButtonText('Skip')
					.onClick(() => this.cancel());
			});
	}

	private getNewPath(name: string): string {
		const folder = this.imageFile.parent?.path ?? '';
		const extension = this.imageFile.extension;
		const fileName = `${name}.${extension}`;
		return folder ? `${folder}/${fileName}` : fileName;
	}

	private updatePreview(): void {
		if (this.previewEl) {
			this.previewEl.setText(this.getNewPath(this.currentName));
		}
	}

	private sanitizeName(name: string): string {
		return name
			.replace(/[\\/:*?"<>|]/g, '-')
			.replace(/\s+/g, ' ')
			.trim();
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

		if (!this.currentName || this.currentName.trim() === '') {
			this.showError('Name cannot be empty');
			return;
		}

		this.onSubmit({
			newName: this.currentName,
			cancelled: false,
		});
		this.close();
	}

	private cancel(): void {
		this.onSubmit({
			newName: '',
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
 * Open the rename modal and return the result
 */
export function openRenameModal(
	app: App,
	imageFile: TFile,
	suggestedName: string
): Promise<RenameResult> {
	return new Promise((resolve) => {
		const modal = new RenameModal(app, imageFile, suggestedName, resolve);
		modal.open();
	});
}
