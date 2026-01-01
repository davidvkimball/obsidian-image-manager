/**
 * Image Manager Plugin Types
 * Shared TypeScript interfaces and type definitions
 */

/**
 * Supported image providers for remote search
 */
export enum ImageProvider {
	Unsplash = 'unsplash',
	Pexels = 'pexels',
	Pixabay = 'pixabay',
	Local = 'local',
}

/**
 * Image orientation filter
 */
export enum ImageOrientation {
	Any = 'any',
	Landscape = 'landscape',
	Portrait = 'portrait',
	Square = 'square',
}

/**
 * Image size preference
 */
export enum ImageSize {
	Original = 'original',
	Large = 'large',
	Medium = 'medium',
	Small = 'small',
}

/**
 * Link format for inserting images into properties
 */
export enum PropertyLinkFormat {
	Path = 'path',           // cover: path/to/image.jpg
	RelativePath = 'relative', // cover: ./image.jpg or image.jpg (same folder)
	Wikilink = 'wikilink',   // cover: "[[path/to/image.jpg]]"
	Markdown = 'markdown',   // cover: "![](path/to/image.jpg)"
	Custom = 'custom',       // cover: "{image-url}" with custom format
}

/**
 * Attachment location override options
 */
export enum AttachmentLocation {
	ObsidianDefault = 'obsidian',  // Follow Obsidian's setting
	SameFolder = 'same',           // Same folder as note
	Subfolder = 'subfolder',       // Configurable subfolder
	VaultFolder = 'vault',         // Centralized vault folder
}

/**
 * Device types for banner settings
 */
export enum DeviceType {
	Desktop = 'desktop',
	Tablet = 'tablet',
	Phone = 'phone',
}

/**
 * Icon type for banner icons
 */
export enum BannerIconType {
	Link = 'link',
	Text = 'text',
}

/**
 * Content type for banner (image or video)
 */
export enum BannerContentType {
	Image = 'image',
	Video = 'video',
}

/**
 * Device-specific banner settings
 */
export interface BannerDeviceSettings {
	// Core banner settings
	enabled: boolean;
	height: number;
	viewOffset: number;
	noteOffset: number;
	borderRadius: [number, number, number, number];
	padding: number;
	fade: boolean;
	
	// Icon settings
	iconEnabled: boolean;
	iconSize: number;
	iconRadius: number;
	iconBackground: boolean;
	iconBorder: number;
	iconAlignmentH: 'flex-start' | 'center' | 'flex-end';
	iconAlignmentV: 'flex-start' | 'center' | 'flex-end';
	iconOffsetX: number;
	iconOffsetY: number;
}

/**
 * Banner property settings (global, not device-specific)
 */
export interface BannerPropertySettings {
	imageProperty: string;
	iconProperty: string;
}

/**
 * Complete banner settings
 */
export interface BannerSettings {
	properties: BannerPropertySettings;
	desktop: BannerDeviceSettings;
	tablet: BannerDeviceSettings;
	phone: BannerDeviceSettings;
}

/**
 * Parsed banner image options
 */
export interface BannerImageOptions {
	url: string;
	external: boolean;
	x: number;
	y: number;
	type: BannerContentType | null;
	repeatable: boolean;
}

/**
 * Banner data for a specific view
 */
export interface BannerData {
	filepath: string | null;
	image: string | null;
	icon: string | null;
	viewMode: 'source' | 'preview' | null;
	lastViewMode: 'source' | 'preview' | null;
	isImageChange: boolean;
	isImagePropsUpdate: boolean;
	needsUpdate: boolean;
}

/**
 * Default device-specific banner settings
 */
export const DEFAULT_BANNER_DEVICE_SETTINGS: Record<DeviceType, BannerDeviceSettings> = {
	[DeviceType.Desktop]: {
		enabled: true,
		height: 240,
		viewOffset: 0,
		noteOffset: -32,
		borderRadius: [8, 8, 8, 8],
		padding: 8,
		fade: true,
		iconEnabled: false,
		iconSize: 96,
		iconRadius: 8,
		iconBackground: true,
		iconBorder: 2,
		iconAlignmentH: 'flex-start',
		iconAlignmentV: 'flex-end',
		iconOffsetX: 0,
		iconOffsetY: -24,
	},
	[DeviceType.Tablet]: {
		enabled: true,
		height: 190,
		viewOffset: 0,
		noteOffset: -32,
		borderRadius: [8, 8, 8, 8],
		padding: 8,
		fade: true,
		iconEnabled: false,
		iconSize: 96,
		iconRadius: 8,
		iconBackground: true,
		iconBorder: 2,
		iconAlignmentH: 'flex-start',
		iconAlignmentV: 'flex-end',
		iconOffsetX: 0,
		iconOffsetY: -24,
	},
	[DeviceType.Phone]: {
		enabled: true,
		height: 160,
		viewOffset: 0,
		noteOffset: -32,
		borderRadius: [8, 8, 8, 8],
		padding: 8,
		fade: true,
		iconEnabled: false,
		iconSize: 56,
		iconRadius: 8,
		iconBackground: true,
		iconBorder: 2,
		iconAlignmentH: 'flex-start',
		iconAlignmentV: 'flex-end',
		iconOffsetX: 0,
		iconOffsetY: -24,
	},
};

