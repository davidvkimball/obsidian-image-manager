# Image Manager

Insert, rename, and sort external images by transforming them into local files within your notes.

## Features

Image Manager unifies functionality from multiple image-related plugins into one cohesive experience:

### Image Insertion

- **Local file picker** - Select images from your computer using the OS native file explorer
- **Remote image search** - Search and download images from Unsplash, Pexels, and Pixabay
- **Paste and drop** - Paste images from clipboard or drag and drop files directly into notes

### Image Management

- **Automatic rename dialog** - Prompt to rename images when pasted or inserted (configurable)
- **Descriptive images** - Optionally prompt for image descriptions, used as display text and kebab-case filename
- **Smart deduplication** - Automatically handles duplicate filenames with numbering
- **Template-based naming** - Customize image names using template variables

### Property Integration

- **Paste into properties** - Paste images directly into frontmatter properties
- **Multiple link formats** - Choose from path, wikilink, markdown link, relative path, or custom format
- **MDX support** - Full compatibility with MDX files in addition to standard Markdown

### Remote Image Conversion

- **Auto-convert remote images** - Automatically convert remote image URLs to local files
- **Convert on note open** - Process remote images when opening a note
- **Convert on note save** - Process remote images when saving a note
- **Rename during conversion** - Show rename dialog for each converted image

### Attachment Management

- **Flexible storage** - Follow Obsidian's default, use same folder, subfolder, or centralized location
- **Custom attachment paths** - Configure custom paths using template variables

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

1. Open Settings → Image Manager
2. Configure your preferred image services (Unsplash, Pexels, Pixabay)
3. Set up API keys if using remote image search
4. Configure rename behavior and attachment locations
5. Use commands or paste/drop images to get started

### Remote Image Services

**Unsplash**: Uses a proxy server (default provided) or configure your own. No API key required for basic usage.

**Pexels**: Requires an API key from [Pexels API](https://www.pexels.com/api/).

**Pixabay**: Requires an API key from [Pixabay API](https://pixabay.com/api/docs/).

## Compatibility

- Works on both desktop and mobile
- Compatible with Obsidian 0.15.0 and later
- Supports both `.md` and `.mdx` files

## Development

This project uses TypeScript and follows Obsidian plugin best practices.

### Building

```bash
pnpm build
```

### Development Mode

```bash
pnpm dev
```

## Credits

This plugin unifies functionality from the following excellent plugins:

- [Image Inserter](https://github.com/cloudy9101/obsidian-image-inserter) by cloudy9101 - Remote image search from Unsplash, Pexels, Pixabay
- [Simple Image Inserter](https://github.com/jdholtz/obsidian-image-inserter) by jdholtz - Local file picker using OS native dialog
- [Paste Image Rename](https://github.com/reorx/obsidian-paste-image-rename) by reorx - Automatic rename dialog on paste/drop
- [Paste Image Into Property](https://github.com/Nitero/obsidian-paste-image-into-property) by Nitero - Insert images directly into frontmatter properties
- [Local Images Plus](https://github.com/Sergei-Korneev/obsidian-local-images-plus) by Sergei-Korneev - Convert remote/external images to local files

Additional inspiration and patterns from:

- [obsidian-bases-cms](https://github.com/davidvkimball/obsidian-bases-cms) - MDX frontmatter handling patterns
- [obsidian-property-over-filename](https://github.com/davidvkimball/obsidian-property-over-filename) - MDX frontmatter cache patterns
- [obsidian-astro-composer](https://github.com/davidvkimball/obsidian-astro-composer) - Descriptive image naming patterns
