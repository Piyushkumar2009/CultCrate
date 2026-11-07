import assert from 'node:assert/strict';
import { parseLetterboxdRSS, cleanMovieTitle, parseStarRating, resolveLetterboxdRssUrl } from '../lib/letterboxdRss';
import { buildCanonicalCsv, deduplicateWatchlist, validateGeneratedCsv, canonicalizeUploadedCsv, buildMovieKey, convertStarsToNumeric } from '../lib/deduplication';
import { parseCsv } from '../lib/csv';

let n = 0; const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name); };

// ---- titles
t('1917 / Blade Runner 2049 / (500) Days survive', () => {
  assert.deepEqual(cleanMovieTitle('1917, 2019 - ★★★★'), { title: '1917', year: '2019', rating: '4.0' });
  assert.equal(cleanMovieTitle('Blade Runner 2049, 2017 - ★★★★½').title, 'Blade Runner 2049');
  assert.equal(cleanMovieTitle('Blade Runner 2049').title, 'Blade Runner 2049');
  assert.equal(cleanMovieTitle('(500) Days of Summer, 2009').title, '(500) Days of Summer');
  assert.equal(cleanMovieTitle('Cure (Kyua), 1997 - ★★★★ (contains spoilers)').title, 'Cure (Kyua)');
  assert.equal(cleanMovieTitle('3').rating, undefined); // a film called "3" is not a 3-star rating
});
t('star parsing never yields NaN/undefined strings', () => {
  assert.equal(parseStarRating('★★★½'), '3.5'); assert.equal(parseStarRating('½'), '0.5');
  assert.equal(parseStarRating('NaN'), undefined); assert.equal(parseStarRating('undefined'), undefined);
  assert.equal(parseStarRating('7'), undefined); assert.equal(parseStarRating('4'), '4.0');
  assert.equal(convertStarsToNumeric('https://boxd.it/abc'), 0);
});
t('ssrf / email-handle guard', () => {
  assert.equal(resolveLetterboxdRssUrl('john.doe'), null);
  assert.equal(resolveLetterboxdRssUrl('http://169.254.169.254/rss/'), null);
  assert.equal(resolveLetterboxdRssUrl('https://evil.com/x/rss/'), null);
  assert.equal(resolveLetterboxdRssUrl('@dave'), 'https://letterboxd.com/dave/rss/');
});

// ---- csv with comma titles (this is what broke the old split(','))
const existing = [
  'Date,Name,Year,Letterboxd URI,Rating',
  '2024-01-02,"Hail, Caesar!",2016,https://boxd.it/aaa,3.5',
  '2023-05-05,1917,2019,https://boxd.it/bbb,4',
  '2022-02-02,"Eternal Sunshine of the Spotless Mind",2004,https://boxd.it/ccc,5',
  '2021-01-01,Blade Runner 2049,2017,https://boxd.it/ddd,4.5',
  '2020-01-01,,2000,https://boxd.it/eee,NaN',
  '2020-01-01,undefined,NaN,,undefined',
  '2019-01-01,Nullarbor,2020,,3.0',
].join('\n');

const rss = `<?xml version="1.0"?><rss><channel>
<item><title>Hail, Caesar!, 2016 - ★★★★</title><guid>letterboxd-review-1</guid><link>https://letterboxd.com/dave/film/hail-caesar/</link>
 <letterboxd:watchedDate>2025-03-01</letterboxd:watchedDate><letterboxd:filmTitle>Hail, Caesar!</letterboxd:filmTitle><letterboxd:filmYear>2016</letterboxd:filmYear><letterboxd:memberRating>4.0</letterboxd:memberRating></item>
<item><title>My Favourite Lists</title><guid>letterboxd-list-9</guid><link>https://letterboxd.com/dave/list/favs/</link></item>
<item><title>Parasite, 2019</title><guid>letterboxd-watch-5</guid><link>https://letterboxd.com/dave/film/parasite-2019/</link>
 <letterboxd:watchedDate>2025-04-01</letterboxd:watchedDate><letterboxd:filmTitle>Parasite</letterboxd:filmTitle><letterboxd:filmYear>2019</letterboxd:filmYear></item>
<item><title>1917, 2019 - ★★★★</title><guid>letterboxd-review-3</guid><link>https://letterboxd.com/dave/film/1917/</link>
 <pubDate>Sun, 01 Jun 2025 10:00:00 +0000</pubDate></item>
<item><title><![CDATA[Tom &amp; Jerry]]>, 2021 - ★★★</title><guid>letterboxd-review-4</guid><link>https://letterboxd.com/dave/film/tom-jerry/</link></item>
<item><title>No Year Film</title><guid>letterboxd-review-8</guid></item>
</channel></rss>`;

