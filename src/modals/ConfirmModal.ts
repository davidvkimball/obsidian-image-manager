/**
 * Confirmation Modal
 * Simple modal for confirming potentially destructive actions
 */

import { App, Modal } from 'obsidian';

export interface ConfirmResult {
	confirmed: boolean;
}

export class ConfirmModal extends Modal {
	private title: string;
	private message: string;
	private confirmText: string;
	private cancelText: string;
	private resolve: (result: ConfirmResult) => void;

	constructor(
		app: App,
		title: string,
		message: string,
		confirmText: string = 'Confirm',
		cancelText: string = 'Cancel'
	) {
		super(app);
		this.title = title;
		this.message = message;
		this.confirmText = confirmText;
		this.cancelText = cancelText;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText(this.title);

		// Message
		const messageEl = contentEl.createDiv({ cls: 'image-manager-confirm-message' });
		messageEl.createEl('p', { text: this.message });

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'image-manager-confirm-buttons' });
		
		buttonContainer.createEl('button', {
			text: this.confirmText,
			cls: 'mod-cta',
		}).addEventListener('click', () => {
			this.resolve({ confirmed: true });
			this.close();
		});

		buttonContainer.createEl('button', {
			text: this.cancelText,
		}).addEventListener('click', () => {
			this.resolve({ confirmed: false });
			this.close();
		});

		// Focus the confirm button
		setTimeout(() => {
			const confirmButton = buttonContainer.querySelector('.mod-cta') as HTMLButtonElement;
			confirmButton?.focus();
		}, 50);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	public openAndAwaitResult(): Promise<ConfirmResult> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}

/**
 * Open a confirmation modal and return the result
 */
export function openConfirmModal(
	app: App,
	title: string,
	message: string,
	confirmText: string = 'Confirm',
	cancelText: string = 'Cancel'
): Promise<ConfirmResult> {
	const modal = new ConfirmModal(app, title, message, confirmText, cancelText);
	return modal.openAndAwaitResult();
}
