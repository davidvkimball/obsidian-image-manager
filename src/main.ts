/**
 * Image Manager Plugin
 * Insert, rename, and sort external images by transforming them into local files
 */

import { Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, ImageManagerSettings, ImageManagerSettingTab } from './settings';
import { StorageManager } from './services/StorageManager';
import { ImageProcessor } from './services/ImageProcessor';
import { PropertyHandler } from './services/PropertyHandler';
import { PasteHandler, DropHandler } from './services/PasteHandler';
import { RemoteImageService } from './services/RemoteImageService';
import { LocalConversionService } from './services/LocalConversionService';
import { openFilePicker } from './modals/FilePickerModal';
import { openRemoteSearch } from './modals/RemoteSearchModal';

export default class ImageManagerPlugin extends Plugin {
	settings: ImageManagerSettings;

	// Services
	private storageManager: StorageManager;
	private imageProcessor: ImageProcessor;
	private propertyHandler: PropertyHandler;
	private pasteHandler: PasteHandler;
	private dropHandler: DropHandler;
	private remoteService: RemoteImageService;
	private conversionService: LocalConversionService;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Initialize services
		this.initializeServices();

		// Register event handlers
		this.registerEventHandlers();

		// Register commands
		this.registerCommands();

		// Add settings tab
		this.addSettingTab(new ImageManagerSettingTab(this.app, this));

		this.log('Image Manager plugin loaded');
	}

	onunload(): void {
		this.log('Image Manager plugin unloaded');
	}

	/**
	 * Initialize all services
	 */
	private initializeServices(): void {
		this.storageManager = new StorageManager(this.app, this.settings);
		this.remoteService = new RemoteImageService(this.settings);
		this.imageProcessor = new ImageProcessor(this.app, this.settings, this.storageManager);
		this.propertyHandler = new PropertyHandler(this.app, this.settings, this.storageManager, this.imageProcessor);
		this.pasteHandler = new PasteHandler(
			this.app,
			this.settings,
			this.imageProcessor,
			this.propertyHandler
		);
		this.dropHandler = new DropHandler(this.app, this.settings, this.imageProcessor);
		this.conversionService = new LocalConversionService(this.app, this.settings, this.storageManager, this.imageProcessor);
	}

	/**
	 * Register event handlers
	 */
	private registerEventHandlers(): void {
		// Editor paste handler
		this.registerEvent(
			this.app.workspace.on('editor-paste', (evt: ClipboardEvent, editor: Editor, view: MarkdownView) => {
				void this.pasteHandler.handleEditorPaste(evt, editor, view);
			})
		);

		// Editor drop handler
		this.registerEvent(
			this.app.workspace.on('editor-drop', (evt: DragEvent, editor: Editor, view: MarkdownView) => {
				void this.dropHandler.handleEditorDrop(evt, editor, view);
			})
		);

		// DOM paste handler for frontmatter properties
		// Use capture phase but be defensive - only handle if we're definitely in a property field
		this.registerDomEvent(document, 'paste', (evt: ClipboardEvent) => {
			// Only handle if we're in the Obsidian workspace (not system UI like title bar)
			const target = evt.target as HTMLElement;
			if (!target || !target.closest('.workspace')) {
				return; // Not in workspace, don't interfere
			}
			void this.pasteHandler.handlePropertyPaste(evt);
		}, { capture: true });

		// File open handler for auto-conversion
		// Register always, but check settings inside
		this.registerEvent(
			this.app.workspace.on('file-open', async (file: TFile | null) => {
				if (this.settings.autoConvertRemoteImages && this.settings.convertOnNoteOpen) {
					if (file && this.settings.supportedExtensions.includes(file.extension)) {
						// Small delay to let file fully load
						await new Promise(resolve => setTimeout(resolve, 500));
						const count = await this.conversionService.processFile(file);
						if (count > 0) {
							new Notice(`Converted ${count} remote image(s) to local`);
							// Refresh the view to show updated content
							// The file modification will trigger Obsidian's UI refresh automatically
						}
					}
				}
			})
		);
	}

	/**
	 * Register commands
	 */
	private registerCommands(): void {
		// Insert local image
		this.addCommand({
			id: 'insert-image',
			name: 'Insert local image',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				openFilePicker(this.app, this.imageProcessor, this.propertyHandler);
			},
		});

		// Insert remote image
		this.addCommand({
			id: 'search-image',
			name: 'Insert remote image',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				openRemoteSearch(
					this.app,
					this.settings,
					this.remoteService,
					this.imageProcessor,
					this.propertyHandler
				);
			},
		});

		// Insert remote image to property
		this.addCommand({
			id: 'insert-remote-image-to-property',
			name: 'Insert remote image to property',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				openRemoteSearch(
					this.app,
					this.settings,
					this.remoteService,
					this.imageProcessor,
					this.propertyHandler,
					{ insertToProperty: true, propertyName: this.settings.defaultPropertyName }
				);
			},
		});

		// Insert local image to property
		this.addCommand({
			id: 'insert-local-image-to-property',
			name: 'Insert local image to property',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				openFilePicker(
					this.app,
					this.imageProcessor,
					this.propertyHandler,
					true, // insertToProperty
					this.settings.defaultPropertyName
				);
			},
		});

		// Convert remote images in current file
		this.addCommand({
			id: 'convert-remote-images',
			name: 'Convert remote images',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const file = view.file;
				if (!file) {
					new Notice('No active file');
					return;
				}

				const count = await this.conversionService.processFile(file);
				if (count > 0) {
					new Notice(`Converted ${count} remote image(s) to local`);
				} else {
					new Notice('No remote images found');
				}
			},
		});

		// Convert remote images in all files
		this.addCommand({
			id: 'convert-all-remote-images',
			name: 'Convert all remote images',
			callback: async () => {
				const { openConfirmModal } = await import('./modals/ConfirmModal');
				const result = await openConfirmModal(
					this.app,
					'Convert All Remote Images',
					'This will scan all files in your vault and convert every remote image URL to a local file. This action cannot be undone.\n\nEach image will be downloaded and you\'ll be prompted to rename them. This may take a while if you have many images.\n\nAre you sure you want to proceed?',
					'Yes, convert all images',
					'Cancel'
				);

				if (!result.confirmed) {
					return;
				}

				new Notice('Processing all files... This may take a while.');
				const count = await this.conversionService.processAllFiles();
				new Notice(`Converted ${count} remote image(s) to local`);
			},
		});
	}

	/**
	 * Load settings from storage
	 */
	async loadSettings(): Promise<void> {
		const data = await this.loadData() as Partial<ImageManagerSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
	}

	/**
	 * Save settings to storage
	 */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		// Update services with new settings
		this.storageManager?.updateSettings(this.settings);
		this.imageProcessor?.updateSettings(this.settings);
		this.propertyHandler?.updateSettings(this.settings);
		this.pasteHandler?.updateSettings(this.settings);
		this.dropHandler?.updateSettings(this.settings);
		this.remoteService?.updateSettings(this.settings);
		this.conversionService?.updateSettings(this.settings);
	}

	/**
	 * Debug logging
	 */
	private log(...args: unknown[]): void {
		if (this.settings?.debugMode) {
			console.log('[Image Manager]', ...args);
		}
	}
}
