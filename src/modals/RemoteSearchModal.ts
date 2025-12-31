/**
 * Remote Search Modal
 * Search and insert images from Unsplash, Pexels, and Pixabay
 * Based on Image Inserter's modal structure
 */

import { App, Modal, Notice, MarkdownView, TFile, debounce } from 'obsidian';
import { ImageProvider, RemoteImage, ImageManagerSettings, ImageSize } from '../types';
import { RemoteImageService } from '../services/RemoteImageService';
import { ImageProcessor } from '../services/ImageProcessor';
import { PropertyHandler } from '../services/PropertyHandler';

export interface RemoteSearchOptions {
	insertToProperty?: boolean;
	propertyName?: string;
}

export class RemoteSearchModal extends Modal {
	private settings: ImageManagerSettings;
	private remoteService: RemoteImageService;
	private imageProcessor: ImageProcessor;
	private propertyHandler: PropertyHandler;
	private options: RemoteSearchOptions;

	private container: HTMLElement | null = null;
	private queryInput: HTMLInputElement | null = null;
	private providerSelect: HTMLSelectElement | null = null;
	private sizeSelect: HTMLSelectElement | null = null;
	private scrollArea: HTMLElement | null = null;
	private imagesList: HTMLElement | null = null;
	private loadingContainer: HTMLElement | null = null;

	private currentQuery: string = '';
	private currentProvider: ImageProvider;
	private currentPage: number = 1;
	private currentResults: RemoteImage[] = [];
	private isLoading: boolean = false;
	private selectedImage: number = 0;

	constructor(
		app: App,
		settings: ImageManagerSettings,
		remoteService: RemoteImageService,
		imageProcessor: ImageProcessor,
		propertyHandler: PropertyHandler,
		options: RemoteSearchOptions = {}
	) {
		super(app);
		this.settings = settings;
		this.remoteService = remoteService;
		this.imageProcessor = imageProcessor;
		this.propertyHandler = propertyHandler;
		this.options = options;
		this.currentProvider = settings.defaultProvider;
		this.containerEl.addClass('image-inserter-container');
	}

	onOpen(): void {
		const { contentEl } = this;

		// Main container
		this.container = contentEl.createDiv({ cls: 'container' });

		// Input group
		const inputGroup = this.container.createDiv({ cls: 'input-group' });

		// Query input
		this.queryInput = inputGroup.createEl('input', {
			type: 'text',
			cls: 'query-input',
			attr: { placeholder: 'Search images...', autofocus: 'true' },
		});

		// Provider selector
		this.providerSelect = inputGroup.createEl('select', { cls: 'selector' });
		this.providerSelect.createEl('option', { text: 'Unsplash', value: ImageProvider.Unsplash });
		this.providerSelect.createEl('option', { text: 'Pexels', value: ImageProvider.Pexels });
		this.providerSelect.createEl('option', { text: 'Pixabay', value: ImageProvider.Pixabay });
		this.providerSelect.value = this.currentProvider;

		// Size selector
		this.sizeSelect = inputGroup.createEl('select', { cls: 'selector' });
		this.sizeSelect.createEl('option', { text: 'Original', value: ImageSize.Original });
		this.sizeSelect.createEl('option', { text: 'Large', value: ImageSize.Large });
		this.sizeSelect.createEl('option', { text: 'Medium', value: ImageSize.Medium });
		this.sizeSelect.createEl('option', { text: 'Small', value: ImageSize.Small });
		this.sizeSelect.value = this.settings.defaultImageSize;

		// Loading container
		this.loadingContainer = this.container.createDiv({ cls: 'loading-container' });
		const loaderIcon = this.loadingContainer.createDiv({ cls: 'loader-icon' });
		const svg = loaderIcon.createEl('svg', {
			attr: {
				xmlns: 'http://www.w3.org/2000/svg',
				width: '24',
				height: '24',
				viewBox: '0 0 24 24',
			},
		});
		svg.setAttribute('fill', 'none');
		svg.setAttribute('stroke', 'currentColor');
		svg.setAttribute('stroke-width', '2');
		svg.setAttribute('stroke-linecap', 'round');
		svg.setAttribute('stroke-linejoin', 'round');
		svg.addClass('lucide', 'lucide-loader-circle');
		svg.createEl('path', {
			attr: { d: 'M21 12a9 9 0 1 1-6.219-8.56' },
		});
		this.showLoading(false);

		// Scroll area
		this.scrollArea = this.container.createDiv({ cls: 'scroll-area' });
		this.imagesList = this.scrollArea.createDiv({ cls: 'images-list' });

		// Event listeners
		this.setupEventListeners();

		// Focus input
		setTimeout(() => {
			this.queryInput?.focus();
		}, 50);
	}

