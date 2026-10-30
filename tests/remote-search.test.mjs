import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { transform } from 'esbuild';

// Minimal Obsidian DOM adapter: exercise the actual modal handlers without
// requiring an Obsidian vault, provider credentials, or new test dependencies.
class Element extends EventTarget {
	constructor({ cls = '' } = {}) {
		super();
		this.classes = new Set(cls.split(' ').filter(Boolean));
		this.children = [];
	}
	createDiv(options) { return this.createEl('div', options); }
	createEl(tag, options) {
		const child = new Element(options);
		this.children.push(child);
		return child;
	}
	empty() { this.children = []; }
	addClass(name) { this.classes.add(name); }
	removeClass(name) { this.classes.delete(name); }
	querySelector(selector) {
		for (const child of this.children) {
			if (child.classes.has(selector.slice(1))) return child;
			const match = child.querySelector(selector);
			if (match) return match;
		}
		return null;
	}
}

const source = await readFile(new URL('../src/modals/RemoteSearchModal.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'cjs' });
const exports = {};
const module = { exports };
runInNewContext(code, {
	exports,
	module,
	require: (name) => {
		if (name === 'obsidian') return { Modal: class {} };
		assert.equal(name, '../types');
		return {};
	},
});
const { RemoteSearchModal } = module.exports;

function fixture() {
	const modal = Object.create(RemoteSearchModal.prototype);
	modal.imagesList = new Element();
	modal.currentResults = Array.from({ length: 3 }, (_, id) => ({
		id: String(id), thumbnailUrl: `https://example.com/${id}.jpg`,
	}));
	modal.selectedImage = 0;
	let paginationRenders = 0;
	modal.renderPagination = () => { paginationRenders++; };
	const inserted = [];
	modal.insertImage = (image) => { inserted.push(image); };
	modal.renderResults();
	return { modal, inserted, paginationRenders: () => paginationRenders };
}

function move(element) { element.dispatchEvent(new Event('mousemove')); }
function click(element) { element.dispatchEvent(new Event('click')); }

test('mousemove preserves every result and thumbnail, without rebuilding pagination', () => {
	const { modal, paginationRenders } = fixture();
	const results = [...modal.imagesList.children];
	const thumbnails = results.map((result) => result.children[0]);
	move(results[1]);
	results.forEach((result, index) => {
		assert.equal(modal.imagesList.children[index], result);
		assert.equal(result.children[0], thumbnails[index]);
	});
	assert.equal(paginationRenders(), 1);
});

test('hover updates the selected index and exactly one highlight', () => {
	const { modal } = fixture();
	const results = [...modal.imagesList.children];
	for (const index of [1, 2, 0]) {
		move(results[index]);
		assert.equal(modal.selectedImage, index);
		assert.deepEqual(results.map((result) => result.classes.has('is-selected')),
			results.map((_, i) => i === index));
	}
});

test('a click after compatibility mousemove inserts the same still-attached image once', () => {
	const { modal, inserted } = fixture();
	const target = modal.imagesList.children[1];
	move(target);
	assert.equal(modal.imagesList.children[1], target);
	click(target);
	assert.deepEqual(inserted, [modal.currentResults[1]]);
});

test('movement alone does not insert, and repeated movement keeps the target attached', () => {
	const { modal, inserted, paginationRenders } = fixture();
	const target = modal.imagesList.children[1];
	move(target);
	move(target);
	assert.equal(modal.imagesList.children[1], target);
	assert.deepEqual(inserted, []);
	assert.equal(paginationRenders(), 1);
});

test('a direct click still inserts without requiring mouse movement', () => {
	const { modal, inserted } = fixture();
	click(modal.imagesList.children[2]);
	assert.deepEqual(inserted, [modal.currentResults[2]]);
});
