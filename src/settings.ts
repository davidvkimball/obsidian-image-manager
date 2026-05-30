/**
 * Image Manager Plugin Settings
 * Settings tab with SettingGroup compatibility for Obsidian 1.11.0+
 */

import { App, BaseComponent, Platform, PluginSettingTab, requireApiVersion, Setting , SettingGroup} from 'obsidian';

import {
	ImageManagerSettings,
	DEFAULT_SETTINGS,
	mergeBannerSettings,
	ImageProvider,
	ImageOrientation,
	ImageSize,
	PropertyLinkFormat,
	AttachmentLocation,
	DeviceType,
	DEFAULT_BANNER_DEVICE_SETTINGS,
} from './types';
import type ImageManagerPlugin from './main';

/**
 * Interface for SecretComponent accessed via dynamic require
 * SecretComponent is not available in type definitions for all Obsidian versions
 */
interface SecretComponentType {
	new(app: App, el: HTMLElement): BaseComponent & {
		setValue(value: string): void;
		onChange(callback: (value: string) => void): void;
	};
}

export { DEFAULT_SETTINGS, mergeBannerSettings };
export type { ImageManagerSettings };

export class ImageManagerSettingTab extends PluginSettingTab {
	plugin: ImageManagerPlugin;
	public icon = 'lucide-image-down';

