/**
 * Banner Service
 * Handles banner image rendering from frontmatter properties
 * Supports both MD and MDX files via mdx-frontmatter utilities
 */

import {
	App,
	MarkdownView,
	Platform,
	TFile,
	WorkspaceLeaf,
	requestUrl,
} from 'obsidian';
import * as ObsidianModule from 'obsidian';

/**
 * Helper to set CSS properties on an element
 * Uses setCssProperties if available (Obsidian 1.11.0+), falls back to style.setProperty
 */
function setCssProperties(element: HTMLElement, props: Record<string, string>): void {
	// Try to use setCssProperties if available
	const obsidian = ObsidianModule as unknown as { setCssProperties?: (el: HTMLElement, props: Record<string, string>) => void };
	if (typeof obsidian.setCssProperties === 'function') {
		obsidian.setCssProperties(element, props);
	} else {
		// Fallback for older versions
		for (const [key, value] of Object.entries(props)) {
			element.style.setProperty(key, value);
		}
	}
}
import {
	ImageManagerSettings,
	BannerDeviceSettings,
	BannerImageOptions,
	BannerData,
	BannerContentType,
	BannerIconType,
	DeviceType,
} from '../types';
import { getFrontmatter } from '../utils/mdx-frontmatter';

// CSS class names
const CSS_CLASSES = {
	Main: 'image-manager-banner',
	Icon: 'banner-icon',
	Static: 'static',
} as const;

// Regular expressions for parsing image links
const PATTERNS = {
	Wikilink: /^!?\[\[([^\]]+?)(\|([^\]]+?))?\]\]$/,
	Markdown: /^!?\[([^\]]*)\]\(([^)]+?)\)$/,
	MarkdownBare: /^!?<([^>]+)>$/,
	Weblink: /^https?:\/\//i,
};

/**
 * Store for banner data per leaf
 */
const bannerDataStore = new Map<string, BannerData>();

export class BannerService {
	private app: App;
	private settings: ImageManagerSettings;

	constructor(app: App, settings: ImageManagerSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: ImageManagerSettings): void {
		this.settings = settings;
	}

	/**
	 * Get the current device type
	 */
	getCurrentDevice(): DeviceType {
		if (Platform.isPhone) {
			return DeviceType.Phone;
		}
		if (Platform.isTablet) {
			return DeviceType.Tablet;
		}
		return DeviceType.Desktop;
	}

	/**
	 * Get device-specific settings
	 */
	getDeviceSettings(): BannerDeviceSettings {
		const device = this.getCurrentDevice();
		return this.settings.banner[device];
	}

	/**
	 * Process all open markdown views
	 */
	processAll(): void {
		const deviceSettings = this.getDeviceSettings();
		
		this.app.workspace.iterateRootLeaves((leaf: WorkspaceLeaf) => {
			const view = leaf.view as MarkdownView;
			if (view instanceof MarkdownView) {
				if (deviceSettings.enabled) {
					const file = view?.file || null;
					void this.process(file, view);
				} else {
					this.remove(view);
				}
			}
		});
	}

	/**
	 * Process a single file/view
	 */
	async process(file: TFile | null, view?: MarkdownView): Promise<void> {
		const data = await this.compute(file, view);
		if (!data) {
			return;
		}
		if (!data.image) {
			this.remove(view, data);
			return;
		}
		if (!data.icon) {
			data.needsUpdate = true;
		}
		
		const deviceSettings = this.getDeviceSettings();
		if (deviceSettings.enabled) {
			await this.render(data, view);
		}
	}

