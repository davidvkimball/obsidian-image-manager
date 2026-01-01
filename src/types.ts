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
	enableDescriptiveImages: boolean; // Ask for description, use as display text
	
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