/**
 * Default banner settings
 */
export const DEFAULT_BANNER_SETTINGS: BannerSettings = {
	properties: {
		imageProperty: 'banner',
		iconProperty: 'icon',
	},
	desktop: { ...DEFAULT_BANNER_DEVICE_SETTINGS[DeviceType.Desktop] },
	tablet: { ...DEFAULT_BANNER_DEVICE_SETTINGS[DeviceType.Tablet] },
	phone: { ...DEFAULT_BANNER_DEVICE_SETTINGS[DeviceType.Phone] },
};

/**
 * Plugin settings interface
 */
export interface ImageManagerSettings {
	// General Settings
	enableRenameOnPaste: boolean;
	enableRenameOnDrop: boolean;
	imageNameTemplate: string;
	attachmentLocation: AttachmentLocation;
	customAttachmentPath: string;
	
	// Image Services
	defaultProvider: ImageProvider;
	unsplashProxyServer: string;
	pexelsApiKey: string;
	pixabayApiKey: string;
	defaultOrientation: ImageOrientation;
	defaultImageSize: ImageSize;
	
	// Property Insertion
	enablePropertyPaste: boolean;
	propertyLinkFormat: PropertyLinkFormat;
	customPropertyLinkFormat: string;
	defaultPropertyName: string;
	
	// Conversion
	autoConvertRemoteImages: boolean;
	convertOnNoteOpen: boolean;
	convertOnNoteSave: boolean;
	
	// Rename Options
	autoRename: boolean;
	dupNumberDelimiter: string;
	dupNumberAtStart: boolean;
	disableRenameNotice: boolean;
	enableDescriptiveImages: boolean; // Ask for description, use as display text (note body only)
	
	// Image Insertion Options (from Image Inserter)
	insertSize: string; // Image size in markdown (e.g., "200" or "200x100")
	insertReferral: boolean; // Insert attribution text (e.g., "Photo by [author] on [provider]")
	insertBackLink: boolean; // Insert backlink before attribution (e.g., "[Backlink](url) | Photo by...")
	appendReferral: boolean; // Append referral at end of file when inserting to frontmatter
	
	// Banner Settings
	banner: BannerSettings;
	
	// Advanced
	supportedExtensions: string[];
	debugMode: boolean;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: ImageManagerSettings = {
	// General Settings
	enableRenameOnPaste: true,
	enableRenameOnDrop: true,
	imageNameTemplate: '{{fileName}}',
	attachmentLocation: AttachmentLocation.ObsidianDefault,
	customAttachmentPath: './assets',
	
	// Image Services
	defaultProvider: ImageProvider.Unsplash,
	unsplashProxyServer: '',
	pexelsApiKey: '',
	pixabayApiKey: '',
	defaultOrientation: ImageOrientation.Any,
	defaultImageSize: ImageSize.Large,
	
	// Property Insertion
	enablePropertyPaste: true,
	propertyLinkFormat: PropertyLinkFormat.Path,
	customPropertyLinkFormat: '{image-url}',
	defaultPropertyName: '',
	
	// Conversion
	autoConvertRemoteImages: false,
	convertOnNoteOpen: false,
	convertOnNoteSave: false,
	
	// Rename Options
	autoRename: false,
	dupNumberDelimiter: '-',
	dupNumberAtStart: false,
	disableRenameNotice: false,
	enableDescriptiveImages: false,
	
	// Image Insertion Options (from Image Inserter)
	insertSize: '', // Empty = no size specified
	insertReferral: true, // Default to true (attribution)
	insertBackLink: false, // Default to false
	appendReferral: false, // Default to false
	
	// Banner Settings
	banner: { ...DEFAULT_BANNER_SETTINGS },
	
	// Advanced
	supportedExtensions: ['md', 'mdx'],
	debugMode: false,
};

/**
 * Represents an image from a remote provider
 */
export interface RemoteImage {
	id: string;
	provider: ImageProvider;
	thumbnailUrl: string;
	regularUrl: string;
	fullUrl: string;
	downloadUrl: string;
	width: number;
	height: number;
	description?: string;
	author?: string;
	authorUrl?: string;
	pageUrl?: string;
}

/**
 * Result of processing an image
 */
export interface ProcessedImage {
	file: TFile | null;
	path: string;
	linkText: string;
	success: boolean;
	error?: string;
}

/**
 * Image insertion context
 */
export interface InsertionContext {
	isProperty: boolean;
	propertyName?: string;
	cursorPosition?: EditorPosition;
	activeFile: TFile;
}

/**
 * Name template variables
 */
export interface NameTemplateVariables {
	fileName: string;
	dirName: string;
	imageNameKey?: string;
	firstHeading?: string;
	date: string;
	time: string;
	index?: number;
}

// Import types from Obsidian for use in interfaces
import type { TFile, EditorPosition } from 'obsidian';
