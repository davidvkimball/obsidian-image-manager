/**
 * Image Manager Plugin Settings
 * Settings tab with SettingGroup compatibility for Obsidian 1.11.0+
 */

import { App, BaseComponent, Platform, PluginSettingTab, requireApiVersion } from 'obsidian';
import { createSettingsGroup } from './utils/settings-compat';
import {
	ImageManagerSettings,
	DEFAULT_SETTINGS,
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
	new (app: App, el: HTMLElement): BaseComponent & {
		setValue(value: string): void;
		onChange(callback: (value: string) => void): void;
	};
}

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

		// Banner Images
		this.renderBannerSettings(containerEl);

		// Advanced
		this.renderAdvancedSettings(containerEl);
	}

	private renderGeneralSettings(containerEl: HTMLElement): void {
		// General settings without heading (first section doesn't need a heading)
		const group = createSettingsGroup(containerEl, undefined, 'image-manager');

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
		const group = createSettingsGroup(containerEl, 'Image services', 'image-manager');

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
				.setDesc('Optional proxy server (leave empty to use built-in)')
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
					.addText((text) => {
						text
							.setPlaceholder('Pexels API key')
							.setValue(this.plugin.settings.pexelsApiKey)
							.onChange(async (value) => {
								this.plugin.settings.pexelsApiKey = value;
								await this.plugin.saveSettings();
							});
					});
			}
		});

		group.addSetting((setting) => {
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
					.addText((text) => {
						text
							.setPlaceholder('Pixabay API key')
							.setValue(this.plugin.settings.pixabayApiKey)
							.onChange(async (value) => {
								this.plugin.settings.pixabayApiKey = value;
								await this.plugin.saveSettings();
							});
					});
			}
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
				.setDesc('Insert the reference text')
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
				.setDesc('Insert a backlink in front of the reference text')
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
		const group = createSettingsGroup(containerEl, 'Property insertion', 'image-manager');

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
						.addOption(PropertyLinkFormat.ObsidianDefault, "Use Obsidian's settings")
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
					.setPlaceholder('Banner')
						.setValue(this.plugin.settings.defaultPropertyName)
						.onChange(async (value) => {
							this.plugin.settings.defaultPropertyName = value;
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Default icon property name')
				.setDesc('Default property name when inserting to icon property via command')
				.addText((text) => {
					text
						.setPlaceholder('Icon')
						.setValue(this.plugin.settings.defaultIconPropertyName)
						.onChange(async (value) => {
							this.plugin.settings.defaultIconPropertyName = value;
							await this.plugin.saveSettings();
						});
				});
		});
	}

	private renderConversionSettings(containerEl: HTMLElement): void {
		const group = createSettingsGroup(containerEl, 'Remote image conversion', 'image-manager');

		group.addSetting((setting) => {
			setting
				.setName('Auto-convert remote images')
				.setDesc('Automatically download and replace remote image urls with local files')
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
		const group = createSettingsGroup(containerEl, 'Rename options', 'image-manager');

		group.addSetting((setting) => {
			setting
				.setName('Show image rename dialog automatically')
				.setDesc('Handle and rename images when they are added to the vault via paste or drag and drop')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.showRenameDialog)
						.onChange(async (value) => {
							this.plugin.settings.showRenameDialog = value;
							await this.plugin.saveSettings();
							this.refreshWithScrollPreserve(containerEl);
						});
				});
		});

		if (this.plugin.settings.showRenameDialog) {
			group.addSetting((setting) => {
				setting
					.setName('Rename on paste')
					.setDesc('Handle and rename images when pasting into the editor')
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
					.setName('Rename on drag and drop')
					.setDesc('Handle and rename images when dropping into the editor')
					.addToggle((toggle) => {
						toggle
							.setValue(this.plugin.settings.enableRenameOnDrop)
							.onChange(async (value) => {
								this.plugin.settings.enableRenameOnDrop = value;
								await this.plugin.saveSettings();
							});
					});
			});
		}

		group.addSetting((setting) => {
			setting
				.setName('Process background file changes')
				.setDesc('Automatically convert and rename remote images when files are changed in the background (by Git or other plugins). Warning: Turning this on may cause the rename modal to appear for images you\'ve already processed on other devices during a sync.')
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.processBackgroundChanges)
						.onChange(async (value) => {
							this.plugin.settings.processBackgroundChanges = value;
							await this.plugin.saveSettings();
						});
				});
		});

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

		requestAnimationFrame(() => {
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollTop;
			}
		});
	}

	private renderBannerSettings(containerEl: HTMLElement): void {
		const group = createSettingsGroup(containerEl, 'Banner images', 'image-manager');
		const currentDevice = this.getCurrentDevice();
		const deviceSettings = this.plugin.settings.banner[currentDevice];
		const defaultDeviceSettings = DEFAULT_BANNER_DEVICE_SETTINGS[currentDevice];
		const propertySettings = this.plugin.settings.banner.properties;

		// Device-specific enable toggle
		group.addSetting((setting) => {
			setting
				.setName('Show banner')
				.setDesc(`Enable or disable banners on your ${currentDevice} device`)
				.addToggle((toggle) => {
					toggle
						.setValue(deviceSettings.enabled)
						.onChange(async (value) => {
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
		group.addSetting((setting) => {
			setting
				.setName('Height')
				.setDesc(`Height of the banner on your ${currentDevice} device (in pixels)`)
				.addText((text) => {
					text
						.setPlaceholder(String(defaultDeviceSettings.height))
						.setValue(String(deviceSettings.height))
						.onChange(async (value) => {
							const num = parseInt(value, 10);
							if (!isNaN(num) && num > 0) {
								this.plugin.settings.banner[currentDevice].height = num;
								await this.plugin.saveSettings();
							}
						});
				});
		});

		// Banner padding
		group.addSetting((setting) => {
			setting
				.setName('Padding')
				.setDesc('Padding of the banner from the edges of the note (in pixels)')
				.addText((text) => {
					text
						.setPlaceholder(String(defaultDeviceSettings.padding))
						.setValue(String(deviceSettings.padding))
						.onChange(async (value) => {
							const num = parseInt(value, 10);
							if (!isNaN(num) && num >= 0) {
								this.plugin.settings.banner[currentDevice].padding = num;
								await this.plugin.saveSettings();
							}
						});
				});
		});

		// Note offset
		group.addSetting((setting) => {
			setting
				.setName('Note offset')
				.setDesc('Move the position of the note content (in pixels)')
				.addText((text) => {
					text
						.setPlaceholder(String(defaultDeviceSettings.noteOffset))
						.setValue(String(deviceSettings.noteOffset))
						.onChange(async (value) => {
							const num = parseInt(value, 10);
							if (!isNaN(num)) {
								this.plugin.settings.banner[currentDevice].noteOffset = num;
								await this.plugin.saveSettings();
							}
						});
				});
		});

		// View offset
		group.addSetting((setting) => {
			setting
				.setName('View offset')
				.setDesc('Move the position of the view content (in pixels)')
				.addText((text) => {
					text
						.setPlaceholder(String(defaultDeviceSettings.viewOffset))
						.setValue(String(deviceSettings.viewOffset))
						.onChange(async (value) => {
							const num = parseInt(value, 10);
							if (!isNaN(num)) {
								this.plugin.settings.banner[currentDevice].viewOffset = num;
								await this.plugin.saveSettings();
							}
						});
				});
		});

		// Fade
		group.addSetting((setting) => {
			setting
				.setName('Fade')
				.setDesc('Fade the image out towards the content')
				.addToggle((toggle) => {
					toggle
						.setValue(deviceSettings.fade)
						.onChange(async (value) => {
							this.plugin.settings.banner[currentDevice].fade = value;
							await this.plugin.saveSettings();
						});
				});
		});

		// Animation
		group.addSetting((setting) => {
			setting
				.setName('Animation')
				.setDesc('Enable banner animation when opening files')
				.addToggle((toggle) => {
					toggle
						.setValue(deviceSettings.animation)
						.onChange(async (value) => {
							this.plugin.settings.banner[currentDevice].animation = value;
							await this.plugin.saveSettings();
						});
				});
		});

		// Frontmatter property settings (global, not device-specific)
		group.addSetting((setting) => {
			setting
				.setName('Banner property')
				.setDesc('Name of the banner property this plugin will look for in the properties')
				.addText((text) => {
					text
						.setPlaceholder('Banner')
						.setValue(propertySettings.imageProperty)
						.onChange(async (value) => {
							this.plugin.settings.banner.properties.imageProperty = value || 'banner';
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Icon property')
				.setDesc('Name of the icon property this plugin will look for in the properties')
				.addText((text) => {
					text
						.setPlaceholder('Icon')
						.setValue(propertySettings.iconProperty)
						.onChange(async (value) => {
							this.plugin.settings.banner.properties.iconProperty = value || 'icon';
							await this.plugin.saveSettings();
						});
				});
		});

		group.addSetting((setting) => {
			setting
				.setName('Enable per-note banner hiding')
				.setDesc('Allow disabling banners on a per-note basis using a properties field')
				.addToggle((toggle) => {
					toggle
						.setValue(propertySettings.hidePropertyEnabled)
						.onChange(async (value) => {
							this.plugin.settings.banner.properties.hidePropertyEnabled = value;
							await this.plugin.saveSettings();
							this.refreshWithScrollPreserve(containerEl);
						});
				});
		});

		// Show hide property input when enabled
		if (propertySettings.hidePropertyEnabled) {
			group.addSetting((setting) => {
				setting
					.setName('Hide banner property')
					.setDesc('Name of the property that, when set to true, will hide the banner for that note')
					.addText((text) => {
						text
							.setPlaceholder('Hide banner')
							.setValue(propertySettings.hideProperty)
							.onChange(async (value) => {
								this.plugin.settings.banner.properties.hideProperty = value || '';
								await this.plugin.saveSettings();
							});
					});
			});
		}

		// Icon settings
		group.addSetting((setting) => {
			setting
				.setName('Show icon')
				.setDesc('Enable or disable the icon')
				.addToggle((toggle) => {
					toggle
						.setValue(deviceSettings.iconEnabled)
						.onChange(async (value) => {
							this.plugin.settings.banner[currentDevice].iconEnabled = value;
							await this.plugin.saveSettings();
							this.refreshWithScrollPreserve(containerEl);
						});
				});
		});

		// Only show icon settings if enabled
		if (deviceSettings.iconEnabled) {
			group.addSetting((setting) => {
				setting
					.setName('Icon size')
					.setDesc('Size of the icon (in pixels)')
					.addText((text) => {
						text
							.setPlaceholder(String(defaultDeviceSettings.iconSize))
							.setValue(String(deviceSettings.iconSize))
							.onChange(async (value) => {
								const num = parseInt(value, 10);
								if (!isNaN(num) && num > 0) {
									this.plugin.settings.banner[currentDevice].iconSize = num;
									await this.plugin.saveSettings();
								}
							});
					});
			});

			group.addSetting((setting) => {
				setting
					.setName('Icon background')
					.setDesc('Enable or disable the icon background')
					.addToggle((toggle) => {
						toggle
							.setValue(deviceSettings.iconBackground)
							.onChange(async (value) => {
								this.plugin.settings.banner[currentDevice].iconBackground = value;
								await this.plugin.saveSettings();
							});
					});
			});

			group.addSetting((setting) => {
				setting
					.setName('Icon frame')
					.setDesc('Show the border/background frame around the icon (disable to display just the icon graphic)')
					.addToggle((toggle) => {
						toggle
							.setValue(deviceSettings.iconFrame)
							.onChange(async (value) => {
								this.plugin.settings.banner[currentDevice].iconFrame = value;
								await this.plugin.saveSettings();
							});
					});
			});

			group.addSetting((setting) => {
				setting
					.setName('Icon border size')
					.setDesc('Size of the icon border (in pixels)')
					.addText((text) => {
						text
							.setPlaceholder(String(defaultDeviceSettings.iconBorder))
							.setValue(String(deviceSettings.iconBorder))
							.onChange(async (value) => {
								const num = parseInt(value, 10);
								if (!isNaN(num) && num >= 0) {
									this.plugin.settings.banner[currentDevice].iconBorder = num;
									await this.plugin.saveSettings();
								}
							});
					});
			});

			group.addSetting((setting) => {
				setting
					.setName('Icon border radius')
					.setDesc('Size of the icon border radius (in pixels)')
					.addText((text) => {
						text
							.setPlaceholder(String(defaultDeviceSettings.iconRadius))
							.setValue(String(deviceSettings.iconRadius))
							.onChange(async (value) => {
								const num = parseInt(value, 10);
								if (!isNaN(num) && num >= 0) {
									this.plugin.settings.banner[currentDevice].iconRadius = num;
									await this.plugin.saveSettings();
								}
							});
					});
			});

			group.addSetting((setting) => {
				setting
					.setName('Icon alignment - horizontal')
					.setDesc('Horizontal alignment of the icon')
					.addDropdown((dropdown) => {
						dropdown
							.addOption('flex-start', 'Left')
							.addOption('center', 'Center')
							.addOption('flex-end', 'Right')
							.setValue(deviceSettings.iconAlignmentH)
							.onChange(async (value) => {
								this.plugin.settings.banner[currentDevice].iconAlignmentH = value as 'flex-start' | 'center' | 'flex-end';
								await this.plugin.saveSettings();
							});
					});
			});

			group.addSetting((setting) => {
				setting
					.setName('Icon alignment - vertical')
					.setDesc('Vertical alignment of the icon')
					.addDropdown((dropdown) => {
						dropdown
							.addOption('flex-start', 'Top')
							.addOption('center', 'Center')
							.addOption('flex-end', 'Bottom')
							.setValue(deviceSettings.iconAlignmentV)
							.onChange(async (value) => {
								this.plugin.settings.banner[currentDevice].iconAlignmentV = value as 'flex-start' | 'center' | 'flex-end';
								await this.plugin.saveSettings();
							});
					});
			});
		}
	}

	private renderAdvancedSettings(containerEl: HTMLElement): void {
		const group = createSettingsGroup(containerEl, 'Advanced', 'image-manager');

		group.addSetting((setting) => {
			setting
				.setName('Supported file extensions')
				.setDesc('File extensions to process (comma-separated)')
				.addText((text) => {
					const currentValue = this.plugin.settings.supportedExtensions.length > 0
						? this.plugin.settings.supportedExtensions.join(', ')
						: '';
					text
						.setPlaceholder('File extensions')
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
