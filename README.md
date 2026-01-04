# Image Manager for Obsidian

Insert, rename, and sort external images by transforming them into local files within your notes.

Image Manager unifies functionality from multiple image-related plugins into one cohesive experience, providing comprehensive image management for your Obsidian vault.

## Features

### Image Insertion

- **Local file picker** - Select images from your computer using the OS native file explorer
- **Remote image search** - Search and download images from Unsplash, Pexels, and Pixabay with filters for orientation, size, and more
- **Paste and drop** - Paste images from clipboard or drag and drop files directly into notes
- **Multiple insertion methods** - Insert into note content or directly into frontmatter properties

### Image Management

- **Automatic rename dialog** - Prompt to rename images when pasted or inserted (configurable per action type)
- **Descriptive images** - Optionally prompt for image descriptions, used as display text and kebab-case filename
- **Smart deduplication** - Automatically handles duplicate filenames with intelligent numbering
- **Template-based naming** - Customize image names using template variables (`{{fileName}}`, `{{dirName}}`, `{{DATE}}`, `{{TIME}}`, etc.)
- **Supported file extensions** - Configure which file types trigger image processing (default: `.md`, `.mdx`)

### Property Integration

- **Paste into properties** - Paste images directly into frontmatter properties with a single action
- **Multiple link formats** - Choose from Obsidian default, path, wikilink, markdown link, relative path, or custom format
- **MDX support** - Full compatibility with MDX files in addition to standard Markdown (uses custom frontmatter handling)
- **Default property name** - Configure which property to use when inserting images into frontmatter

### Remote Image Conversion

- **Auto-convert remote images** - Automatically convert remote image URLs to local files
- **Convert on note open** - Process remote images when opening a note (non-blocking)
- **Convert on note save** - Process remote images when saving a note
- **Rename during conversion** - Show rename dialog for each converted image
- **Batch conversion** - Convert all remote images across your entire vault with a single command

### Attachment Management

- **Flexible storage** - Follow Obsidian's default, use same folder, subfolder, or centralized location
- **Custom attachment paths** - Configure custom paths using template variables
- **Attachment location override** - Override Obsidian's default attachment location per note or globally

### Banner Images

- **Banner display** - Display banner images from frontmatter properties at the top of notes
- **Device-specific settings** - Configure different banner settings for desktop, tablet, and phone
- **Customizable appearance** - Control height, offset, border radius, padding, fade effects, and animations
- **Icon support** - Display icons alongside banners with customizable positioning and styling
- **MDX compatible** - Works with both Markdown and MDX files

## Commands

- `Insert local image` - Open file picker to select and insert a local image
- `Insert remote image` - Open remote image search modal
- `Insert local image to property` - Insert a local image into a frontmatter property
- `Insert remote image to property` - Insert a remote image into a frontmatter property
- `Convert remote images` - Convert remote images to local files in the current note
- `Convert all remote images` - Convert remote images to local files in all notes

## Installation