	/**
	 * Compute banner data from frontmatter
	 */
	async compute(file: TFile | null, targetView?: MarkdownView): Promise<BannerData | null> {
		const view = targetView || this.getActiveView();
		if (!file || !(view instanceof MarkdownView)) {
			return null;
		}

		// Get leaf ID for data store
		// @ts-expect-error - leaf.id exists but is not in type definitions
		const leafId = view?.leaf?.id as string | undefined;
		if (!leafId) {
			return null;
		}

		const oldData = bannerDataStore.get(leafId) || this.createDefaultBannerData();
		const newData = this.createDefaultBannerData(view, oldData.viewMode);

		// Get frontmatter using MDX-compatible utility
		const frontmatter = await getFrontmatter(this.app, file);
		if (!frontmatter) {
			return newData;
		}

		const propertySettings = this.settings.banner.properties;
		const imageProp = propertySettings.imageProperty;
		const iconProp = propertySettings.iconProperty;

		// Parse image property
		const imageValue = frontmatter[imageProp];
		if (imageValue && typeof imageValue === 'string') {
			newData.image = imageValue;
			newData.filepath = file.path;
			
			if (oldData.filepath !== newData.filepath) {
				newData.needsUpdate = true;
				newData.isImageChange = true;
			} else if (oldData.image !== newData.image) {
				newData.needsUpdate = true;
				newData.isImageChange = true;
				
				// Check if only image properties (offset, repeat) changed
				if (await this.isImagePropertiesUpdate(oldData.image, newData.image, view)) {
					newData.isImagePropsUpdate = true;
					newData.isImageChange = false;
				}
			}
		}

		// Parse icon property if enabled
		const deviceSettings = this.getDeviceSettings();
		if (deviceSettings.iconEnabled) {
			const iconValue = frontmatter[iconProp];
			if (iconValue && typeof iconValue === 'string') {
				newData.icon = iconValue;
				if (oldData.icon !== newData.icon) {
					newData.needsUpdate = true;
				}
			} else if (oldData.icon) {
				newData.icon = null;
				newData.needsUpdate = true;
			}
		}

		return newData;
	}

	/**
	 * Render banner in the view
	 */
	async render(data: BannerData, targetView?: MarkdownView): Promise<void> {
		const { image, viewMode, lastViewMode, needsUpdate, isImageChange } = data;
		const view = targetView || this.getActiveView();
		
		if (!view || !(view instanceof MarkdownView)) {
			return;
		}

		const container = view.containerEl;
		if (!container || (!needsUpdate && lastViewMode === viewMode)) {
			return;
		}

		const containers: NodeListOf<HTMLElement> = container.querySelectorAll(
			'.cm-scroller, .markdown-reading-view > .markdown-preview-view'
		);

		if (containers.length === 0) {
			return;
		}

		const imageOptions = await this.parseLink(image || '', view);
		const banners = this.updateBannerElements(data, imageOptions, containers);

		// Update icon if enabled
		const deviceSettings = this.getDeviceSettings();
		if (deviceSettings.iconEnabled && data.icon) {
			await this.updateIcons(data, banners, view);
		}

		if (!isImageChange) {
			this.replaceBanners(banners);
		} else {
			this.injectBanners(banners, containers);
		}

		data.lastViewMode = viewMode;
		container.dataset.imBanner = '';

		// Store data for this leaf
		// @ts-expect-error - leaf.id exists but is not in type definitions
		const leafId = view?.leaf?.id as string | undefined;
		if (leafId) {
			bannerDataStore.set(leafId, data);
		}
	}

	/**
	 * Update banner DOM elements
	 */
	private updateBannerElements(
		data: BannerData,
		imgOptions: BannerImageOptions,
		containers: NodeListOf<HTMLElement>
	): HTMLElement[] {
		const { isImageChange, isImagePropsUpdate } = data;
		const banners: HTMLElement[] = [];

		containers.forEach(container => {
			let element = container.querySelector(`.${CSS_CLASSES.Main}`) as HTMLElement;
			if (!element) {
				element = document.createElement('div');
				element.classList.add(CSS_CLASSES.Main);
			}
			banners.push(element);

			if (isImageChange || isImagePropsUpdate) {
				if (isImageChange) {
					element.classList.remove(CSS_CLASSES.Static);
					element.firstChild?.remove();
				}

				// Use setCssProperties for dynamic styles
				const cssVars: Record<string, string> = {
					'--im-banner-img-x': `${imgOptions.x}px`,
					'--im-banner-img-y': `${imgOptions.y}px`,
					'--im-banner-size': imgOptions.repeatable ? 'auto' : 'cover',
					'--im-banner-repeat': imgOptions.repeatable ? 'repeat' : 'no-repeat',
					'--im-banner-url': 'none',
				};

				if (imgOptions.type === BannerContentType.Video) {
					const video = document.createElement('video');
					video.controls = false;
					video.autoplay = true;
					video.muted = true;
					video.loop = true;
					video.src = imgOptions.url.replace(/^"|"$/g, '');
					element.appendChild(video);
				} else {
					cssVars['--im-banner-url'] = `url(${imgOptions.url})`;
				}

				setCssProperties(container, cssVars);
			}
		});

		return banners;
	}

