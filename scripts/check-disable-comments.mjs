#!/usr/bin/env node

/**
 * Check for eslint-disable comments without descriptions
 * This mimics the Obsidian bot's check for undescribed directives
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Pattern to check if a disable comment has a description
const hasDescriptionPattern = /--\s+.+/;

let hasErrors = false;
const errors = [];

// Recursively find all TypeScript files
function findTsFiles(dir, fileList = []) {
	const files = readdirSync(dir);
	for (const file of files) {
		const filePath = join(dir, file);
		const stat = statSync(filePath);
		if (stat.isDirectory() && file !== 'node_modules' && file !== '.ref') {
			findTsFiles(filePath, fileList);
		} else if (file.endsWith('.ts')) {
			fileList.push(filePath);
		}
	}
	return fileList;
}

const files = findTsFiles(join(projectRoot, 'src'));

for (const filePath of files) {
	const content = readFileSync(filePath, 'utf-8');
	const lines = content.split('\n');
	const relativePath = filePath.replace(projectRoot + '\\', '').replace(projectRoot + '/', '');

	// Check each line for eslint-disable comments
	lines.forEach((line, index) => {
		if (line.includes('eslint-disable')) {
			// Check if it has a description (-- followed by text)
			if (!hasDescriptionPattern.test(line)) {
				// Check if description is on previous line
				const prevLine = index > 0 ? lines[index - 1] : '';
				const hasDescriptionOnPrevLine = prevLine.trim().startsWith('//') && 
					(hasDescriptionPattern.test(prevLine) || prevLine.includes('reason:') || prevLine.includes('reason'));
				
				if (!hasDescriptionOnPrevLine) {
					errors.push({
						file: relativePath,
						line: index + 1,
						content: line.trim()
					});
					hasErrors = true;
				}
			}
		}
	});
}

if (hasErrors) {
	console.error('\n❌ Found eslint-disable comments without descriptions:\n');
	errors.forEach(({ file, line, content }) => {
		console.error(`  ${file}:${line}`);
		console.error(`    ${content}\n`);
	});
	console.error('All eslint-disable comments must include descriptions using -- syntax');
	console.error('Example: // eslint-disable-next-line rule-name -- reason for disabling\n');
	process.exit(1);
} else {
	console.log('✓ All eslint-disable comments have descriptions');
	process.exit(0);
}