	private setupEventListeners(): void {
		// Debounced search
		const debouncedSearch = debounce((query: string) => {
			if (query.trim()) {
				void this.performSearch(query);
			} else {
				this.clearResults();
			}
		}, 1000, true);

		// Query input
		this.queryInput?.addEventListener('input', (e) => {
			const query = (e.target as HTMLInputElement).value;
			this.currentQuery = query;
			this.showLoading(true);
			debouncedSearch(query);
		});

		this.queryInput?.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				const query = this.queryInput?.value.trim() || '';
				if (query) {
					void this.performSearch(query);
				} else if (this.currentResults.length > 0 && this.selectedImage < this.currentResults.length) {
					// Insert selected image on Enter
					const image = this.currentResults[this.selectedImage];
					if (image) {
						void this.insertImage(image);
					}
				}
			} else if (e.ctrlKey && e.key === 'n') {
				e.preventDefault();
				if (this.currentResults.length > 0) {
					this.selectedImage = (this.selectedImage + 1) % this.currentResults.length;
					this.renderResults();
				}
			} else if (e.ctrlKey && e.key === 'p') {
				e.preventDefault();
				if (this.currentResults.length > 0) {
					this.selectedImage = (this.selectedImage - 1 + this.currentResults.length) % this.currentResults.length;
					this.renderResults();
				}
			}
		});

		// Provider change
		this.providerSelect?.addEventListener('change', (e) => {
			this.currentProvider = (e.target as HTMLSelectElement).value as ImageProvider;
			this.currentPage = 1;
			if (this.currentQuery) {
				this.showLoading(true);
				void this.performSearch(this.currentQuery);
			}
		});

		// Size change
		this.sizeSelect?.addEventListener('change', (e) => {
			const size = (e.target as HTMLSelectElement).value as ImageSize;
			this.settings.defaultImageSize = size;
			// Re-search if we have a query
			if (this.currentQuery) {
				this.showLoading(true);
				void this.performSearch(this.currentQuery);
			}
		});
	}

	private async performSearch(query: string): Promise<void> {
		if (this.isLoading) return;

		this.currentQuery = query;
		this.currentPage = 1;
		this.isLoading = true;
		this.showLoading(true);

		try {
			this.currentResults = await this.remoteService.search(
				query,
				this.currentProvider,
				this.currentPage
			);
			this.selectedImage = 0;
			this.renderResults();
		} catch (error) {
			console.error('Search failed:', error);
			const errorMsg = error instanceof Error ? error.message : 'Search failed';
			new Notice(`Request failed, status ${errorMsg}`);
			this.renderError(errorMsg);
		} finally {
			this.isLoading = false;
			this.showLoading(false);
		}
	}

	private renderResults(): void {
		if (!this.imagesList) return;
		this.imagesList.empty();

		if (this.currentResults.length === 0) {
			const noResult = this.imagesList.createDiv({ cls: 'no-result-container' });
			noResult.setText('No results found');
			return;
		}

		for (let i = 0; i < this.currentResults.length; i++) {
			const image = this.currentResults[i];
			if (!image) continue;

			const result = this.imagesList.createDiv({
				cls: `query-result${i === this.selectedImage ? ' is-selected' : ''}`,
			});

			result.createEl('img', {
				attr: {
					src: image.thumbnailUrl,
					alt: image.description || 'Image',
				},
			});

			result.addEventListener('click', () => {
				void this.insertImage(image);
			});

			result.addEventListener('mousemove', () => {
				this.selectedImage = i;
				this.renderResults();
			});
		}

		// Pagination
		this.renderPagination();
	}

	private renderPagination(): void {
		if (!this.scrollArea) return;

		// Remove existing pagination
		const existingPagination = this.scrollArea.querySelector('.pagination');
		if (existingPagination) {
			existingPagination.remove();
		}

		// Check if we have more pages (simplified - would need actual pagination info from API)
		const hasMore = this.currentResults.length >= 20;

		if (hasMore || this.currentPage > 1) {
			const pagination = this.scrollArea.createDiv({ cls: 'pagination' });

			if (this.currentPage > 1) {
				const prevBtn = pagination.createEl('button', { cls: 'btn', text: 'Previous' });
				prevBtn.addEventListener('click', () => {
					this.currentPage--;
					this.showLoading(true);
					void this.performSearch(this.currentQuery);
				});
			}

			if (hasMore) {
				const nextBtn = pagination.createEl('button', { cls: 'btn', text: 'Next' });
				nextBtn.addEventListener('click', () => {
					this.currentPage++;
					this.showLoading(true);
					void this.performSearch(this.currentQuery);
				});
			}
		}
	}

	private renderError(message: string): void {
		if (!this.imagesList) return;
		this.imagesList.empty();
		const errorDiv = this.imagesList.createDiv({ cls: 'no-result-container error-text' });
		errorDiv.setText(`Error: ${message}`);
	}

	private clearResults(): void {
		if (this.imagesList) {
			this.imagesList.empty();
		}
		this.currentResults = [];
	}

	private showLoading(show: boolean): void {
		if (this.loadingContainer) {
			this.loadingContainer.style.display = show ? 'flex' : 'none';
		}
		if (this.scrollArea) {
			if (show) {
				this.scrollArea.addClass('loading');
			} else {
				this.scrollArea.removeClass('loading');
			}
		}
	}

	private async insertImage(image: RemoteImage): Promise<void> {
		this.close();

		const activeFile = this.getActiveFile();
		if (!activeFile) {
			new Notice('No active file');
			return;
		}

		try {
			// Get download URL based on size
			const downloadUrl = this.remoteService.getDownloadUrl(image, this.settings.defaultImageSize);

			if (this.options.insertToProperty && this.options.propertyName) {
				// Insert into property
				await this.propertyHandler.insertImageFromUrl(
					downloadUrl,
					activeFile,
					this.options.propertyName
				);
			} else {
				// Insert into note body
				const result = await this.imageProcessor.processImageUrl(
					downloadUrl,
					activeFile,
					true // Show rename modal
				);

				if (result.success && result.linkText) {
					const view = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (view?.editor) {
						view.editor.replaceSelection(result.linkText);
					}
				}
			}
		} catch (error) {
			console.error('Failed to insert image:', error);
			new Notice(`Failed to insert image: ${error instanceof Error ? error.message : String(error)}`);
		}
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
 * Open the remote search modal
 */
export function openRemoteSearch(
	app: App,
	settings: ImageManagerSettings,
	remoteService: RemoteImageService,
	imageProcessor: ImageProcessor,
	propertyHandler: PropertyHandler,
	options: RemoteSearchOptions = {}
): void {
	new RemoteSearchModal(app, settings, remoteService, imageProcessor, propertyHandler, options).open();
}