	/**
	 * Update icon elements on banners
	 */
	private async updateIcons(data: BannerData, banners: HTMLElement[], view?: MarkdownView): Promise<void> {
		const deviceSettings = this.getDeviceSettings();
		let calculatedFontSize: string | null = null;

		for (const banner of banners) {
			const { icon } = data;
			let iconContainer: HTMLElement | null = banner.querySelector(`.${CSS_CLASSES.Icon}`);
			const hasContainer = iconContainer !== null;
			
			if (hasContainer) {
				iconContainer?.classList.add(CSS_CLASSES.Static);
			}
			
			if (deviceSettings.iconEnabled && icon) {
				if (!hasContainer) {
					iconContainer = document.createElement('div');
					iconContainer.classList.add(CSS_CLASSES.Icon);
					const innerDiv = document.createElement('div');
					iconContainer.appendChild(innerDiv);
					banner.prepend(iconContainer);
				}

				const iconElement = iconContainer?.querySelector('div') as HTMLElement;
				if (!iconElement) continue;

				const iconData = await this.parseIcon(icon, view);
				
				// Escape special characters in the value for CSS
				let value = iconData.value?.replace(/([#.:[\\]"])/g, '\\$1') || '';
				iconElement.dataset.type = iconData.type;

				if (iconData.type === BannerIconType.Link) {
					setCssProperties(iconElement, {
						'--im-banner-icon-value': `url(${value})`,
					});
				} else {
					// Text/emoji icon
					calculatedFontSize = calculatedFontSize ?? this.calculateFontSize(value, deviceSettings.iconSize);
					setCssProperties(iconElement, {
						'--im-banner-icon-value': `"${value}"`,
						'--im-banner-icon-fontsize': calculatedFontSize,
					});
				}
			} else if (hasContainer && iconContainer) {
				data.icon = null;
				iconContainer.remove();
			}
		}
	}

	/**
	 * Inject banners into containers
	 */
	private injectBanners(banners: HTMLElement[], containers: NodeListOf<HTMLElement>): void {
		containers.forEach((container, index) => {
			const banner = banners[index];
			if (banner) {
				container.prepend(banner);
				banner.onanimationend = () => {
					banner.classList.add(CSS_CLASSES.Static);
				};
			}
		});
	}

	/**
	 * Replace banners (no animation)
	 */
	private replaceBanners(banners: HTMLElement[]): void {
		banners.forEach(banner => {
			banner.classList.add(CSS_CLASSES.Static);
		});
	}

	/**
	 * Remove banner from view
	 */
	remove(view?: MarkdownView, data?: BannerData): void {
		const targetView = view || data?.filepath ? this.getActiveView() : null;
		if (!(targetView instanceof MarkdownView)) {
			return;
		}

		const container = targetView.containerEl;
		if (!container) {
			return;
		}

		const targets = container.querySelectorAll(`.${CSS_CLASSES.Main}`);
		targets.forEach(t => t.remove());

		// @ts-expect-error - leaf.id exists but is not in type definitions
		const leafId = targetView?.leaf?.id as string | undefined;
		if (leafId) {
			bannerDataStore.delete(leafId);
		}
		delete container.dataset.imBanner;
	}

	/**
	 * Apply current settings to DOM
	 */
	applySettings(): void {
		const deviceSettings = this.getDeviceSettings();
		const height = deviceSettings.height;
		const noteOffset = deviceSettings.noteOffset;
		const viewOffset = deviceSettings.viewOffset;
		const radius = deviceSettings.borderRadius;
		const padding = deviceSettings.padding;
		const fade = deviceSettings.fade;

		const cssVars: Record<string, string> = {
			'--im-banner-height': `${height}px`,
			'--im-banner-note-offset': `${noteOffset}px`,
			'--im-banner-view-offset': `${viewOffset}px`,
			'--im-banner-radius': `${radius[0]}px ${radius[1]}px ${radius[2]}px ${radius[3]}px`,
			'--im-banner-padding': `${padding}px`,
			'--im-banner-mask': fade ? 'revert-layer' : 'initial',
			'--im-banner-mask-webkit': fade ? 'revert-layer' : 'initial',
		};

		if (deviceSettings.iconEnabled) {
			cssVars['--im-banner-icon-size-w'] = `${deviceSettings.iconSize}px`;
			cssVars['--im-banner-icon-size-h'] = `${deviceSettings.iconSize}px`;
			cssVars['--im-banner-icon-radius'] = `${deviceSettings.iconRadius}px`;
			cssVars['--im-banner-icon-align-h'] = deviceSettings.iconAlignmentH;
			cssVars['--im-banner-icon-align-v'] = deviceSettings.iconAlignmentV;
			cssVars['--im-banner-icon-offset-x'] = `${deviceSettings.iconOffsetX}px`;
			cssVars['--im-banner-icon-offset-y'] = `${deviceSettings.iconOffsetY}px`;
			cssVars['--im-banner-icon-border'] = `${deviceSettings.iconBorder}px`;
			cssVars['--im-banner-icon-background'] = deviceSettings.iconBackground ? 'revert-layer' : 'transparent';
		}

		setCssProperties(document.body, cssVars);

		this.processAll();
	}

	/**
	 * Parse image link string into options
	 */
	async parseLink(str: string, view?: MarkdownView | null): Promise<BannerImageOptions> {
		let url: string | null = null;
		let displayText: string | null = null;
		let external = false;
		let obsidianUrl = false;
		let options = { x: 0, y: 0, repeatable: false };

		// Try wikilink format
		const wikilinkMatch = str.match(PATTERNS.Wikilink);
		if (wikilinkMatch) {
			url = wikilinkMatch[1]?.trim() ?? null;
			displayText = wikilinkMatch[3]?.trim() ?? null;
		}

		// Try markdown format
		const markdownMatch = str.match(PATTERNS.Markdown);
		const markdownBareMatch = str.match(PATTERNS.MarkdownBare);
		if (markdownMatch) {
			displayText = markdownMatch[1]?.trim() ?? null;
			url = markdownMatch[2]?.trim() ?? null;
		} else if (markdownBareMatch) {
			url = markdownBareMatch[1]?.trim() ?? null;
			displayText = null;
		}

		// Default to raw string
		if (!url) {
			url = str;
			displayText = null;
		}

		external = PATTERNS.Weblink.test(url);

		// Handle obsidian:// URLs
		if (this.isObsidianUrl(url)) {
			const urlStr = url.replace('obsidian://open', '');
			const params = new URLSearchParams(urlStr);
			const file = params.get('file');
			if (file) {
				url = file;
				obsidianUrl = true;
				external = false;
				displayText = null;
			}
		}

		// Handle file:// URLs
		if (url.startsWith('file:')) {
			url = url.replace(/^file:\/{1,}/, Platform.resourcePathPrefix);
			external = true;
		}

		// Parse offset/repeat from hash for external URLs
		const hashIndex = url.indexOf('#');
		if ((external || obsidianUrl) && hashIndex !== -1) {
			options = this.parseImageProperties(url.substring(hashIndex + 1));
			url = url.replace(/#.*/, '').trim();
		}

		// Parse offset/repeat from display text
		if (displayText) {
			options = this.parseImageProperties(displayText);
		}

		// Resolve internal paths
		if (!external) {
			const vault = this.app.vault;
			let file: TFile | null = null;

			// Try relative path resolution
			if (view?.file && (url.includes('../') || url.includes('./') || (!url.startsWith('/') && url.includes('/')))) {
				const resolvedPath = this.app.metadataCache.getFirstLinkpathDest(url, view.file.path);
				if (resolvedPath) {
					file = resolvedPath;
				}
			}

			// Fallback to exact path/name matching
			if (!file) {
				const files = vault.getFiles().filter(f => f.path === url || f.name === url);
				file = files.find(f => f.path === url) || files.find(f => f.name === url) || null;
			}

			if (file) {
				url = vault.getResourcePath(file);
			}
		}

		// Detect content type
		let type: BannerContentType | null = null;
		try {
			const urlObj = new URL(url);
			const extension = urlObj.pathname.split('.').pop()?.toLowerCase();
			const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
			const videoExtensions = ['mp4', 'webm', 'ogg', 'ogv', 'mov'];

			if (extension && imageExtensions.includes(extension)) {
				type = BannerContentType.Image;
			} else if (extension && videoExtensions.includes(extension)) {
				type = BannerContentType.Video;
			}

			// Fallback to HEAD request if type not detected
			if (!type) {
				try {
					const response = await requestUrl({ url, method: 'HEAD' });
					const contentType = response?.headers['content-type'] || null;
					if (contentType) {
						if (contentType.includes('image')) {
							type = BannerContentType.Image;
						} else if (contentType.includes('video')) {
							type = BannerContentType.Video;
						}
					}
				} catch {
					// Ignore HEAD request errors
				}
			}
		} catch {
			// Ignore URL parsing errors
		}

		return {
			url: `"${url.trim().replace(/(["\\])/g, '\\$1')}"`,
			external,
			type,
			...options,
		};
	}

	/**
	 * Parse image properties (offset, repeat) from string
	 */
	private parseImageProperties(str: string): { x: number; y: number; repeatable: boolean } {
		const values = str.toLowerCase();
		const repeatable = values.includes('repeat');

		const sizes = str.split(/x|,/);
		const numbers = sizes.filter(v => !isNaN(parseInt(v.trim(), 10)));

		let x = 0;
		let y = 0;

		const num0 = numbers[0];
		const num1 = numbers[1];
		if (numbers.length === 2 && num0 && num1) {
			x = parseInt(num0.trim(), 10);
			y = parseInt(num1.trim(), 10);
		} else if (numbers.length === 1 && num0) {
			y = parseInt(num0.trim(), 10);
		}

		return { x, y, repeatable };
	}

	/**
	 * Parse icon property
	 */
	async parseIcon(icon: string, view?: MarkdownView | null): Promise<{ value: string | null; type: BannerIconType }> {
		const str = icon || '';
		const result = { value: null as string | null, type: BannerIconType.Text };

		// Check if it's a link format (explicit patterns or file path with image extension)
		const isExplicitLink = 
			PATTERNS.Wikilink.test(str) ||
			PATTERNS.Markdown.test(str) ||
			PATTERNS.MarkdownBare.test(str) ||
			PATTERNS.Weblink.test(str) ||
			this.isObsidianUrl(str);
		
		// Check if it looks like a file path (has image extension)
		const imageExtensions = /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico|avif)$/i;
		const isFilePath = imageExtensions.test(str);

		if (isExplicitLink || isFilePath) {
			result.type = BannerIconType.Link;
			const data = await this.parseLink(str, view);
			result.value = data.url;
		} else {
			result.value = str;
		}

		return result;
	}

	/**
	 * Check if only image properties changed (not the URL)
	 */
	private async isImagePropertiesUpdate(
		oldStr: string | null,
		newStr: string | null,
		view?: MarkdownView | null
	): Promise<boolean> {
		if (!oldStr || !newStr) {
			return false;
		}
		const oldOpt = await this.parseLink(oldStr, view);
		const newOpt = await this.parseLink(newStr, view);
		return oldOpt.url === newOpt.url;
	}

	/**
	 * Check if URL is an obsidian:// URL
	 */
	private isObsidianUrl(url: string): boolean {
		return url.startsWith('obsidian://open');
	}

	/**
	 * Calculate font size to fit text in icon
	 * Uses actual DOM measurement for accurate sizing
	 */
	private calculateFontSize(textContent: string, iconSize: number): string {
		const temp = document.createElement('span');
		temp.addClass('im-measure-temp');
		// Direct style manipulation required for measurement element
		// This element is temporary and immediately removed after measurement
		// eslint-disable-next-line obsidianmd/no-static-styles-assignment
		temp.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;padding:0;margin:0;left:-9999px';
		temp.textContent = textContent.toUpperCase();
		document.body.appendChild(temp);
		
		const checkWidth = iconSize - 16;
		let fontSize = iconSize; // Start big
		temp.style.fontSize = `${fontSize}px`;

		while (temp.offsetWidth > checkWidth && fontSize > 1) {
			fontSize -= 1;
			temp.style.fontSize = `${fontSize}px`;
		}

		document.body.removeChild(temp);
		return `${fontSize}px`;
	}

	/**
	 * Get active markdown view
	 */
	private getActiveView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	/**
	 * Create default banner data object
	 */
	private createDefaultBannerData(view?: MarkdownView | null, lastViewMode?: 'source' | 'preview' | null): BannerData {
		let viewMode: 'source' | 'preview' | null = null;
		if (view) {
			const mode = view.getMode();
			viewMode = mode === 'preview' ? 'preview' : 'source';
		}
		return {
			filepath: null,
			image: null,
			icon: null,
			viewMode,
			lastViewMode: lastViewMode || null,
			isImagePropsUpdate: false,
			isImageChange: false,
			needsUpdate: false,
		};
	}

	/**
	 * Cleanup when plugin unloads
	 */
	destroy(): void {
		// Remove all banners
		document.querySelectorAll(`.${CSS_CLASSES.Main}`).forEach(el => el.remove());
		
		// Clear data store
		bannerDataStore.clear();
	}
}
