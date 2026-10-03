import assert from 'node:assert/strict';
import '../navigation.js';
const { partition, matches, leaves } = globalThis.AsideNavigation;
const bookmarks = [{ id: 'folder', children: [{ id: 'saved', url: 'https://app.test/work', title: 'Saved work' }] }];
const tabs = [
  { id: 1, pinned: true, active: false, index: 0, url: 'https://app.test/work' },
  { id: 2, pinned: false, active: false, index: 1, url: 'https://app.test/work' },
  { id: 3, pinned: false, active: true, index: 2, url: 'https://app.test/work' },
  { id: 4, pinned: false, active: false, index: 3, url: 'http://app.test/work' }
];
const p = partition(tabs, bookmarks);
assert.equal(leaves(bookmarks).length, 1);
assert.equal(p.saved.get('saved').id, 3, 'active saved tab belongs to the bookmark row');
assert.deepEqual(p.pins.map(t => t.id), [1]);
assert.deepEqual(p.tabs.map(t => t.id), [2, 4], 'other exact copies and protocol-distinct tabs stay visible');
assert(matches({ title: 'Рабочая страница', url: 'https://apps.test' }, 'страница APPS'));
assert(!matches({ title: 'Work' }, 'other'));
assert.equal(tabs.length, 4, 'model must not close or mutate tabs');
const duplicateMarks = partition(tabs, [...bookmarks, { id: 'copy', url: 'https://app.test/work' }]);
assert.equal([...duplicateMarks.saved.values()].filter(t => t.active).length, 1, 'one active row even with duplicated bookmarks');
console.log('PASS navigation · bookmarks, folders, pins, duplicates, query');
