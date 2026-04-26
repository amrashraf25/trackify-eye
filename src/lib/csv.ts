// CSV export helper. Quotes values that contain commas, quotes, or newlines.
// Browser-only — triggers a download via a temporary <a> tag.

const escapeCell = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const str = typeof val === "string" ? val : String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export type CsvColumn<T> = {
  header: string;
  accessor: (row: T) => unknown;
};

export const exportToCsv = <T,>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void => {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(",");
  const bodyLines = rows.map((row) =>
    columns.map((c) => escapeCell(c.accessor(row))).join(","),
  );
  const csv = [headerLine, ...bodyLines].join("\r\n");
  // Prepend BOM so Excel detects UTF-8 correctly.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
