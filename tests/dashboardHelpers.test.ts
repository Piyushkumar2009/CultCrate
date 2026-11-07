import assert from 'node:assert/strict';
import {
  buildExclusionSet,
  collectExclusionTitles,
  deriveDnaTags,
  filterOutExcluded,
  MAX_EXCLUSION_TITLES,
} from '../lib/dashboardHelpers';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name); };

t('collectExclusionTitles dedupes across sources, trims, drops blanks', () => {
  const titles = collectExclusionTitles(
    [{ title: ' Cure ' }, { title: 'Memories of Murder' }, { title: '' }],
    [{ title: 'cure' }, { title: 'Oldboy' }],
    null,
    undefined
  );
  assert.deepEqual(titles, ['Cure', 'Memories of Murder', 'Oldboy']);
});

t('collectExclusionTitles caps list size', () => {
  const many = Array.from({ length: 400 }, (_, i) => ({ title: `Film ${i}` }));
  assert.equal(collectExclusionTitles(many).length, MAX_EXCLUSION_TITLES);
});

t('filterOutExcluded removes watchlisted films regardless of case/punctuation', () => {
  const ex = buildExclusionSet(['Cure', 'Memories of Murder']);
  const films = [{ title: 'CURE' }, { title: 'Memories of Murder!' }, { title: 'Parasite' }];
  assert.deepEqual(filterOutExcluded(films, ex).map((f) => f.title), ['Parasite']);
  assert.equal(filterOutExcluded(films, new Set()).length, 3);
});

t('deriveDnaTags picks dominant genres, countries and decade', () => {
  const tags = deriveDnaTags([
    { genre: ['Thriller', 'Crime'], country: 'South Korea', year: 2003 },
    { genre: ['Thriller', 'Drama'], country: 'South Korea', year: 2009 },
    { genre: ['Thriller'], country: 'Japan', year: 1997 },
    { genre: ['Mystery'], country: 'International', year: 2001 },
  ]);
  assert.equal(tags[0], 'Thriller');
  assert.ok(tags.includes('South Korea'));
  assert.ok(tags.includes('2000s'));
  assert.ok(!tags.includes('International'));
  assert.deepEqual(deriveDnaTags([]), []);
});

console.log(`\n${n} helper test groups passed`);
