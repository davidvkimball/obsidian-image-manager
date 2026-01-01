/**
 * Image Manager Plugin Settings
 * Settings tab with SettingGroup compatibility for Obsidian 1.11.0+
 */

import { App, PluginSettingTab } from 'obsidian';
import { createSettingsGroup } from './utils/settings-compat';
import {
	ImageManagerSettings,
	DEFAULT_SETTINGS,
	ImageProvider,
	ImageOrientation,
	ImageSize,
	PropertyLinkFormat,
	AttachmentLocation,
} from './types';
import type ImageManagerPlugin from './main';

export { DEFAULT_SETTINGS };
export type { ImageManagerSettings };

export class ImageManagerSettingTab extends PluginSettingTab {
	plugin: ImageManagerPlugin;

	constructor(app: App, plugin: ImageManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
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

		// Advanced
		this.renderAdvancedSettings(containerEl);
	}

	private renderGeneralSettings(containerEl: HTMLElement): void {
		// General settings without heading (first section doesn't need a heading)
		const group = createSettingsGroup(containerEl);

		group.addSetting((setting) => {
			setting
				.setName('Enable rename on paste')
				.setDesc('Show rename dialog when pasting images')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.enableRenameOnPaste)
						.onChange(async (value) => {
							this.plugin.settings.enableRenameOnPaste = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Enable rename on drag and drop')
				.setDesc('Show rename dialog when dropping images')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.enableRenameOnDrop)
						.onChange(async (value) => {
							this.plugin.settings.enableRenameOnDrop = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Image name template')
				.setDesc('Template for generated image names. Variables: {{fileName}}, {{dirName}}, {{DATE:YYYY-MM-DD}}, {{TIME:HH-mm-ss}}')
				.addText((text) => {
					text
						.setPlaceholder('{{fileName}}')
						.setValue(this.plugin.settings.imageNameTemplate)
						.onChange(async (value) => {
							this.plugin.settings.imageNameTemplate = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Attachment location')
				.setDesc('Where to save inserted images')
				.addDropdown((dropdown) => {
					dropdown
						.addOption(AttachmentLocation.ObsidianDefault, "Use Obsidian's settings")
						.addOption(AttachmentLocation.SameFolder, 'Same folder as note')
						.addOption(AttachmentLocation.Subfolder, 'Subfolder (configure below)')
						.addOption(AttachmentLocation.VaultFolder, 'Vault folder (configure below)')
						.setValue(this.plugin.settings.attachmentLocation)
						.onChange(async (value) => {
							this.plugin.settings.attachmentLocation = value as AttachmentLocation;
							await this.plugin.saveSettings();
							
							// Preserve scroll position when re-rendering
							const scrollContainer = containerEl.closest('.vertical-tab-content') || 
								containerEl.closest('.settings-content') || 
								containerEl.parentElement;
							const scrollTop = scrollContainer?.scrollTop || 0;
							
							this.display(); // Refresh to show/hide path input
							
							// Restore scroll position after rendering
							requestAnimationFrame(() => {
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
			group.addSetting((setting) => {
				setting
					.setName('Custom attachment path')
					.setDesc('Path for attachments. Use "./" for relative to note, or "/" for vault root.')
					.addText((text) => {
						text
							.setPlaceholder('./assets')
							.setValue(this.plugin.settings.customAttachmentPath)
							.onChange(async (value) => {
								this.plugin.settings.customAttachmentPath = value;
								await this.plugin.saveSettings();
							});
					});
			});
		}
	}

	private renderImageServicesSettings(containerEl: HTMLElement): void {
		const group = createSettingsGroup(containerEl, 'Image services');

		group.addSetting((setting) => {
			setting
				.setName('Default provider')
				.setDesc('Default image provider for search')
				.addDropdown((dropdown) => {
					dropdown
						.addOption(ImageProvider.Unsplash, 'Unsplash')
						.addOption(ImageProvider.Pexels, 'Pexels')
						.addOption(ImageProvider.Pixabay, 'Pixabay')
						.addOption(ImageProvider.Local, 'Local files')
						.setValue(this.plugin.settings.defaultProvider)
						.onChange(async (value) => {
							this.plugin.settings.defaultProvider = value as ImageProvider;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Default orientation')
				.setDesc('Filter images by orientation')
				.addDropdown((dropdown) => {
					dropdown
						.addOption(ImageOrientation.Any, 'Any')
						.addOption(ImageOrientation.Landscape, 'Landscape')
						.addOption(ImageOrientation.Portrait, 'Portrait')
						.addOption(ImageOrientation.Square, 'Square')
						.setValue(this.plugin.settings.defaultOrientation)
						.onChange(async (value) => {
							this.plugin.settings.defaultOrientation = value as ImageOrientation;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Default image size')
				.setDesc('Preferred size when downloading images')
				.addDropdown((dropdown) => {
					dropdown
						.addOption(ImageSize.Original, 'Original')
						.addOption(ImageSize.Large, 'Large')
						.addOption(ImageSize.Medium, 'Medium')
						.addOption(ImageSize.Small, 'Small')
						.setValue(this.plugin.settings.defaultImageSize)
						.onChange(async (value) => {
							this.plugin.settings.defaultImageSize = value as ImageSize;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Unsplash proxy server')
				// False positive: "Unsplash" and "API" are proper nouns
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Optional proxy server for Unsplash API (leave empty to use built-in)')
				.addText((text) => {
					text
						.setPlaceholder('https://your-proxy.com/')
						.setValue(this.plugin.settings.unsplashProxyServer)
						.onChange(async (value) => {
							this.plugin.settings.unsplashProxyServer = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Pexels API key')
				.setDesc('Get your API key from https://www.pexels.com/api/new/')
				.addText((text) => {
					text
						// False positive: "Pexels" and "API" are proper nouns
						// eslint-disable-next-line obsidianmd/ui/sentence-case
						.setPlaceholder('Your Pexels API key...')
						.setValue(this.plugin.settings.pexelsApiKey)
						.onChange(async (value) => {
							this.plugin.settings.pexelsApiKey = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Pixabay API key')
				.setDesc('Get your API key from https://pixabay.com/api/docs/')
				.addText((text) => {
					text
						// False positive: "Pixabay" and "API" are proper nouns
						// eslint-disable-next-line obsidianmd/ui/sentence-case
						.setPlaceholder('Your Pixabay API key...')
						.setValue(this.plugin.settings.pixabayApiKey)
						.onChange(async (value) => {
							this.plugin.settings.pixabayApiKey = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Insert size')
				.setDesc('Set the size of the image when inserting. Format could be only the width "200" or the width and height "200x100". Leave empty for no size.')
				.addText((text) => {
					text
						.setPlaceholder('200 or 200x100')
						.setValue(this.plugin.settings.insertSize)
						.onChange(async (value) => {
							this.plugin.settings.insertSize = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Insert referral')
				// False positive: "Insert" is a verb, "referral" is a technical term
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Insert the reference text (e.g., "Photo by [author] on [provider]")')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.insertReferral)
						.onChange(async (value) => {
							this.plugin.settings.insertReferral = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Insert backlink')
				// False positive: "backlink" is a technical term
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Insert a backlink (image HTML location on Provider website) in front of the reference text (e.g., "[Backlink](url) | Photo by...")')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.insertBackLink)
						.onChange(async (value) => {
							this.plugin.settings.insertBackLink = value;
							await this.plugin.saveSettings();
						});
				});
		});
	}

	private renderPropertySettings(containerEl: HTMLElement): void {
		const group = createSettingsGroup(containerEl, 'Property insertion');

		group.addSetting((setting) => {
			setting
				.setName('Enable paste into properties')
				.setDesc('Allow pasting images directly into properties')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.enablePropertyPaste)
						.onChange(async (value) => {
							this.plugin.settings.enablePropertyPaste = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Property link format')
				.setDesc('How to format the image link in properties')
				.addDropdown((dropdown) => {
					dropdown
						.addOption(PropertyLinkFormat.Path, 'Plain path (path/to/image.jpg)')
						.addOption(PropertyLinkFormat.RelativePath, 'Relative path (./image.jpg)')
						.addOption(PropertyLinkFormat.Wikilink, 'Wikilink ([[path/to/image.jpg]])')
						.addOption(PropertyLinkFormat.Markdown, 'Markdown (![](path/to/image.jpg))')
						.addOption(PropertyLinkFormat.Custom, 'Custom format')
						.setValue(this.plugin.settings.propertyLinkFormat)
						.onChange(async (value) => {
							this.plugin.settings.propertyLinkFormat = value as PropertyLinkFormat;
							await this.plugin.saveSettings();
							
							// Preserve scroll position when re-rendering
							const scrollContainer = containerEl.closest('.vertical-tab-content') || 
								containerEl.closest('.settings-content') || 
								containerEl.parentElement;
							const scrollTop = scrollContainer?.scrollTop || 0;
							
							this.display(); // Refresh to show/hide custom format input
							
							// Restore scroll position after rendering
							requestAnimationFrame(() => {
								if (scrollContainer) {
									scrollContainer.scrollTop = scrollTop;
								}
							});
						});
				});
		});

		// Show custom format input when "Custom" is selected
		if (this.plugin.settings.propertyLinkFormat === PropertyLinkFormat.Custom) {
			group.addSetting((setting) => {
				setting
					.setName('Custom format template')
					.setDesc('Use {image-url} as placeholder for the image path')
					.addText((text) => {
						text
							.setPlaceholder('{image-url}')
							.setValue(this.plugin.settings.customPropertyLinkFormat)
							.onChange(async (value) => {
								this.plugin.settings.customPropertyLinkFormat = value;
								await this.plugin.saveSettings();
							});
					});
			});
		}

		group.addSetting((setting) => {
			setting
				.setName('Default property name')
				.setDesc('Default property name when inserting to properties via command')
				.addText((text) => {
					text
						// False positive: "cover" is a placeholder for property name
						// eslint-disable-next-line obsidianmd/ui/sentence-case
						.setPlaceholder('cover')
						.setValue(this.plugin.settings.defaultPropertyName)
						.onChange(async (value) => {
							this.plugin.settings.defaultPropertyName = value;
							await this.plugin.saveSettings();
						});
				});
		});
	}

	private renderConversionSettings(containerEl: HTMLElement): void {
		const group = createSettingsGroup(containerEl, 'Remote image conversion');

		group.addSetting((setting) => {
			setting
				.setName('Auto-convert remote images')
				// False positive: "URLs" is an acronym
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Automatically download and replace remote image URLs with local files')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.autoConvertRemoteImages)
						.onChange(async (value) => {
							this.plugin.settings.autoConvertRemoteImages = value;
							await this.plugin.saveSettings();
							
							// Preserve scroll position when re-rendering
							const scrollContainer = containerEl.closest('.vertical-tab-content') || 
								containerEl.closest('.settings-content') || 
								containerEl.parentElement;
							const scrollTop = scrollContainer?.scrollTop || 0;
							
							this.display(); // Refresh to show/hide sub-options
							
							// Restore scroll position after rendering
							requestAnimationFrame(() => {
								if (scrollContainer) {
									scrollContainer.scrollTop = scrollTop;
								}
							});
						});
				});
		});

		if (this.plugin.settings.autoConvertRemoteImages) {
			group.addSetting((setting) => {
				setting
					.setName('Convert on note open')
					.setDesc('Process remote images when opening a note')
					.addToggle((toggle) => {
						toggle
							.setValue(this.plugin.settings.convertOnNoteOpen)
							.onChange(async (value) => {
								this.plugin.settings.convertOnNoteOpen = value;
								await this.plugin.saveSettings();
							});
					});
			});

			group.addSetting((setting) => {
				setting
					.setName('Convert on note save')
					.setDesc('Process remote images when saving a note')
					.addToggle((toggle) => {
						toggle
							.setValue(this.plugin.settings.convertOnNoteSave)
							.onChange(async (value) => {
								this.plugin.settings.convertOnNoteSave = value;
								await this.plugin.saveSettings();
							});
					});
			});
		}
	}

	private renderRenameSettings(containerEl: HTMLElement): void {
		const group = createSettingsGroup(containerEl, 'Rename options');

		group.addSetting((setting) => {
			setting
				.setName('Descriptive images')
				.setDesc('Ask for image description, use as display text and kebab-case for filename (applies to note body insertions only, not properties)')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.enableDescriptiveImages)
						.onChange(async (value) => {
							this.plugin.settings.enableDescriptiveImages = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Auto rename')
				.setDesc('Automatically rename without showing dialog (uses template)')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.autoRename)
						.onChange(async (value) => {
							this.plugin.settings.autoRename = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Duplicate number delimiter')
				.setDesc('Character(s) between name and number for duplicates (e.g., "-" gives "image-1")')
				.addText((text) => {
					text
						.setPlaceholder('-')
						.setValue(this.plugin.settings.dupNumberDelimiter)
						.onChange(async (value) => {
							this.plugin.settings.dupNumberDelimiter = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Duplicate number at start')
				.setDesc('Put the duplicate number at the start (e.g., "1-image" instead of "image-1")')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.dupNumberAtStart)
						.onChange(async (value) => {
							this.plugin.settings.dupNumberAtStart = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Disable rename notice')
				.setDesc('Do not show a notice after renaming an image')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.disableRenameNotice)
						.onChange(async (value) => {
							this.plugin.settings.disableRenameNotice = value;
							await this.plugin.saveSettings();
						});
				});
		});
	}

	private renderAdvancedSettings(containerEl: HTMLElement): void {
		const group = createSettingsGroup(containerEl, 'Advanced');

		group.addSetting((setting) => {
			setting
				.setName('Supported file extensions')
				.setDesc('File extensions to process (comma-separated)')
				.addText((text) => {
					const currentValue = this.plugin.settings.supportedExtensions.length > 0
						? this.plugin.settings.supportedExtensions.join(', ')
						: '';
					text
						// False positive: "md, mdx" are file extensions
						// eslint-disable-next-line obsidianmd/ui/sentence-case
						.setPlaceholder('md, mdx')
						.setValue(currentValue)
						.onChange(async (value) => {
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

		group.addSetting((setting) => {
			setting
				.setName('Debug mode')
				.setDesc('Enable debug logging to console')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
							this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
						});
				});
		});
	}
}