Image Manager is not yet available in the Community plugins section. Install using [BRAT](https://github.com/TfTHacker/obsidian42-brat) or manually:

### BRAT

1. Download the [Beta Reviewers Auto-update Tester (BRAT)](https://github.com/TfTHacker/obsidian42-brat) plugin from the [Obsidian community plugins directory](https://obsidian.md/plugins?id=obsidian42-brat) and enable it.
2. In the BRAT plugin settings, select `Add beta plugin`.
3. Paste the following: `https://github.com/davidvkimball/obsidian-image-manager` and select `Add plugin`.

### Manual Installation

1. Download the latest release
2. Extract the files to your vault's `.obsidian/plugins/image-manager/` folder
3. Reload Obsidian
4. Enable the plugin in Settings → Community plugins

### Development

1. Clone this repository
2. Run `pnpm install`
3. Run `pnpm dev` to start compilation in watch mode
4. The plugin will be compiled to `main.js`

## Usage

### Getting Started

1. Open Settings → Image Manager
2. Configure your preferred image services (Unsplash, Pexels, Pixabay)
3. Set up API keys if using remote image search (see below)
4. Configure rename behavior and attachment locations
5. Use commands or paste/drop images to get started

### Remote Image Services

**Unsplash**: Uses a proxy server (default provided) or configure your own. No API key required for basic usage, but you can configure a custom proxy URL for better performance.

**Pexels**: Requires an API key from [Pexels API](https://www.pexels.com/api/). Free tier available with generous rate limits.

**Pixabay**: Requires an API key from [Pixabay API](https://pixabay.com/api/docs/). Free tier available.

### Configuration Options

The plugin offers extensive configuration through Settings → Image Manager:

- **General Settings**: Enable/disable rename prompts for paste and drop actions
- **Image Services**: Configure API keys and proxy URLs for Unsplash, Pexels, and Pixabay
- **Property Insertion**: Set default property name and link format for frontmatter insertion
- **Conversion**: Configure automatic conversion of remote images on note open/save
- **Rename Options**: Customize name templates and descriptive image prompts
- **Banner Images**: Configure device-specific banner display settings
- **Advanced**: Debug mode, supported file extensions, and attachment location overrides

## Compatibility

- **Platform**: Works on both desktop and mobile (Obsidian 0.15.0+)
- **File Types**: Supports both `.md` and `.mdx` files (configurable)
- **Obsidian Version**: Compatible with Obsidian 0.15.0 and later
- **Settings Compatibility**: Uses SettingGroup compatibility layer for Obsidian 1.11.0+ with fallback for older versions

## Development

This project uses TypeScript and follows Obsidian plugin best practices with a modular service-based architecture.

### Prerequisites

- Node.js (v16 or later)
- pnpm (v10.20.0 or later)

### Setup

1. Clone this repository
2. Run `pnpm install` to install dependencies
3. Run `pnpm dev` to start compilation in watch mode
4. The plugin will be compiled to `main.js`

### Building

```bash
pnpm build
```

Builds the plugin for production (includes type checking).

### Development Mode

```bash
pnpm dev
```

Starts esbuild in watch mode for automatic recompilation.

### Linting

```bash
pnpm lint        # Check for linting errors
pnpm lint:fix    # Auto-fix linting errors
```

### Project Structure

- `src/main.ts` - Plugin entry point and event registration
- `src/services/` - Core service classes (ImageProcessor, StorageManager, etc.)
- `src/modals/` - UI modals (RenameModal, RemoteSearchModal, etc.)
- `src/utils/` - Utility functions (MDX frontmatter, settings compatibility, etc.)
- `src/settings.ts` - Settings interface and settings tab
- `src/types.ts` - Shared TypeScript interfaces

## Credits

This plugin unifies functionality from the following excellent plugins:

- [Image Inserter](https://github.com/cloudy9101/obsidian-image-inserter) by cloudy9101 - Remote image search from Unsplash, Pexels, Pixabay
- [Simple Image Inserter](https://github.com/jdholtz/obsidian-image-inserter) by jdholtz - Local file picker using OS native dialog
- [Paste Image Rename](https://github.com/reorx/obsidian-paste-image-rename) by reorx - Automatic rename dialog on paste/drop
- [Paste Image Into Property](https://github.com/Nitero/obsidian-paste-image-into-property) by Nitero - Insert images directly into frontmatter properties
- [Local Images Plus](https://github.com/Sergei-Korneev/obsidian-local-images-plus) by Sergei-Korneev - Convert remote/external images to local files
- [Simple Banner](https://github.com/eatcodeplay/obsidian-simple-banner) by eatcodeplay - Banner image display from frontmatter properties

Additional inspiration and patterns from:

- [obsidian-bases-cms](https://github.com/davidvkimball/obsidian-bases-cms) - MDX frontmatter handling patterns
- [obsidian-property-over-filename](https://github.com/davidvkimball/obsidian-property-over-filename) - MDX frontmatter cache patterns
- [obsidian-astro-composer](https://github.com/davidvkimball/obsidian-astro-composer) - Descriptive image naming patterns

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues, feature requests, or questions, please visit the [GitHub repository](https://github.com/davidvkimball/obsidian-image-manager).
