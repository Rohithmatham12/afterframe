// GAP 15: parses a Letterboxd diary.csv export (extracted from the ZIP
// Letterboxd gives you — no ZIP library needed, just upload the CSV
// directly). Hand-rolled on purpose: the format is simple enough that a
// dependency isn't worth it, and this needs to survive quoted fields with
// embedded commas (movie titles routinely have them).

export type DiaryRow = {
  title: string;
  year: string;
  watchedOn: string;
  rating: number | null;
  rewatch: boolean;
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Letterboxd's diary.csv header is: Date,Name,Year,Letterboxd URI,Rating,
// Rewatch,Tags,Watched Date. "Date" is when the diary entry was logged;
// "Watched Date" is when the film was actually watched — we want the latter.
export function parseLetterboxdDiary(text: string): {
  rows: DiaryRow[];
  error: string;
} {
  const table = parseCSV(text.trim());
  if (table.length < 2) return { rows: [], error: 'That file has no rows.' };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const nameCol = col('name');
  const yearCol = col('year');
  const watchedCol = col('watched date') >= 0 ? col('watched date') : col('date');
  const ratingCol = col('rating');
  const rewatchCol = col('rewatch');
  if (nameCol < 0 || watchedCol < 0) {
    return {
      rows: [],
      error:
        'This doesn’t look like a Letterboxd diary.csv — expected "Name" and "Watched Date" columns.',
    };
  }
  const rows: DiaryRow[] = [];
  for (const r of table.slice(1)) {
    if (!r[nameCol]) continue;
    rows.push({
      title: r[nameCol],
      year: yearCol >= 0 ? r[yearCol] || '' : '',
      watchedOn: r[watchedCol] || '',
      rating:
        ratingCol >= 0 && r[ratingCol] ? Number(r[ratingCol]) || null : null,
      rewatch: rewatchCol >= 0 && r[rewatchCol]?.trim().toLowerCase() === 'yes',
    });
  }
  return { rows, error: '' };
}