t('RSS parse skips lists and yearless, keeps unrated, no fake dates', () => {
  const e = parseLetterboxdRSS(rss);
  assert.deepEqual(e.map(x => x.title), ['Hail, Caesar!', 'Parasite', '1917', 'Tom &amp; Jerry']);
  assert.equal(e[1].rating, undefined);
  assert.equal(e[2].watchedDate, '2025-06-01');
  assert.equal(e[3].watchedDate, '');   // no date in feed -> '' (not "today")
});

t('dedupe: comma titles stay intact, corrupt rows dropped, key format locked', () => {
  const r = deduplicateWatchlist(existing, parseLetterboxdRSS(rss));
  const keys = [...r.deduplicatedMap.keys()];
  assert.ok(keys.includes('hail, caesar!_2016'));
  assert.ok(keys.includes('1917_2019'));
  assert.ok(keys.includes('blade runner 2049_2017'));
  assert.ok(keys.includes('nullarbor_2020'));
  assert.equal(buildMovieKey('  Hail, Caesar! ', '2016'), 'hail, caesar!_2016');
  assert.equal(r.deduplicatedMap.get('hail, caesar!_2016')!.rating, 4);        // newest rating wins
  assert.equal(r.deduplicatedMap.get('1917_2019')!.rating, 4);
  assert.equal(r.totalWatchedCount, r.uniqueMovies.length);
  assert.ok(![...r.deduplicatedMap.keys()].some(k => /undefined|nan/.test(k)));
});

t('IDEMPOTENT: re-syncing same feed never inflates the file', () => {
  const a = buildCanonicalCsv(existing, parseLetterboxdRSS(rss));
  assert.ok(a.ok);
  const b = buildCanonicalCsv(a.csv, parseLetterboxdRSS(rss));
  assert.ok(b.ok);
  const c = buildCanonicalCsv(b.csv, parseLetterboxdRSS(rss));
  assert.ok(c.ok);
  assert.equal(a.csv, b.csv); assert.equal(b.csv, c.csv);
  assert.equal(a.rowCount, b.rowCount);
  assert.ok(!/undefined|NaN/.test(a.csv));
  // unrated Parasite has an empty rating cell, NOT a fabricated 4.0
  const parasite = parseCsv(a.csv).find(r => r[1] === 'Parasite')!;
  assert.equal(parasite[4], '');
});

t('validator accepts good, rejects every corruption class', () => {
  const good = buildCanonicalCsv(existing, null); assert.ok(good.ok);
  assert.equal(validateGeneratedCsv(good.csv).valid, true);
  const H = 'Date,Name,Year,Letterboxd URI,Rating\n';
  const bad: Record<string,string> = {
    empty: '', headerOnly: H,
    blankTitle: H + '2020-01-01,,2000,,3.5\n',
    undefTitle: H + '2020-01-01,undefined,2000,,3.5\n',
    nanRating: H + '2020-01-01,Film,2000,,NaN\n',
    undefRating: H + '2020-01-01,Film,2000,,undefined\n',
    rating9: H + '2020-01-01,Film,2000,,9.0\n',
    badYear: H + '2020-01-01,Film,20x0,,3.5\n',
    shifted: H + '2020-01-01,Hail, Caesar!,2016,,3.5\n',   // unquoted comma => 6 cols
    dup: H + '2020-01-01,Film,2000,,3.5\n2021-01-01,film,2000,,4.0\n',
    wrongHeader: 'a,b,c\n1,2,3\n',
  };
  for (const [k, v] of Object.entries(bad)) assert.equal(validateGeneratedCsv(v).valid, false, k);
});

t('uploaded Letterboxd export is canonicalised (and garbage rejected)', () => {
  const up = canonicalizeUploadedCsv('Date,Name,Year,Letterboxd URI,Rating\n2024-01-02,"Hail, Caesar!",2016,https://boxd.it/aaa,3.5\n');
  assert.ok(up.ok && up.rowCount === 1);
  assert.equal(canonicalizeUploadedCsv('foo,bar\n1,2').ok, false);
  assert.equal(canonicalizeUploadedCsv('Date,Name,Year,Letterboxd URI,Rating\n,,,,\n').ok, false);
});
console.log(`\n${n} test groups passed`);
