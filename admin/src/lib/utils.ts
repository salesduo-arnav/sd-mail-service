import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string) {
  return (name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Escapes a single value for safe inclusion in a CSV cell.
 * Wraps in double quotes and doubles any embedded quotes when the value
 * contains a comma, quote, or newline.
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds a CSV string from an array of rows given an ordered list of columns.
 * Each column maps a header label to an accessor that extracts the cell value.
 */
export function toCSV<T>(
  rows: T[],
  columns: { header: string; accessor: (row: T) => unknown }[]
): string {
  const headerLine = columns.map((c) => escapeCsvValue(c.header)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvValue(c.accessor(row))).join(",")
  );
  return [headerLine, ...dataLines].join("\r\n");
}

/**
 * Triggers a browser download of the given text content as a file.
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType = "text/csv;charset=utf-8;"
) {
  // Prepend BOM so Excel correctly detects UTF-8.
  const blob = new Blob(["﻿", content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
