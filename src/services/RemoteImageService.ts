/**
 * Remote Image Service
 * API integrations for Unsplash, Pexels, and Pixabay
 */

import { requestUrl } from 'obsidian';
import { ImageManagerSettings, ImageProvider, ImageOrientation, RemoteImage, ImageSize } from '../types';

// Unsplash proxy URL (built-in fallback) - matches Image Manager pattern
const UNSPLASH_PROXY = 'https://insert-unsplash-image.cloudy9101.com/';

export class RemoteImageService {
	private settings: ImageManagerSettings;

	constructor(settings: ImageManagerSettings) {
		this.settings = settings;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: ImageManagerSettings): void {
		this.settings = settings;
	}

	/**
	 * Search for images from the specified provider
	 */
	async search(query: string, provider?: ImageProvider, page: number = 1): Promise<RemoteImage[]> {
		const targetProvider = provider ?? this.settings.defaultProvider;

		switch (targetProvider) {
			case ImageProvider.Unsplash:
				return await this.searchUnsplash(query, page);
			case ImageProvider.Pexels:
				return await this.searchPexels(query, page);
			case ImageProvider.Pixabay:
				return await this.searchPixabay(query, page);
			default:
				throw new Error(`Unsupported provider: ${targetProvider}`);
		}
	}

	/**
	 * Search Unsplash
	 */
	private async searchUnsplash(query: string, page: number): Promise<RemoteImage[]> {
		let proxyUrl = this.settings.unsplashProxyServer || UNSPLASH_PROXY;
		// Ensure proxy URL ends with slash for URL constructor
		if (!proxyUrl.endsWith('/')) {
			proxyUrl += '/';
		}
		const orientation = this.mapOrientation(this.settings.defaultOrientation);
		
		// Use URL constructor pattern
		const url = new URL('/search/photos', proxyUrl);
		url.searchParams.set('query', query);
		url.searchParams.set('page', String(page));
		url.searchParams.set('per_page', '20');

		if (orientation) {
			url.searchParams.set('orientation', orientation);
		}

		const response = await requestUrl({ url: url.toString() });
		if (response.status >= 400) {
			console.error('Unsplash API error:', response.status, response.text);
			throw new Error(`Unsplash search failed: ${response.status} - ${response.text}`);
		}

		const data = response.json as UnsplashSearchResponse;
		if (!data || !data.results) {
			console.error('Invalid Unsplash response:', data);
			throw new Error('Invalid response from Unsplash API');
		}

		const results: UnsplashPhoto[] = data.results ?? [];

		return results.map((photo) => this.mapUnsplashPhoto(photo));
	}

	/**
	 * Search Pexels
	 */
	private async searchPexels(query: string, page: number): Promise<RemoteImage[]> {
		const apiKey = this.settings.pexelsApiKey;
		if (!apiKey) {
			throw new Error('Pexels API key is required. Please configure it in settings.');
		}

		const orientation = this.mapOrientation(this.settings.defaultOrientation);
		
		const params = new URLSearchParams({
			query,
			page: String(page),
			per_page: '20',
		});

		if (orientation) {
			params.set('orientation', orientation);
		}

		const url = `https://api.pexels.com/v1/search?${params.toString()}`;

		const response = await requestUrl({
			url,
			headers: {
				Authorization: apiKey,
			},
		});

		if (response.status >= 400) {
			throw new Error(`Pexels search failed: ${response.status}`);
		}

		const data = response.json as PexelsSearchResponse;
		const photos: PexelsPhoto[] = data.photos ?? [];

		return photos.map((photo) => this.mapPexelsPhoto(photo));
	}

	/**
	 * Search Pixabay
	 */
	private async searchPixabay(query: string, page: number): Promise<RemoteImage[]> {
		const apiKey = this.settings.pixabayApiKey;
		if (!apiKey) {
			throw new Error('Pixabay API key is required. Please configure it in settings.');
		}

		const orientation = this.mapPixabayOrientation(this.settings.defaultOrientation);

		const params = new URLSearchParams({
			key: apiKey,
			q: query,
			page: String(page),
			per_page: '20',
			image_type: 'photo',
		});

		if (orientation) {
			params.set('orientation', orientation);
		}

		const url = `https://pixabay.com/api/?${params.toString()}`;

		const response = await requestUrl({ url });
		if (response.status >= 400) {
			throw new Error(`Pixabay search failed: ${response.status}`);
		}

		const data = response.json as PixabaySearchResponse;
		const hits: PixabayHit[] = data.hits ?? [];

		return hits.map((hit) => this.mapPixabayHit(hit));
	}

	/**
	 * Get the download URL for an image based on size preference
	 */
	getDownloadUrl(image: RemoteImage, size?: ImageSize): string {
		const targetSize = size ?? this.settings.defaultImageSize;
		switch (targetSize) {
			case ImageSize.Original:
				return image.fullUrl;
			case ImageSize.Large:
				return image.regularUrl;
			case ImageSize.Medium:
				return image.regularUrl;
			case ImageSize.Small:
				return image.thumbnailUrl;
			default:
				return image.regularUrl;
		}
	}