	constructor(app: App, plugin: ImageManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// 1.13.0+: framework calls this and skips display().
	// Pre-1.13.0: this method is not invoked; display() below runs as before.
	// See https://docs.obsidian.md/plugins/guides/migrate-declarative-settings
	getSettingDefinitions() {
		const currentDevice = this.getCurrentDevice();
		const defaultDeviceSettings = DEFAULT_BANNER_DEVICE_SETTINGS[currentDevice];

		return [
			// General settings without heading (first section doesn't need a heading)
			{
				type: 'group' as const,
				items: [
					{
						name: 'Image name template',
						desc: 'Template for generated image names. Variables: {{fileName}}, {{dirName}}, {{DATE:YYYY-MM-DD}}, {{TIME:HH-mm-ss}}',
						control: { type: 'text' as const, key: 'imageNameTemplate', placeholder: '{{fileName}}' },
					},
					{
						name: 'Attachment location',
						desc: 'Where to save inserted images',
						control: {
							type: 'dropdown' as const,
							key: 'attachmentLocation',
							options: {
								[AttachmentLocation.ObsidianDefault]: "Use Obsidian's settings",
								[AttachmentLocation.SameFolder]: 'Same folder as note',
								[AttachmentLocation.Subfolder]: 'Subfolder (configure below)',
								[AttachmentLocation.VaultFolder]: 'Vault folder (configure below)',
							},
						},
					},
					{
						name: 'Custom attachment path',
						desc: 'Path for attachments. Use "./" for relative to note, or "/" for vault root.',
						// Shown only when not using the Obsidian default or same-folder location.
						visible: () => this.plugin.settings.attachmentLocation !== AttachmentLocation.ObsidianDefault &&
							this.plugin.settings.attachmentLocation !== AttachmentLocation.SameFolder,
						control: { type: 'text' as const, key: 'customAttachmentPath', placeholder: './assets' },
					},
				],
			},
			{
				type: 'group' as const,
				heading: 'Image services',
				items: [
					{
						name: 'Default provider',
						desc: 'Default image provider for search',
						control: {
							type: 'dropdown' as const,
							key: 'defaultProvider',
							options: {
								[ImageProvider.Unsplash]: 'Unsplash',
								[ImageProvider.Pexels]: 'Pexels',
								[ImageProvider.Pixabay]: 'Pixabay',
								[ImageProvider.Local]: 'Local files',
							},
						},
					},
					{
						name: 'Default orientation',
						desc: 'Filter images by orientation',
						control: {
							type: 'dropdown' as const,
							key: 'defaultOrientation',
							options: {
								[ImageOrientation.Any]: 'Any',
								[ImageOrientation.Landscape]: 'Landscape',
								[ImageOrientation.Portrait]: 'Portrait',
								[ImageOrientation.Square]: 'Square',
							},
						},
					},
					{
						name: 'Default image size',
						desc: 'Preferred size when downloading images',
						control: {
							type: 'dropdown' as const,
							key: 'defaultImageSize',
							options: {
								[ImageSize.Original]: 'Original',
								[ImageSize.Large]: 'Large',
								[ImageSize.Medium]: 'Medium',
								[ImageSize.Small]: 'Small',
							},
						},
					},
					{
						name: 'Unsplash proxy server',
						desc: 'Optional proxy server (leave empty to use built-in)',
						control: { type: 'text' as const, key: 'unsplashProxyServer', placeholder: 'https://your-proxy.com/' },
					},
					{
						name: 'Pexels API key',
						// Version-conditional control: SecretComponent on 1.11.4+, plaintext text otherwise.
						render: (setting: Setting) => {
							if (requireApiVersion('1.11.4')) {
								// Use SecretComponent for newer versions
								setting
									.setDesc('Choose a secret that contains your Pexels API key.')
									.addComponent((el) => {
										// Use dynamic require to access SecretComponent (may not be in type definitions)
										// eslint-disable-next-line @typescript-eslint/no-require-imports -- SecretComponent not in type definitions for all Obsidian versions
										const obsidian = require('obsidian') as { SecretComponent?: SecretComponentType };
										const SecretComponent = obsidian.SecretComponent as SecretComponentType;
										const component = new SecretComponent(this.app, el);
										component.setValue(this.plugin.settings.pexelsApiKeySecretId);
										component.onChange((value: string) => {
											void (async () => {
												this.plugin.settings.pexelsApiKeySecretId = value;
												await this.plugin.saveSettings();
											})();
										});
										return component;
									});
							} else {
								// Fall back to plaintext for older versions
								setting
									.setDesc('Get your API key from https://www.pexels.com/api/new/')
									.addText(text => {
										text
											.setPlaceholder('Pexels API key')
											.setValue(this.plugin.settings.pexelsApiKey)
											.onChange(async value => {
												this.plugin.settings.pexelsApiKey = value;
												await this.plugin.saveSettings();
											});
									});
							}
						},
					},
					{
						name: 'Pixabay API key',
						// Version-conditional control: SecretComponent on 1.11.4+, plaintext text otherwise.
						render: (setting: Setting) => {
							if (requireApiVersion('1.11.4')) {
								// Use SecretComponent for newer versions
								setting
									.setDesc('Choose a secret that contains your Pixabay API key.')
									.addComponent((el) => {
										// Use dynamic require to access SecretComponent (may not be in type definitions)
										// eslint-disable-next-line @typescript-eslint/no-require-imports -- SecretComponent not in type definitions for all Obsidian versions
										const obsidian = require('obsidian') as { SecretComponent?: SecretComponentType };
										const SecretComponent = obsidian.SecretComponent as SecretComponentType;
										const component = new SecretComponent(this.app, el);
										component.setValue(this.plugin.settings.pixabayApiKeySecretId);
										component.onChange((value: string) => {
											void (async () => {
												this.plugin.settings.pixabayApiKeySecretId = value;
												await this.plugin.saveSettings();
											})();
										});
										return component;
									});
							} else {
								// Fall back to plaintext for older versions
								setting
									.setDesc('Get your API key from https://pixabay.com/api/docs/')
									.addText(text => {
										text
											.setPlaceholder('Pixabay API key')
											.setValue(this.plugin.settings.pixabayApiKey)
											.onChange(async value => {
												this.plugin.settings.pixabayApiKey = value;
												await this.plugin.saveSettings();
											});
									});
							}
						},
					},
					{
						name: 'Insert size',
						desc: 'Set the size of the image when inserting. Format could be only the width "200" or the width and height "200x100". Leave empty for no size.',
						control: { type: 'text' as const, key: 'insertSize', placeholder: '200 or 200x100' },
					},
					{
						name: 'Insert referral',
						desc: 'Insert the reference text',
						control: { type: 'toggle' as const, key: 'insertReferral' },
					},
					{
						name: 'Insert backlink',
						desc: 'Insert a backlink in front of the reference text',
						control: { type: 'toggle' as const, key: 'insertBackLink' },
					},
				],
			},
			{
				type: 'group' as const,
				heading: 'Property insertion',
				items: [
					{
						name: 'Enable paste into properties',
						desc: 'Allow pasting images directly into properties',
						control: { type: 'toggle' as const, key: 'enablePropertyPaste' },
					},
					{
						name: 'Property link format',
						desc: 'How to format the image link in properties',
						control: {
							type: 'dropdown' as const,
							key: 'propertyLinkFormat',
							options: {
								[PropertyLinkFormat.ObsidianDefault]: "Use Obsidian's settings",
								[PropertyLinkFormat.Path]: 'Plain path (path/to/image.jpg)',
								[PropertyLinkFormat.RelativePath]: 'Relative path (./image.jpg)',
								[PropertyLinkFormat.Wikilink]: 'Wikilink ([[path/to/image.jpg]])',
								[PropertyLinkFormat.Markdown]: 'Markdown (![](path/to/image.jpg))',
								[PropertyLinkFormat.Custom]: 'Custom format',
							},
						},
					},
					{
						name: 'Custom format template',
						desc: 'Use {image-url} as placeholder for the image path',
						// Shown only when the custom property link format is selected.
						visible: () => this.plugin.settings.propertyLinkFormat === PropertyLinkFormat.Custom,
						control: { type: 'text' as const, key: 'customPropertyLinkFormat', placeholder: '{image-url}' },
					},
					{
						name: 'Default property name',
						desc: 'Default property name when inserting to properties via command',
						control: { type: 'text' as const, key: 'defaultPropertyName', placeholder: 'Banner' },
					},
					{
						name: 'Default icon property name',
						desc: 'Default property name when inserting to icon property via command',
						control: { type: 'text' as const, key: 'defaultIconPropertyName', placeholder: 'Icon' },
					},
					{
						name: 'Alt text property name',
						desc: 'Property name to use for image alt text (description) when inserting to properties. If "Descriptive images" is enabled, this will be filled with the description you provide. If disabled, it will be filled with the search term for external images.',
						control: { type: 'text' as const, key: 'altTextProperty', placeholder: 'alt' },
					},
				],
			},
			{
				type: 'group' as const,
				heading: 'Remote image conversion',
				items: [
					{
						name: 'Auto-convert remote images',
						desc: 'Automatically download and replace remote image urls with local files',
						control: { type: 'toggle' as const, key: 'autoConvertRemoteImages' },
					},
					{
						name: 'Convert on note open',
						desc: 'Process remote images when opening a note',
						// Shown only when auto-conversion is enabled.
						visible: () => this.plugin.settings.autoConvertRemoteImages,
						control: { type: 'toggle' as const, key: 'convertOnNoteOpen' },
					},
					{
						name: 'Convert on note save',
						desc: 'Process remote images when saving a note',
						// Shown only when auto-conversion is enabled.
						visible: () => this.plugin.settings.autoConvertRemoteImages,
						control: { type: 'toggle' as const, key: 'convertOnNoteSave' },
					},
				],
			},
			{
				type: 'group' as const,
				heading: 'Rename options',
				items: [
					{
						name: 'Show image rename dialog automatically',
						desc: 'Handle and rename images when they are added to the vault via paste or drag and drop',
						control: { type: 'toggle' as const, key: 'showRenameDialog' },
					},
					{
						name: 'Rename on paste',
						desc: 'Handle and rename images when pasting into the editor',
						// Shown only when the rename dialog is enabled.
						visible: () => this.plugin.settings.showRenameDialog,
						control: { type: 'toggle' as const, key: 'enableRenameOnPaste' },
					},
					{
						name: 'Rename on drag and drop',
						desc: 'Handle and rename images when dropping into the editor',
						// Shown only when the rename dialog is enabled.
						visible: () => this.plugin.settings.showRenameDialog,
						control: { type: 'toggle' as const, key: 'enableRenameOnDrop' },
					},
					{
						name: 'Process background file changes',
						desc: 'Automatically convert and rename remote images when files are changed in the background (by Git or other plugins). Warning: Turning this on may cause the rename modal to appear for images you\'ve already processed on other devices during a sync.',
						control: { type: 'toggle' as const, key: 'processBackgroundChanges' },
					},
					{
						name: 'Descriptive images',
						desc: 'Ask for image description, use as display text and kebab-case for file name (applies to note body insertions only, not properties)',
						control: { type: 'toggle' as const, key: 'enableDescriptiveImages' },
					},
					{
						name: 'Auto rename',
						desc: 'Automatically rename without showing dialog (uses template)',
						control: { type: 'toggle' as const, key: 'autoRename' },
					},
					{
						name: 'Duplicate number delimiter',
						desc: 'Character(s) between name and number for duplicates (e.g., "-" gives "image-1")',
						control: { type: 'text' as const, key: 'dupNumberDelimiter', placeholder: '-' },
					},
					{
						name: 'Duplicate number at start',
						desc: 'Put the duplicate number at the start ("1-image" instead of "image-1")',
						control: { type: 'toggle' as const, key: 'dupNumberAtStart' },
					},
					{
						name: 'Disable rename notice',
						desc: 'Do not show a notice after renaming an image',
						control: { type: 'toggle' as const, key: 'disableRenameNotice' },
					},
				],
			},
			{
				type: 'group' as const,
				heading: 'Banner images',
				items: [
					// Device-specific enable toggle. Banner settings are nested under
					// settings.banner[device] / settings.banner.properties, so they bind
					// imperatively via render rather than flat control keys. Toggling this
					// shows or hides the rows below, so refresh the DOM state to re-evaluate
					// their visible predicates.
					{
						name: 'Show banner',
						desc: `Enable or disable banners on your ${currentDevice} device`,
						render: (setting: Setting) => {
							setting.addToggle(toggle => {
								toggle
									.setValue(this.plugin.settings.banner[currentDevice].enabled)
									.onChange(async value => {
										this.plugin.settings.banner[currentDevice].enabled = value;
										await this.plugin.saveSettings();
										this.refreshDomStateIfAvailable();
									});
							});
						},
					},
					{
						name: 'Height',
						desc: `Height of the banner on your ${currentDevice} device (in pixels)`,
						visible: () => this.plugin.settings.banner[currentDevice].enabled,
						render: (setting: Setting) => {
							setting.addText(text => {
								text
									.setPlaceholder(String(defaultDeviceSettings.height))
									.setValue(String(this.plugin.settings.banner[currentDevice].height))
									.onChange(async value => {
										const num = parseInt(value, 10);
										if (!isNaN(num) && num > 0) {
											this.plugin.settings.banner[currentDevice].height = num;
											await this.plugin.saveSettings();
										}
									});
							});
						},
					},
					{
						name: 'Padding',
						desc: 'Padding of the banner from the edges of the note (in pixels)',
						visible: () => this.plugin.settings.banner[currentDevice].enabled,
						render: (setting: Setting) => {
							setting.addText(text => {
								text
									.setPlaceholder(String(defaultDeviceSettings.padding))
									.setValue(String(this.plugin.settings.banner[currentDevice].padding))
									.onChange(async value => {
										const num = parseInt(value, 10);
										if (!isNaN(num) && num >= 0) {
											this.plugin.settings.banner[currentDevice].padding = num;
											await this.plugin.saveSettings();
										}
									});
							});
						},
					},
					{
						name: 'Note offset',
						desc: 'Move the position of the note content (in pixels)',
						visible: () => this.plugin.settings.banner[currentDevice].enabled,
						render: (setting: Setting) => {
							setting.addText(text => {
								text
									.setPlaceholder(String(defaultDeviceSettings.noteOffset))
									.setValue(String(this.plugin.settings.banner[currentDevice].noteOffset))
									.onChange(async value => {
										const num = parseInt(value, 10);
										if (!isNaN(num)) {
											this.plugin.settings.banner[currentDevice].noteOffset = num;
											await this.plugin.saveSettings();
										}
									});
							});
						},
					},
					{
						name: 'View offset',
						desc: 'Move the position of the view content (in pixels)',
						visible: () => this.plugin.settings.banner[currentDevice].enabled,
						render: (setting: Setting) => {
							setting.addText(text => {
								text
									.setPlaceholder(String(defaultDeviceSettings.viewOffset))
									.setValue(String(this.plugin.settings.banner[currentDevice].viewOffset))
									.onChange(async value => {
										const num = parseInt(value, 10);
										if (!isNaN(num)) {
											this.plugin.settings.banner[currentDevice].viewOffset = num;
											await this.plugin.saveSettings();
										}
									});
							});
						},
					},
					{
						name: 'Fade',
						desc: 'Fade the image out towards the content',
						visible: () => this.plugin.settings.banner[currentDevice].enabled,
						render: (setting: Setting) => {
							setting.addToggle(toggle => {
								toggle
									.setValue(this.plugin.settings.banner[currentDevice].fade)
									.onChange(async value => {
										this.plugin.settings.banner[currentDevice].fade = value;
										await this.plugin.saveSettings();
									});
							});
						},
					},
					{
						name: 'Rounded corners',
						desc: 'Enable rounded corners for the banner',
						visible: () => this.plugin.settings.banner[currentDevice].enabled,
						render: (setting: Setting) => {
							setting.addToggle(toggle => {
								toggle
									.setValue(this.plugin.settings.banner[currentDevice].bannerRadiusEnabled)
									.onChange(async value => {
										this.plugin.settings.banner[currentDevice].bannerRadiusEnabled = value;
										await this.plugin.saveSettings();
									});
							});
						},
					},
					{
						name: 'Animation',
						desc: 'Enable banner animation when opening files',
						visible: () => this.plugin.settings.banner[currentDevice].enabled,
						render: (setting: Setting) => {
							setting.addToggle(toggle => {
								toggle
									.setValue(this.plugin.settings.banner[currentDevice].animation)
									.onChange(async value => {
										this.plugin.settings.banner[currentDevice].animation = value;
										await this.plugin.saveSettings();
									});
							});
						},
					},
					{
						name: 'Banner property',
						desc: 'Name of the banner property this plugin will look for in the properties',
						visible: () => this.plugin.settings.banner[currentDevice].enabled,
						render: (setting: Setting) => {
							setting.addText(text => {
								text
									.setPlaceholder('Banner')
									.setValue(this.plugin.settings.banner.properties.imageProperty)
									.onChange(async value => {
										this.plugin.settings.banner.properties.imageProperty = value || 'banner';
										await this.plugin.saveSettings();
									});
							});
						},
					},
					{
						name: 'Icon property',
						desc: 'Name of the icon property this plugin will look for in the properties',
						visible: () => this.plugin.settings.banner[currentDevice].enabled,
						render: (setting: Setting) => {
							setting.addText(text => {
								text
									.setPlaceholder('Icon')
									.setValue(this.plugin.settings.banner.properties.iconProperty)
									.onChange(async value => {
										this.plugin.settings.banner.properties.iconProperty = value || 'icon';
										await this.plugin.saveSettings();
									});
							});
						},
					},
					{
						name: 'Enable per-note banner hiding',
						desc: 'Allow disabling banners on a per-note basis using a properties field',
						visible: () => this.plugin.settings.banner[currentDevice].enabled,
						// Toggling this shows or hides the hide-property row below, so refresh
						// the DOM state to re-evaluate its visible predicate.
						render: (setting: Setting) => {
							setting.addToggle(toggle => {
								toggle
									.setValue(this.plugin.settings.banner.properties.hidePropertyEnabled)
									.onChange(async value => {
										this.plugin.settings.banner.properties.hidePropertyEnabled = value;
										await this.plugin.saveSettings();
										this.refreshDomStateIfAvailable();
									});
							});
						},
					},
					{
						name: 'Hide banner property',
						desc: 'Name of the property that, when set to true, will hide the banner for that note',
						visible: () => this.plugin.settings.banner[currentDevice].enabled &&
							this.plugin.settings.banner.properties.hidePropertyEnabled,
						render: (setting: Setting) => {
							setting.addText(text => {
								text
									.setPlaceholder('hideBanner')
									.setValue(this.plugin.settings.banner.properties.hideProperty)
									.onChange(async value => {
										this.plugin.settings.banner.properties.hideProperty = value || '';
										await this.plugin.saveSettings();
									});
							});
						},
					},
					{
						name: 'Show icon',
						desc: 'Enable or disable the icon',
						visible: () => this.plugin.settings.banner[currentDevice].enabled,
						// Toggling this shows or hides the icon rows below, so refresh the DOM
						// state to re-evaluate their visible predicates.
						render: (setting: Setting) => {
							setting.addToggle(toggle => {
								toggle
									.setValue(this.plugin.settings.banner[currentDevice].iconEnabled)
									.onChange(async value => {
										this.plugin.settings.banner[currentDevice].iconEnabled = value;
										await this.plugin.saveSettings();
										this.refreshDomStateIfAvailable();
									});
							});
						},
					},
					{
						name: 'Icon size',
						desc: 'Size of the icon (in pixels)',
						visible: () => this.plugin.settings.banner[currentDevice].enabled &&
							this.plugin.settings.banner[currentDevice].iconEnabled,
						render: (setting: Setting) => {
							setting.addText(text => {
								text
									.setPlaceholder(String(defaultDeviceSettings.iconSize))
									.setValue(String(this.plugin.settings.banner[currentDevice].iconSize))
									.onChange(async value => {
										const num = parseInt(value, 10);
										if (!isNaN(num) && num > 0) {
											this.plugin.settings.banner[currentDevice].iconSize = num;
											await this.plugin.saveSettings();
										}
									});
							});
						},
					},
					{
						name: 'Icon background',
						desc: 'Enable or disable the icon background',
						visible: () => this.plugin.settings.banner[currentDevice].enabled &&
							this.plugin.settings.banner[currentDevice].iconEnabled,
						render: (setting: Setting) => {
							setting.addToggle(toggle => {
								toggle
									.setValue(this.plugin.settings.banner[currentDevice].iconBackground)
									.onChange(async value => {
										this.plugin.settings.banner[currentDevice].iconBackground = value;
										await this.plugin.saveSettings();
									});
							});
						},
					},
					{
						name: 'Icon frame',
						desc: 'Show the border/background frame around the icon (disable to display just the icon graphic)',
						visible: () => this.plugin.settings.banner[currentDevice].enabled &&
							this.plugin.settings.banner[currentDevice].iconEnabled,
						render: (setting: Setting) => {
							setting.addToggle(toggle => {
								toggle
									.setValue(this.plugin.settings.banner[currentDevice].iconFrame)
									.onChange(async value => {
										this.plugin.settings.banner[currentDevice].iconFrame = value;
										await this.plugin.saveSettings();
									});
							});
						},
					},
					{
						name: 'Icon border size',
						desc: 'Size of the icon border (in pixels)',
						visible: () => this.plugin.settings.banner[currentDevice].enabled &&
							this.plugin.settings.banner[currentDevice].iconEnabled,
						render: (setting: Setting) => {
							setting.addText(text => {
								text
									.setPlaceholder(String(defaultDeviceSettings.iconBorder))
									.setValue(String(this.plugin.settings.banner[currentDevice].iconBorder))
									.onChange(async value => {
										const num = parseInt(value, 10);
										if (!isNaN(num) && num >= 0) {
											this.plugin.settings.banner[currentDevice].iconBorder = num;
											await this.plugin.saveSettings();
										}
									});
							});
						},
					},
					{
						name: 'Icon border radius',
						desc: 'Size of the icon border radius (in pixels)',
						visible: () => this.plugin.settings.banner[currentDevice].enabled &&
							this.plugin.settings.banner[currentDevice].iconEnabled,
						render: (setting: Setting) => {
							setting.addText(text => {
								text
									.setPlaceholder(String(defaultDeviceSettings.iconRadius))
									.setValue(String(this.plugin.settings.banner[currentDevice].iconRadius))
									.onChange(async value => {
										const num = parseInt(value, 10);
										if (!isNaN(num) && num >= 0) {
											this.plugin.settings.banner[currentDevice].iconRadius = num;
											await this.plugin.saveSettings();
										}
									});
							});
						},
					},
					{
						name: 'Icon alignment - horizontal',
						desc: 'Horizontal alignment of the icon',
						visible: () => this.plugin.settings.banner[currentDevice].enabled &&
							this.plugin.settings.banner[currentDevice].iconEnabled,
						render: (setting: Setting) => {
							setting.addDropdown(dropdown => {
								dropdown
									.addOption('flex-start', 'Left')
									.addOption('center', 'Center')
									.addOption('flex-end', 'Right')
									.setValue(this.plugin.settings.banner[currentDevice].iconAlignmentH)
									.onChange(async value => {
										this.plugin.settings.banner[currentDevice].iconAlignmentH = value as 'flex-start' | 'center' | 'flex-end';
										await this.plugin.saveSettings();
									});
							});
						},
					},
					{
						name: 'Icon alignment - vertical',
						desc: 'Vertical alignment of the icon',
						visible: () => this.plugin.settings.banner[currentDevice].enabled &&
							this.plugin.settings.banner[currentDevice].iconEnabled,
						render: (setting: Setting) => {
							setting.addDropdown(dropdown => {
								dropdown
									.addOption('flex-start', 'Top')
									.addOption('center', 'Center')
									.addOption('flex-end', 'Bottom')
									.setValue(this.plugin.settings.banner[currentDevice].iconAlignmentV)
									.onChange(async value => {
										this.plugin.settings.banner[currentDevice].iconAlignmentV = value as 'flex-start' | 'center' | 'flex-end';
										await this.plugin.saveSettings();
									});
							});
						},
					},
				],
			},
			{
				type: 'group' as const,
				heading: 'Advanced',
				items: [
					{
						name: 'Supported file extensions',
						desc: 'File extensions to process (comma-separated)',
						// Stored as a string array but edited as a comma-separated string with
						// normalization and an empty-input fallback, so this binds imperatively.
						render: (setting: Setting) => {
							setting.addText(text => {
								const currentValue = this.plugin.settings.supportedExtensions.length > 0
									? this.plugin.settings.supportedExtensions.join(', ')
									: '';
								text
									.setPlaceholder('File extensions')
									.setValue(currentValue)
									.onChange(async value => {
										const extensions = value
											.split(',')
											.map((ext) => ext.trim().toLowerCase())
											.filter((ext) => ext.length > 0);
										// Default to 'md' if empty
										this.plugin.settings.supportedExtensions = extensions.length > 0 ? extensions : ['md'];
										await this.plugin.saveSettings();
									});
							});
						},
					},
					{
						name: 'Debug mode',
						desc: 'Enable debug logging to console',
						control: { type: 'toggle' as const, key: 'debugMode' },
					},
				],
			},
		];
	}

	// Override the framework's default setControlValue (which only calls saveData)
	// so that every change runs the plugin's saveSettings() — which also notifies
	// all services of the settings change via the settings observable. Without this
	// override, services would not be notified on setting change on Obsidian 1.13.0+.
	// (On older versions this method is unused; display() already calls saveSettings()
	// in its onChange handlers.)
	async setControlValue(key: string, value: unknown): Promise<void> {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		await this.plugin.saveSettings();
	}

	// Re-run the visible predicates so dependent rows appear or disappear after a
	// render callback mutates state. refreshDomState exists on Obsidian 1.13.0+,
	// which is the only version that calls getSettingDefinitions in the first place.
	private refreshDomStateIfAvailable(): void {
		const refresh = (this as unknown as { refreshDomState?: () => void }).refreshDomState;
		if (refresh) refresh.call(this);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// General Settings
		this.renderGeneralSettings(containerEl);

		// Image Services
		this.renderImageServicesSettings(containerEl);

		// Property Insertion
		this.renderPropertySettings(containerEl);

		// Conversion
		this.renderConversionSettings(containerEl);

		// Rename Options
		this.renderRenameSettings(containerEl);

		// Banner Images
		this.renderBannerSettings(containerEl);

		// Advanced
		this.renderAdvancedSettings(containerEl);
	}

	private renderGeneralSettings(containerEl: HTMLElement): void {
		// General settings without heading (first section doesn't need a heading)
		const group = new SettingGroup(containerEl);

		group.addSetting(setting => {
			setting
				.setName('Image name template')
				.setDesc('Template for generated image names. Variables: {{fileName}}, {{dirName}}, {{DATE:YYYY-MM-DD}}, {{TIME:HH-mm-ss}}')
				.addText(text => {
					text
						.setPlaceholder('{{fileName}}')
						.setValue(this.plugin.settings.imageNameTemplate)
						.onChange(async value => {
							this.plugin.settings.imageNameTemplate = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Attachment location')
				.setDesc('Where to save inserted images')
				.addDropdown(dropdown => {
					dropdown
						.addOption(AttachmentLocation.ObsidianDefault, "Use Obsidian's settings")
						.addOption(AttachmentLocation.SameFolder, 'Same folder as note')
						.addOption(AttachmentLocation.Subfolder, 'Subfolder (configure below)')
						.addOption(AttachmentLocation.VaultFolder, 'Vault folder (configure below)')
						.setValue(this.plugin.settings.attachmentLocation)
						.onChange(async value => {
							this.plugin.settings.attachmentLocation = value as AttachmentLocation;
							await this.plugin.saveSettings();

							// Preserve scroll position when re-rendering
							const scrollContainer = containerEl.closest('.vertical-tab-content') ||
								containerEl.closest('.settings-content') ||
								containerEl.parentElement;
							const scrollTop = scrollContainer?.scrollTop || 0;

							this.display(); // Refresh to show/hide path input

							// Restore scroll position after rendering
							window.requestAnimationFrame(() => {
								if (scrollContainer) {
									scrollContainer.scrollTop = scrollTop;
								}
							});
						});
				});
		});

		// Show custom path input if not using Obsidian default
		if (this.plugin.settings.attachmentLocation !== AttachmentLocation.ObsidianDefault &&
			this.plugin.settings.attachmentLocation !== AttachmentLocation.SameFolder) {
			group.addSetting(setting => {
				setting
					.setName('Custom attachment path')
					.setDesc('Path for attachments. Use "./" for relative to note, or "/" for vault root.')
					.addText(text => {
						text
							.setPlaceholder('./assets')
							.setValue(this.plugin.settings.customAttachmentPath)
							.onChange(async value => {
								this.plugin.settings.customAttachmentPath = value;
								await this.plugin.saveSettings();
							});
					});
			});
		}
	}

	private renderImageServicesSettings(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl).setHeading('Image services');

		group.addSetting(setting => {
			setting
				.setName('Default provider')
				.setDesc('Default image provider for search')
				.addDropdown(dropdown => {
					dropdown
						.addOption(ImageProvider.Unsplash, 'Unsplash')
						.addOption(ImageProvider.Pexels, 'Pexels')
						.addOption(ImageProvider.Pixabay, 'Pixabay')
						.addOption(ImageProvider.Local, 'Local files')
						.setValue(this.plugin.settings.defaultProvider)
						.onChange(async value => {
							this.plugin.settings.defaultProvider = value as ImageProvider;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Default orientation')
				.setDesc('Filter images by orientation')
				.addDropdown(dropdown => {
					dropdown
						.addOption(ImageOrientation.Any, 'Any')
						.addOption(ImageOrientation.Landscape, 'Landscape')
						.addOption(ImageOrientation.Portrait, 'Portrait')
						.addOption(ImageOrientation.Square, 'Square')
						.setValue(this.plugin.settings.defaultOrientation)
						.onChange(async value => {
							this.plugin.settings.defaultOrientation = value as ImageOrientation;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Default image size')
				.setDesc('Preferred size when downloading images')
				.addDropdown(dropdown => {
					dropdown
						.addOption(ImageSize.Original, 'Original')
						.addOption(ImageSize.Large, 'Large')
						.addOption(ImageSize.Medium, 'Medium')
						.addOption(ImageSize.Small, 'Small')
						.setValue(this.plugin.settings.defaultImageSize)
						.onChange(async value => {
							this.plugin.settings.defaultImageSize = value as ImageSize;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Unsplash proxy server')
				.setDesc('Optional proxy server (leave empty to use built-in)')
				.addText(text => {
					text
						.setPlaceholder('https://your-proxy.com/')
						.setValue(this.plugin.settings.unsplashProxyServer)
						.onChange(async value => {
							this.plugin.settings.unsplashProxyServer = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting.setName('Pexels API key');

			if (requireApiVersion('1.11.4')) {
				// Use SecretComponent for newer versions
				setting
					.setDesc('Choose a secret that contains your Pexels API key.')
					.addComponent((el) => {
						// Use dynamic require to access SecretComponent (may not be in type definitions)
						// eslint-disable-next-line @typescript-eslint/no-require-imports -- SecretComponent not in type definitions for all Obsidian versions
						const obsidian = require('obsidian') as { SecretComponent?: SecretComponentType };
						const SecretComponent = obsidian.SecretComponent as SecretComponentType;
						const component = new SecretComponent(this.app, el);
						component.setValue(this.plugin.settings.pexelsApiKeySecretId);
						component.onChange((value: string) => {
							void (async () => {
								this.plugin.settings.pexelsApiKeySecretId = value;
								await this.plugin.saveSettings();
							})();
						});
						return component;
					});
			} else {
				// Fall back to plaintext for older versions
				setting
					.setDesc('Get your API key from https://www.pexels.com/api/new/')
					.addText(text => {
						text
							.setPlaceholder('Pexels API key')
							.setValue(this.plugin.settings.pexelsApiKey)
							.onChange(async value => {
								this.plugin.settings.pexelsApiKey = value;
								await this.plugin.saveSettings();
							});
					});
			}
		});

		group.addSetting(setting => {
			setting.setName('Pixabay API key');

			if (requireApiVersion('1.11.4')) {
				// Use SecretComponent for newer versions
				setting
					.setDesc('Choose a secret that contains your Pixabay API key.')
					.addComponent((el) => {
						// Use dynamic require to access SecretComponent (may not be in type definitions)
						// eslint-disable-next-line @typescript-eslint/no-require-imports -- SecretComponent not in type definitions for all Obsidian versions
						const obsidian = require('obsidian') as { SecretComponent?: SecretComponentType };
						const SecretComponent = obsidian.SecretComponent as SecretComponentType;
						const component = new SecretComponent(this.app, el);
						component.setValue(this.plugin.settings.pixabayApiKeySecretId);
						component.onChange((value: string) => {
							void (async () => {
								this.plugin.settings.pixabayApiKeySecretId = value;
								await this.plugin.saveSettings();
							})();
						});
						return component;
					});
			} else {
				// Fall back to plaintext for older versions
				setting
					.setDesc('Get your API key from https://pixabay.com/api/docs/')
					.addText(text => {
						text
							.setPlaceholder('Pixabay API key')
							.setValue(this.plugin.settings.pixabayApiKey)
							.onChange(async value => {
								this.plugin.settings.pixabayApiKey = value;
								await this.plugin.saveSettings();
							});
					});
			}
		});

		group.addSetting(setting => {
			setting
				.setName('Insert size')
				.setDesc('Set the size of the image when inserting. Format could be only the width "200" or the width and height "200x100". Leave empty for no size.')
				.addText(text => {
					text
						.setPlaceholder('200 or 200x100')
						.setValue(this.plugin.settings.insertSize)
						.onChange(async value => {
							this.plugin.settings.insertSize = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Insert referral')
				.setDesc('Insert the reference text')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.insertReferral)
						.onChange(async value => {
							this.plugin.settings.insertReferral = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Insert backlink')
				.setDesc('Insert a backlink in front of the reference text')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.insertBackLink)
						.onChange(async value => {
							this.plugin.settings.insertBackLink = value;
							await this.plugin.saveSettings();
						});
				});
		});
	}

	private renderPropertySettings(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl).setHeading('Property insertion');

		group.addSetting(setting => {
			setting
				.setName('Enable paste into properties')
				.setDesc('Allow pasting images directly into properties')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.enablePropertyPaste)
						.onChange(async value => {
							this.plugin.settings.enablePropertyPaste = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Property link format')
				.setDesc('How to format the image link in properties')
				.addDropdown(dropdown => {
					dropdown
						.addOption(PropertyLinkFormat.ObsidianDefault, "Use Obsidian's settings")
						.addOption(PropertyLinkFormat.Path, 'Plain path (path/to/image.jpg)')
						.addOption(PropertyLinkFormat.RelativePath, 'Relative path (./image.jpg)')
						.addOption(PropertyLinkFormat.Wikilink, 'Wikilink ([[path/to/image.jpg]])')
						.addOption(PropertyLinkFormat.Markdown, 'Markdown (![](path/to/image.jpg))')
						.addOption(PropertyLinkFormat.Custom, 'Custom format')
						.setValue(this.plugin.settings.propertyLinkFormat)
						.onChange(async value => {
							this.plugin.settings.propertyLinkFormat = value as PropertyLinkFormat;
							await this.plugin.saveSettings();

							// Preserve scroll position when re-rendering
							const scrollContainer = containerEl.closest('.vertical-tab-content') ||
								containerEl.closest('.settings-content') ||
								containerEl.parentElement;
							const scrollTop = scrollContainer?.scrollTop || 0;

							this.display(); // Refresh to show/hide custom format input

							// Restore scroll position after rendering
							window.requestAnimationFrame(() => {
								if (scrollContainer) {
									scrollContainer.scrollTop = scrollTop;
								}
							});
						});
				});
		});

		// Show custom format input when "Custom" is selected
		if (this.plugin.settings.propertyLinkFormat === PropertyLinkFormat.Custom) {
			group.addSetting(setting => {
				setting
					.setName('Custom format template')
					.setDesc('Use {image-url} as placeholder for the image path')
					.addText(text => {
						text
							.setPlaceholder('{image-url}')
							.setValue(this.plugin.settings.customPropertyLinkFormat)
							.onChange(async value => {
								this.plugin.settings.customPropertyLinkFormat = value;
								await this.plugin.saveSettings();
							});
					});
			});
		}

		group.addSetting(setting => {
			setting
				.setName('Default property name')
				.setDesc('Default property name when inserting to properties via command')
				.addText(text => {
					text
						.setPlaceholder('Banner')
						.setValue(this.plugin.settings.defaultPropertyName)
						.onChange(async value => {
							this.plugin.settings.defaultPropertyName = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Default icon property name')
				.setDesc('Default property name when inserting to icon property via command')
				.addText(text => {
					text
						.setPlaceholder('Icon')
						.setValue(this.plugin.settings.defaultIconPropertyName)
						.onChange(async value => {
							this.plugin.settings.defaultIconPropertyName = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Alt text property name')
				.setDesc('Property name to use for image alt text (description) when inserting to properties. If "Descriptive images" is enabled, this will be filled with the description you provide. If disabled, it will be filled with the search term for external images.')
				.addText(text => {
					text
						.setPlaceholder('alt')
						.setValue(this.plugin.settings.altTextProperty)
						.onChange(async value => {
							this.plugin.settings.altTextProperty = value;
							await this.plugin.saveSettings();
						});
				});
		});
	}

	private renderConversionSettings(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl).setHeading('Remote image conversion');

		group.addSetting(setting => {
			setting
				.setName('Auto-convert remote images')
				.setDesc('Automatically download and replace remote image urls with local files')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.autoConvertRemoteImages)
						.onChange(async value => {
							this.plugin.settings.autoConvertRemoteImages = value;
							await this.plugin.saveSettings();

							// Preserve scroll position when re-rendering
							const scrollContainer = containerEl.closest('.vertical-tab-content') ||
								containerEl.closest('.settings-content') ||
								containerEl.parentElement;
							const scrollTop = scrollContainer?.scrollTop || 0;

							this.display(); // Refresh to show/hide sub-options

							// Restore scroll position after rendering
							window.requestAnimationFrame(() => {
								if (scrollContainer) {
									scrollContainer.scrollTop = scrollTop;
								}
							});
						});
				});
		});

		if (this.plugin.settings.autoConvertRemoteImages) {
			group.addSetting(setting => {
				setting
					.setName('Convert on note open')
					.setDesc('Process remote images when opening a note')
					.addToggle(toggle => {
						toggle
							.setValue(this.plugin.settings.convertOnNoteOpen)
							.onChange(async value => {
								this.plugin.settings.convertOnNoteOpen = value;
								await this.plugin.saveSettings();
							});
					});
			});

			group.addSetting(setting => {
				setting
					.setName('Convert on note save')
					.setDesc('Process remote images when saving a note')
					.addToggle(toggle => {
						toggle
							.setValue(this.plugin.settings.convertOnNoteSave)
							.onChange(async value => {
								this.plugin.settings.convertOnNoteSave = value;
								await this.plugin.saveSettings();
							});
					});
			});
		}
	}

	private renderRenameSettings(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl).setHeading('Rename options');

		group.addSetting(setting => {
			setting
				.setName('Show image rename dialog automatically')
				.setDesc('Handle and rename images when they are added to the vault via paste or drag and drop')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.showRenameDialog)
						.onChange(async value => {
							this.plugin.settings.showRenameDialog = value;
							await this.plugin.saveSettings();
							this.refreshWithScrollPreserve(containerEl);
						});
				});
		});

		if (this.plugin.settings.showRenameDialog) {
			group.addSetting(setting => {
				setting
					.setName('Rename on paste')
					.setDesc('Handle and rename images when pasting into the editor')
					.addToggle(toggle => {
						toggle
							.setValue(this.plugin.settings.enableRenameOnPaste)
							.onChange(async value => {
								this.plugin.settings.enableRenameOnPaste = value;
								await this.plugin.saveSettings();
							});
					});
			});

			group.addSetting(setting => {
				setting
					.setName('Rename on drag and drop')
					.setDesc('Handle and rename images when dropping into the editor')
					.addToggle(toggle => {
						toggle
							.setValue(this.plugin.settings.enableRenameOnDrop)
							.onChange(async value => {
								this.plugin.settings.enableRenameOnDrop = value;
								await this.plugin.saveSettings();
							});
					});
			});
		}

		group.addSetting(setting => {
			setting
				.setName('Process background file changes')
				.setDesc('Automatically convert and rename remote images when files are changed in the background (by Git or other plugins). Warning: Turning this on may cause the rename modal to appear for images you\'ve already processed on other devices during a sync.')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.processBackgroundChanges)
						.onChange(async value => {
							this.plugin.settings.processBackgroundChanges = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Descriptive images')
				.setDesc('Ask for image description, use as display text and kebab-case for file name (applies to note body insertions only, not properties)')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.enableDescriptiveImages)
						.onChange(async value => {
							this.plugin.settings.enableDescriptiveImages = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Auto rename')
				.setDesc('Automatically rename without showing dialog (uses template)')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.autoRename)
						.onChange(async value => {
							this.plugin.settings.autoRename = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Duplicate number delimiter')
				.setDesc('Character(s) between name and number for duplicates (e.g., "-" gives "image-1")')
				.addText(text => {
					text
						.setPlaceholder('-')
						.setValue(this.plugin.settings.dupNumberDelimiter)
						.onChange(async value => {
							this.plugin.settings.dupNumberDelimiter = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Duplicate number at start')
				.setDesc('Put the duplicate number at the start ("1-image" instead of "image-1")')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.dupNumberAtStart)
						.onChange(async value => {
							this.plugin.settings.dupNumberAtStart = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Disable rename notice')
				.setDesc('Do not show a notice after renaming an image')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.disableRenameNotice)
						.onChange(async value => {
							this.plugin.settings.disableRenameNotice = value;
							await this.plugin.saveSettings();
						});
				});
		});
	}

	/**
	 * Get the current device type
	 */
	private getCurrentDevice(): DeviceType {
		if (Platform.isPhone) {
			return DeviceType.Phone;
		}
		if (Platform.isTablet) {
			return DeviceType.Tablet;
		}
		return DeviceType.Desktop;
	}

	/**
	 * Helper to preserve scroll position when re-rendering settings
	 */
	private refreshWithScrollPreserve(containerEl: HTMLElement): void {
		const scrollContainer = containerEl.closest('.vertical-tab-content') ||
			containerEl.closest('.settings-content') ||
			containerEl.parentElement;
		const scrollTop = scrollContainer?.scrollTop || 0;

		this.display();

		window.requestAnimationFrame(() => {
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollTop;
			}
		});
	}

	private renderBannerSettings(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl).setHeading('Banner images');
		const currentDevice = this.getCurrentDevice();
		const deviceSettings = this.plugin.settings.banner[currentDevice];
		const defaultDeviceSettings = DEFAULT_BANNER_DEVICE_SETTINGS[currentDevice];
		const propertySettings = this.plugin.settings.banner.properties;

		// Device-specific enable toggle
		group.addSetting(setting => {
			setting
				.setName('Show banner')
				.setDesc(`Enable or disable banners on your ${currentDevice} device`)
				.addToggle(toggle => {
					toggle
						.setValue(deviceSettings.enabled)
						.onChange(async value => {
							this.plugin.settings.banner[currentDevice].enabled = value;
							await this.plugin.saveSettings();
							this.refreshWithScrollPreserve(containerEl);
						});
				});
		});

		// Only show other settings if enabled
		if (!deviceSettings.enabled) {
			return;
		}

		// Banner height
		group.addSetting(setting => {
			setting
				.setName('Height')
				.setDesc(`Height of the banner on your ${currentDevice} device (in pixels)`)
				.addText(text => {
					text
						.setPlaceholder(String(defaultDeviceSettings.height))
						.setValue(String(deviceSettings.height))
						.onChange(async value => {
							const num = parseInt(value, 10);
							if (!isNaN(num) && num > 0) {
								this.plugin.settings.banner[currentDevice].height = num;
								await this.plugin.saveSettings();
							}
						});
				});
		});

		// Banner padding
		group.addSetting(setting => {
			setting
				.setName('Padding')
				.setDesc('Padding of the banner from the edges of the note (in pixels)')
				.addText(text => {
					text
						.setPlaceholder(String(defaultDeviceSettings.padding))
						.setValue(String(deviceSettings.padding))
						.onChange(async value => {
							const num = parseInt(value, 10);
							if (!isNaN(num) && num >= 0) {
								this.plugin.settings.banner[currentDevice].padding = num;
								await this.plugin.saveSettings();
							}
						});
				});
		});

		// Note offset
		group.addSetting(setting => {
			setting
				.setName('Note offset')
				.setDesc('Move the position of the note content (in pixels)')
				.addText(text => {
					text
						.setPlaceholder(String(defaultDeviceSettings.noteOffset))
						.setValue(String(deviceSettings.noteOffset))
						.onChange(async value => {
							const num = parseInt(value, 10);
							if (!isNaN(num)) {
								this.plugin.settings.banner[currentDevice].noteOffset = num;
								await this.plugin.saveSettings();
							}
						});
				});
		});

		// View offset
		group.addSetting(setting => {
			setting
				.setName('View offset')
				.setDesc('Move the position of the view content (in pixels)')
				.addText(text => {
					text
						.setPlaceholder(String(defaultDeviceSettings.viewOffset))
						.setValue(String(deviceSettings.viewOffset))
						.onChange(async value => {
							const num = parseInt(value, 10);
							if (!isNaN(num)) {
								this.plugin.settings.banner[currentDevice].viewOffset = num;
								await this.plugin.saveSettings();
							}
						});
				});
		});

		// Fade
		group.addSetting(setting => {
			setting
				.setName('Fade')
				.setDesc('Fade the image out towards the content')
				.addToggle(toggle => {
					toggle
						.setValue(deviceSettings.fade)
						.onChange(async value => {
							this.plugin.settings.banner[currentDevice].fade = value;
							await this.plugin.saveSettings();
						});
				});
		});

		// Rounded corners
		group.addSetting(setting => {
			setting
				.setName('Rounded corners')
				.setDesc('Enable rounded corners for the banner')
				.addToggle(toggle => {
					toggle
						.setValue(deviceSettings.bannerRadiusEnabled)
						.onChange(async value => {
							this.plugin.settings.banner[currentDevice].bannerRadiusEnabled = value;
							await this.plugin.saveSettings();
						});
				});
		});

		// Animation
		group.addSetting(setting => {
			setting
				.setName('Animation')
				.setDesc('Enable banner animation when opening files')
				.addToggle(toggle => {
					toggle
						.setValue(deviceSettings.animation)
						.onChange(async value => {
							this.plugin.settings.banner[currentDevice].animation = value;
							await this.plugin.saveSettings();
						});
				});
		});

		// Frontmatter property settings (global, not device-specific)
		group.addSetting(setting => {
			setting
				.setName('Banner property')
				.setDesc('Name of the banner property this plugin will look for in the properties')
				.addText(text => {
					text
						.setPlaceholder('Banner')
						.setValue(propertySettings.imageProperty)
						.onChange(async value => {
							this.plugin.settings.banner.properties.imageProperty = value || 'banner';
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Icon property')
				.setDesc('Name of the icon property this plugin will look for in the properties')
				.addText(text => {
					text
						.setPlaceholder('Icon')
						.setValue(propertySettings.iconProperty)
						.onChange(async value => {
							this.plugin.settings.banner.properties.iconProperty = value || 'icon';
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Enable per-note banner hiding')
				.setDesc('Allow disabling banners on a per-note basis using a properties field')
				.addToggle(toggle => {
					toggle
						.setValue(propertySettings.hidePropertyEnabled)
						.onChange(async value => {
							this.plugin.settings.banner.properties.hidePropertyEnabled = value;
							await this.plugin.saveSettings();
							this.refreshWithScrollPreserve(containerEl);
						});
				});
		});

		// Show hide property input when enabled
		if (propertySettings.hidePropertyEnabled) {
			group.addSetting(setting => {
				setting
					.setName('Hide banner property')
					.setDesc('Name of the property that, when set to true, will hide the banner for that note')
					.addText(text => {
						text
							.setPlaceholder('hideBanner')
							.setValue(propertySettings.hideProperty)
							.onChange(async value => {
								this.plugin.settings.banner.properties.hideProperty = value || '';
								await this.plugin.saveSettings();
							});
					});
			});
		}

		// Icon settings
		group.addSetting(setting => {
			setting
				.setName('Show icon')
				.setDesc('Enable or disable the icon')
				.addToggle(toggle => {
					toggle
						.setValue(deviceSettings.iconEnabled)
						.onChange(async value => {
							this.plugin.settings.banner[currentDevice].iconEnabled = value;
							await this.plugin.saveSettings();
							this.refreshWithScrollPreserve(containerEl);
						});
				});
		});

		// Only show icon settings if enabled
		if (deviceSettings.iconEnabled) {
			group.addSetting(setting => {
				setting
					.setName('Icon size')
					.setDesc('Size of the icon (in pixels)')
					.addText(text => {
						text
							.setPlaceholder(String(defaultDeviceSettings.iconSize))
							.setValue(String(deviceSettings.iconSize))
							.onChange(async value => {
								const num = parseInt(value, 10);
								if (!isNaN(num) && num > 0) {
									this.plugin.settings.banner[currentDevice].iconSize = num;
									await this.plugin.saveSettings();
								}
							});
					});
			});

			group.addSetting(setting => {
				setting
					.setName('Icon background')
					.setDesc('Enable or disable the icon background')
					.addToggle(toggle => {
						toggle
							.setValue(deviceSettings.iconBackground)
							.onChange(async value => {
								this.plugin.settings.banner[currentDevice].iconBackground = value;
								await this.plugin.saveSettings();
							});
					});
			});

			group.addSetting(setting => {
				setting
					.setName('Icon frame')
					.setDesc('Show the border/background frame around the icon (disable to display just the icon graphic)')
					.addToggle(toggle => {
						toggle
							.setValue(deviceSettings.iconFrame)
							.onChange(async value => {
								this.plugin.settings.banner[currentDevice].iconFrame = value;
								await this.plugin.saveSettings();
							});
					});
			});

			group.addSetting(setting => {
				setting
					.setName('Icon border size')
					.setDesc('Size of the icon border (in pixels)')
					.addText(text => {
						text
							.setPlaceholder(String(defaultDeviceSettings.iconBorder))
							.setValue(String(deviceSettings.iconBorder))
							.onChange(async value => {
								const num = parseInt(value, 10);
								if (!isNaN(num) && num >= 0) {
									this.plugin.settings.banner[currentDevice].iconBorder = num;
									await this.plugin.saveSettings();
								}
							});
					});
			});

			group.addSetting(setting => {
				setting
					.setName('Icon border radius')
					.setDesc('Size of the icon border radius (in pixels)')
					.addText(text => {
						text
							.setPlaceholder(String(defaultDeviceSettings.iconRadius))
							.setValue(String(deviceSettings.iconRadius))
							.onChange(async value => {
								const num = parseInt(value, 10);
								if (!isNaN(num) && num >= 0) {
									this.plugin.settings.banner[currentDevice].iconRadius = num;
									await this.plugin.saveSettings();
								}
							});
					});
			});

			group.addSetting(setting => {
				setting
					.setName('Icon alignment - horizontal')
					.setDesc('Horizontal alignment of the icon')
					.addDropdown(dropdown => {
						dropdown
							.addOption('flex-start', 'Left')
							.addOption('center', 'Center')
							.addOption('flex-end', 'Right')
							.setValue(deviceSettings.iconAlignmentH)
							.onChange(async value => {
								this.plugin.settings.banner[currentDevice].iconAlignmentH = value as 'flex-start' | 'center' | 'flex-end';
								await this.plugin.saveSettings();
							});
					});
			});

			group.addSetting(setting => {
				setting
					.setName('Icon alignment - vertical')
					.setDesc('Vertical alignment of the icon')
					.addDropdown(dropdown => {
						dropdown
							.addOption('flex-start', 'Top')
							.addOption('center', 'Center')
							.addOption('flex-end', 'Bottom')
							.setValue(deviceSettings.iconAlignmentV)
							.onChange(async value => {
								this.plugin.settings.banner[currentDevice].iconAlignmentV = value as 'flex-start' | 'center' | 'flex-end';
								await this.plugin.saveSettings();
							});
					});
			});
		}
	}

	private renderAdvancedSettings(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl).setHeading('Advanced');

		group.addSetting(setting => {
			setting
				.setName('Supported file extensions')
				.setDesc('File extensions to process (comma-separated)')
				.addText(text => {
					const currentValue = this.plugin.settings.supportedExtensions.length > 0
						? this.plugin.settings.supportedExtensions.join(', ')
						: '';
					text
						.setPlaceholder('File extensions')
						.setValue(currentValue)
						.onChange(async value => {
							const extensions = value
								.split(',')
								.map((ext) => ext.trim().toLowerCase())
								.filter((ext) => ext.length > 0);
							// Default to 'md' if empty
							this.plugin.settings.supportedExtensions = extensions.length > 0 ? extensions : ['md'];
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting(setting => {
			setting
				.setName('Debug mode')
				.setDesc('Enable debug logging to console')
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.debugMode)
						.onChange(async value => {
							this.plugin.settings.debugMode = value;
							await this.plugin.saveSettings();
						});
				});
		});
	}
}
