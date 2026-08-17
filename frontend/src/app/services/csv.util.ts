export type CsvValue = string | number | boolean | null | undefined;

export function escapeCsvCell(value: CsvValue): string {
  let text = value === null || value === undefined ? '' : String(value);

  if (typeof value === 'string' && /^\s*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsvRow(values: readonly CsvValue[]): string {
  return values.map((value) => escapeCsvCell(value)).join(',');
}
