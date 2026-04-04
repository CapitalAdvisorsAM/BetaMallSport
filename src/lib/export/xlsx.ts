import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

type CellValue = string | number | boolean | null | undefined;

export type ExportSheet = {
  name: string;
  headers: string[];
  rows: CellValue[][];
};

function sanitizeSheetName(value: string): string {
  const trimmed = value.trim() || "Hoja";
  const noForbidden = trimmed.replace(/[\\/*?:[\]]/g, " ");
  return noForbidden.slice(0, 31);
}

function toSheetRows(sheet: ExportSheet): CellValue[][] {
  return [sheet.headers, ...sheet.rows];
}

export function buildExcelWorkbookBuffer(sheets: ExportSheet[]): Buffer {
  if (sheets.length === 0) {
    throw new Error("Debes enviar al menos una hoja para construir el Excel.");
  }

  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const item of sheets) {
    const baseName = sanitizeSheetName(item.name);
    let finalName = baseName;
    let suffix = 2;
    while (usedNames.has(finalName)) {
      const maxBaseLength = Math.max(1, 31 - (`-${suffix}`).length);
      finalName = `${baseName.slice(0, maxBaseLength)}-${suffix}`;
      suffix += 1;
    }
    usedNames.add(finalName);

    const rows = toSheetRows(item);
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!autofilter"] = {
      ref: `A1:${XLSX.utils.encode_col(Math.max(item.headers.length - 1, 0))}1`
    };

    const columnWidths = item.headers.map((header, index) => {
      const maxRowLength = item.rows.reduce((max, row) => {
        const value = row[index];
        const text = value === null || value === undefined ? "" : String(value);
        return Math.max(max, text.length);
      }, header.length);
      return { wch: Math.min(Math.max(maxRowLength + 2, 10), 60) };
    });
    worksheet["!cols"] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, finalName);
  }

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

function sanitizeFileName(value: string): string {
  const trimmed = value.trim();
  const safe = (trimmed || "export").replace(/[^a-zA-Z0-9-_]/g, "-");
  return safe.toLowerCase();
}

export function createExcelDownloadResponse(
  buffer: Buffer,
  fileNameWithoutExtension: string
): NextResponse {
  const safeName = sanitizeFileName(fileNameWithoutExtension);
  const fileName = `${safeName}.xlsx`;

  return new NextResponse(Uint8Array.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`
    }
  });
}
