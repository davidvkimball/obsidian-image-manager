---
name: project
description: Project-specific architecture, maintenance tasks, and unique conventions for Image Manager.
---

# Image Manager Project Skill

Insert, rename, and sort images within your notes. This plugin provides a comprehensive suite of tools for managing image assets within Obsidian note contexts, improving the asset management workflow.

## Core Architecture

- **Asset Manipulation**: Directly handles file system operations for image renaming and re-sorting.
- **Rich UI Controls**: Uses a 14KB `styles.css` for custom asset management interfaces and modal dialogs.
- **Editor Integration**: Interfaces with the Obsidian editor to handle image insertion and selection.

## Project-Specific Conventions

- **Safe Asset Handling**: Prioritizes atomic file operations to avoid asset corruption during renaming.
- **Visual-First UX**: High emphasis on thumbnail previews and visual sorting controls.
- **Asset Hierarchy**: Maintains a consistent folder-based approach to image organization.

## Key Files

- `src/main.ts`: Core asset management logic and command registration.
- `manifest.json`: Configuration and plugin id (`image-manager`).
- `styles.css`: Visual components for the image manager UI.
- `.cursor/`: Contains Cursor-specific configurations or local instruction rules.

## Maintenance Tasks

- **File System Safety**: Verify asset rename logic against various OS file system constraints.
- **Asset Rendering**: Ensure thumbnail rendering remains efficient for large asset folders.
- **Metadata Sync**: Monitor how Obsidian tracks moved assets to ensure internal links stay valid.