	/**
	 * Download an image and return the binary data
	 */
	async downloadImage(image: RemoteImage): Promise<ArrayBuffer> {
		const url = this.getDownloadUrl(image);
		const response = await requestUrl({ url });
		
		if (response.status >= 400) {
			throw new Error(`Failed to download image: ${response.status}`);
		}

		return response.arrayBuffer;
	}

	/**
	 * Generate referral text for an image (attribution)
	 */
	generateReferralText(image: RemoteImage): string {
		if (!this.settings.insertReferral) {
			return '';
		}

		const backlink = this.settings.insertBackLink && image.pageUrl
			? `[Backlink](${image.pageUrl}) | `
			: '';

		let referral = '';
		switch (image.provider) {
			case ImageProvider.Unsplash:
				if (image.author && image.authorUrl) {
					const utm = 'utm_source=Obsidian%20Image%20Manager&utm_medium=referral';
					referral = `\n*${backlink}Photo by [${image.author}](${image.authorUrl}) on [Unsplash](https://unsplash.com/?${utm})*\n`;
				}
				break;
			case ImageProvider.Pexels:
				if (image.author && image.authorUrl) {
					referral = `\n*${backlink}Photo by [${image.author}](${image.authorUrl}) on [Pexels](https://www.pexels.com/)*\n`;
				}
				break;
			case ImageProvider.Pixabay:
				if (image.author && image.authorUrl) {
					referral = `\n*${backlink}Image by [${image.author}](${image.authorUrl}) on [Pixabay](https://pixabay.com/)*\n`;
				}
				break;
		}

		return referral;
	}

	/**
	 * Map orientation setting to API parameter
	 */
	private mapOrientation(orientation: ImageOrientation): string | null {
		switch (orientation) {
			case ImageOrientation.Landscape:
				return 'landscape';
			case ImageOrientation.Portrait:
				return 'portrait';
			case ImageOrientation.Square:
				return 'squarish';
			default:
				return null;
		}
	}

	/**
	 * Map orientation for Pixabay (different values)
	 */
	private mapPixabayOrientation(orientation: ImageOrientation): string | null {
		switch (orientation) {
			case ImageOrientation.Landscape:
				return 'horizontal';
			case ImageOrientation.Portrait:
				return 'vertical';
			default:
				return null;
		}
	}

	/**
	 * Map Unsplash photo to RemoteImage
	 */
	private mapUnsplashPhoto(photo: UnsplashPhoto): RemoteImage {
		return {
			id: photo.id,
			provider: ImageProvider.Unsplash,
			thumbnailUrl: photo.urls.thumb,
			regularUrl: photo.urls.regular,
			fullUrl: photo.urls.full,
			downloadUrl: photo.links.download_location || photo.links.download,
			width: photo.width,
			height: photo.height,
			description: photo.description ?? photo.alt_description ?? '',
			author: photo.user.name,
			authorUrl: photo.user.links.html,
			pageUrl: photo.links.html,
		};
	}

	/**
	 * Map Pexels photo to RemoteImage
	 */
	private mapPexelsPhoto(photo: PexelsPhoto): RemoteImage {
		return {
			id: String(photo.id),
			provider: ImageProvider.Pexels,
			thumbnailUrl: photo.src.tiny,
			regularUrl: photo.src.large,
			fullUrl: photo.src.original,
			downloadUrl: photo.src.original,
			width: photo.width,
			height: photo.height,
			description: photo.alt ?? '',
			author: photo.photographer,
			authorUrl: photo.photographer_url,
			pageUrl: photo.url,
		};
	}

	/**
	 * Map Pixabay hit to RemoteImage
	 */
	private mapPixabayHit(hit: PixabayHit): RemoteImage {
		return {
			id: String(hit.id),
			provider: ImageProvider.Pixabay,
			thumbnailUrl: hit.previewURL,
			regularUrl: hit.webformatURL,
			fullUrl: hit.largeImageURL,
			downloadUrl: hit.largeImageURL,
			width: hit.imageWidth,
			height: hit.imageHeight,
			description: hit.tags,
			author: hit.user,
			authorUrl: `https://pixabay.com/users/${hit.user}-${hit.user_id}/`,
			pageUrl: hit.pageURL,
		};
	}
}

// Type definitions for API responses

interface UnsplashSearchResponse {
	results: UnsplashPhoto[];
}

interface PexelsSearchResponse {
	photos: PexelsPhoto[];
}

interface PixabaySearchResponse {
	hits: PixabayHit[];
}

interface UnsplashPhoto {
	id: string;
	width: number;
	height: number;
	description: string | null;
	alt_description: string | null;
	urls: {
		raw: string;
		full: string;
		regular: string;
		small: string;
		thumb: string;
	};
	links: {
		html: string;
		download: string;
		download_location?: string;
	};
	user: {
		name: string;
		links: {
			html: string;
		};
	};
}

interface PexelsPhoto {
	id: number;
	width: number;
	height: number;
	url: string;
	photographer: string;
	photographer_url: string;
	alt: string | null;
	src: {
		original: string;
		large: string;
		medium: string;
		small: string;
		tiny: string;
	};
}

interface PixabayHit {
	id: number;
	pageURL: string;
	previewURL: string;
	webformatURL: string;
	largeImageURL: string;
	imageWidth: number;
	imageHeight: number;
	tags: string;
	user: string;
	user_id: number;
}
