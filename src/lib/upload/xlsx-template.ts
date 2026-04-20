import * as XLSX from "xlsx";

const NAVY_DARK = "FF011E42";
const NAVY = "FF164786";
const NAVY_LIGHT = "FFD6E4F7";
const GOLD = "FFD4A84B";
const GOLD_LIGHT = "FFFFF3CD";
const WHITE = "FFFFFFFF";
const GRAY_LIGHT = "FFF8F9FA";
const GRAY_TEXT = "FF6B7280";
const GREEN_LIGHT = "FFD1FAE5";
const TEAL = "FF0D9488";
const SLATE = "FF475569";

type HeaderPalette = "navy" | "gold" | "teal" | "slate";

const STYLE = {
  TITLE: 1,
  SUBTITLE: 2,
  HEADER_NAVY: 3,
  HEADER_NAVY_REQUIRED: 4,
  HEADER_GOLD: 5,
  HEADER_GOLD_REQUIRED: 6,
  HEADER_TEAL: 7,
  HEADER_TEAL_REQUIRED: 8,
  HEADER_SLATE: 9,
  HEADER_SLATE_REQUIRED: 10,
  DESCRIPTION: 11,
  DESCRIPTION_REQUIRED: 12,
  EXAMPLE: 13,
  INSTRUCTIONS_TITLE: 15,
  INSTRUCTIONS_SECTION: 16
} as const;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>
    <numFmt numFmtId="165" formatCode="0.00"/>
    <numFmt numFmtId="166" formatCode="0.00%"/>
  </numFmts>
  <fonts count="6">
    <font>
      <sz val="11"/>
      <color rgb="FF111827"/>
      <name val="Calibri"/>
      <family val="2"/>
      <scheme val="minor"/>
    </font>
    <font>
      <b/>
      <sz val="12"/>
      <color rgb="${WHITE}"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <i/>
      <sz val="11"/>
      <color rgb="${WHITE}"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <i/>
      <sz val="9"/>
      <color rgb="${GRAY_TEXT}"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <i/>
      <sz val="10"/>
      <color rgb="FF111827"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <sz val="11"/>
      <color rgb="FF111827"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="12">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${NAVY_DARK}"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${NAVY}"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${GOLD}"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${GRAY_LIGHT}"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${GREEN_LIGHT}"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${WHITE}"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${GOLD_LIGHT}"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${TEAL}"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${SLATE}"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${NAVY_LIGHT}"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="${NAVY}"/></left>
      <right style="thin"><color rgb="${NAVY}"/></right>
      <top style="thin"><color rgb="${NAVY}"/></top>
      <bottom style="thin"><color rgb="${NAVY}"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="${GOLD}"/></left>
      <right style="thin"><color rgb="${GOLD}"/></right>
      <top style="thin"><color rgb="${GOLD}"/></top>
      <bottom style="thin"><color rgb="${GOLD}"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="17">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="9" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="10" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="8" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="11" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleMedium4"/>
</styleSheet>`;

export type ColumnDef = {
  key: string;
  label: string;
  required: boolean;
  description: string;
  example?: string;
  width?: number;
  validation?: {
    type: "list";
    values: string[];
  };
  format?: "date" | "number" | "percent" | "text";
  headerPalette?: HeaderPalette;
};

type BuildTemplateConfig = {
  sheetName: string;
  title: string;
  subtitle: string;
  columns: ColumnDef[];
  exampleRows: Record<string, string>[];
  instrucciones: string[];
};

type CfbFileEntry = {
  name: string;
  content?: Buffer | Uint8Array | string;
};

type CfbContainer = {
  FileIndex: CfbFileEntry[];
};

type CfbApi = {
  read: (data: Buffer, options: { type: "buffer" }) => unknown;
  write: (
    container: unknown,
    options: { type: "buffer"; fileType: "zip" }
  ) => Buffer | Uint8Array;
};

export function buildXlsxTemplate(config: BuildTemplateConfig): Buffer {
  if (config.columns.length === 0) {
    throw new Error("No se puede construir una plantilla sin columnas.");
  }

  const dataRows = buildDataRows(config);
  const instructionRows = buildInstructionRows(config.sheetName, config.columns, config.instrucciones);

  const dataSheet = XLSX.utils.aoa_to_sheet(dataRows);
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionRows);

  const lastColumnIndex = config.columns.length - 1;
  const lastColumnLetter = XLSX.utils.encode_col(lastColumnIndex);
  const lastDataRow = Math.max(4 + config.exampleRows.length, 4);

  dataSheet["!cols"] = config.columns.map((column) => ({ wch: column.width ?? 18 }));
  dataSheet["!rows"] = [
    { hpt: 28 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 40 },
    ...config.exampleRows.map(() => ({ hpt: 22 }))
  ];
  dataSheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumnIndex } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumnIndex } }
  ];
  dataSheet["!autofilter"] = {
    ref: `A3:${lastColumnLetter}${lastDataRow}`
  };

  instructionsSheet["!cols"] = [{ wch: 55 }, { wch: 70 }];
  instructionsSheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, config.sheetName);
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instrucciones");

  const baseBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
    cellStyles: true
  }) as Buffer;

  return applyWorkbookStyling(baseBuffer, {
    columns: config.columns,
    exampleRowsCount: config.exampleRows.length,
    instructionRows,
    lastColumnLetter,
    lastDataRow
  });
}

function buildDataRows(config: BuildTemplateConfig): string[][] {
  const titleRow = config.columns.map((_, index) => (index === 0 ? config.title : ""));
  const subtitleRow = config.columns.map((_, index) => (index === 0 ? config.subtitle : ""));
  const headerRow = config.columns.map((column) => column.key);
  const descriptionRow = buildGuidanceRow(config.columns, config.exampleRows[0] ?? {});
  const exampleRows = config.exampleRows.map((row) =>
    config.columns.map((column) => {
      const value = row[column.key] ?? column.example ?? "";
      return String(value);
    })
  );

  return [titleRow, subtitleRow, headerRow, descriptionRow, ...exampleRows];
}

function buildInstructionRows(
  sheetName: string,
  columns: ColumnDef[],
  instrucciones: string[]
): string[][] {
  const enumColumns = columns.filter(
    (column) => column.validation?.type === "list" && column.validation.values.length > 0
  );

  const rows: string[][] = [
    ["Como usar esta plantilla", ""],
    ["Tipo de plantilla", sheetName],
    ["Instrucciones generales", ""],
    ...instrucciones.map((line, index) => [`${index + 1}. ${line}`, ""]),
    ["", ""],
    ["Descripcion de columnas", ""],
    ["Columna", "Descripcion"],
    ...columns.map((column) => [column.key, `${column.label}: ${column.description}`]),
    ["", ""],
    ["Valores permitidos (campos con lista)", ""],
    ["Columna", "Valores aceptados"]
  ];

  if (enumColumns.length === 0) {
    rows.push(["(No aplica)", ""]);
  } else {
    for (const column of enumColumns) {
      rows.push([column.key, column.validation!.values.join(" | ")]);
    }
  }

  rows.push(["", ""]);
  rows.push(["Formato de fechas", "YYYY-MM-DD (recomendado) o DD/MM/YYYY"]);
  rows.push(["Soporte", "Dudas: usar el boton ? en la aplicacion"]);

  return rows;
}

function buildGuidanceRow(
  columns: ColumnDef[],
  firstExampleRow: Record<string, string>
): string[] {
  return columns.map((column) => {
    const exampleValue = firstExampleRow[column.key];
    if (exampleValue && column.key.toLowerCase() !== "numerocontrato") {
      return String(exampleValue);
    }

    if (column.validation?.values.length) {
      return column.validation.values[0];
    }

    const key = column.key.toLowerCase();
    if (column.format === "date") {
      return "2025-01-01";
    }
    if (column.format === "number") {
      return "1";
    }
    if (column.format === "percent") {
      return "5";
    }
    if (key.includes("rut")) {
      return "12345678-k";
    }
    if (key.includes("email")) {
      return "contacto@empresa.cl";
    }
    if (key.includes("telefono")) {
      return "+56911112222";
    }
    if (key.includes("esgla") || key.includes("vigente")) {
      return "true";
    }
    if (key.includes("numerocontrato")) {
      return "C-GUIA-0001";
    }
    if (key.includes("localcodigo")) {
      return "L-101";
    }
    if (key === "codigo") {
      return "COD-GUIA";
    }
    if (key === "piso") {
      return "1";
    }
    if (key === "glam2") {
      return "100.0";
    }

    return column.description;
  });
}

function applyWorkbookStyling(
  buffer: Buffer,
  metadata: {
    columns: ColumnDef[];
    exampleRowsCount: number;
    instructionRows: string[][];
    lastColumnLetter: string;
    lastDataRow: number;
  }
): Buffer {
  const cfbApi = getCfbApi();
  const container = cfbApi.read(buffer, { type: "buffer" }) as CfbContainer;

  replaceXmlEntry(container, "styles.xml", STYLES_XML);

  const dataSheetXml = readXmlEntry(container, "sheet1.xml");
  const styledDataSheetXml = styleDataSheetXml(
    dataSheetXml,
    metadata.columns,
    metadata.exampleRowsCount,
    metadata.lastColumnLetter,
    metadata.lastDataRow
  );
  replaceXmlEntry(container, "sheet1.xml", styledDataSheetXml);

  const instructionsSheetXml = readXmlEntry(container, "sheet2.xml");
  const styledInstructionsSheetXml = styleInstructionsSheetXml(
    instructionsSheetXml,
    metadata.instructionRows.length
  );
  replaceXmlEntry(container, "sheet2.xml", styledInstructionsSheetXml);

  return cfbApi.write(container as unknown as object, {
    type: "buffer",
    fileType: "zip"
  }) as Buffer;
}

function getCfbApi(): CfbApi {
  const maybeXlsx = XLSX as unknown as {
    CFB?: CfbApi;
    default?: { CFB?: CfbApi };
  };

  const cfbApi = maybeXlsx.CFB ?? maybeXlsx.default?.CFB;
  if (!cfbApi) {
    throw new Error("La libreria xlsx no expone CFB para post-procesar estilos.");
  }

  return cfbApi;
}

function readXmlEntry(container: CfbContainer, entryName: string): string {
  const entry = container.FileIndex.find((item) => item.name === entryName);
  if (!entry?.content) {
    throw new Error(`No se encontro ${entryName} dentro del XLSX generado.`);
  }

  if (typeof entry.content === "string") {
    return entry.content;
  }

  return Buffer.from(entry.content).toString("utf8");
}

function replaceXmlEntry(container: CfbContainer, entryName: string, xml: string): void {
  const entry = container.FileIndex.find((item) => item.name === entryName);
  if (!entry) {
    throw new Error(`No se encontro ${entryName} para aplicar estilos.`);
  }
  entry.content = Buffer.from(xml, "utf8");
}

function styleDataSheetXml(
  xml: string,
  columns: ColumnDef[],
  exampleRowsCount: number,
  lastColumnLetter: string,
  lastDataRow: number
): string {
  let updated = xml;

  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const columnLetter = XLSX.utils.encode_col(columnIndex);
    const column = columns[columnIndex];

    updated = setCellStyle(updated, `${columnLetter}1`, STYLE.TITLE);
    updated = setCellStyle(updated, `${columnLetter}2`, STYLE.SUBTITLE);
    updated = setCellStyle(updated, `${columnLetter}3`, getHeaderStyle(column));
    updated = setCellStyle(
      updated,
      `${columnLetter}4`,
      column.required ? STYLE.DESCRIPTION_REQUIRED : STYLE.DESCRIPTION
    );

    for (let rowOffset = 0; rowOffset < exampleRowsCount; rowOffset += 1) {
      const rowNumber = 5 + rowOffset;
      updated = setCellStyle(updated, `${columnLetter}${rowNumber}`, STYLE.EXAMPLE);
    }
  }

  updated = withFrozenPane(updated, 5);
  return withDimensionRange(updated, `A3:${lastColumnLetter}${lastDataRow}`);
}

function styleInstructionsSheetXml(xml: string, totalRows: number): string {
  let updated = xml;
  updated = setCellStyle(updated, "A1", STYLE.INSTRUCTIONS_TITLE);

  const sectionRows = new Set<number>([3]);
  for (let row = 2; row <= totalRows; row += 1) {
    const cellA = `A${row}`;
    if (sectionRows.has(row)) {
      updated = setCellStyle(updated, cellA, STYLE.INSTRUCTIONS_SECTION);
    } else {
      updated = setCellStyle(updated, cellA, STYLE.INSTRUCTIONS_SECTION);
      updated = setCellStyle(updated, `B${row}`, STYLE.INSTRUCTIONS_SECTION);
    }
  }

  return updated;
}

function withFrozenPane(xml: string, rowNumber: number): string {
  const sheetViews = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${rowNumber - 1}" topLeftCell="A${rowNumber}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${rowNumber}" sqref="A${rowNumber}"/></sheetView></sheetViews>`;
  if (xml.includes("<sheetViews>")) {
    return xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, sheetViews);
  }
  return xml;
}

function withDimensionRange(xml: string, range: string): string {
  if (xml.includes("<dimension ref=")) {
    return xml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="${range}"/>`);
  }
  return xml;
}

function setCellStyle(xml: string, cellRef: string, styleId: number): string {
  const regex = new RegExp(`<c([^>]*\\br=\"${cellRef}\"[^>]*)>`, "g");

  return xml.replace(regex, (_match, attributes: string) => {
    if (/\bs=\"\d+\"/.test(attributes)) {
      return `<c${attributes.replace(/\bs=\"\d+\"/, ` s="${styleId}"`)}>`;
    }
    return `<c${attributes} s="${styleId}">`;
  });
}

function getHeaderStyle(column: ColumnDef): number {
  const palette = column.headerPalette ?? (column.required ? "gold" : "navy");

  if (palette === "gold") {
    return column.required ? STYLE.HEADER_GOLD_REQUIRED : STYLE.HEADER_GOLD;
  }
  if (palette === "teal") {
    return column.required ? STYLE.HEADER_TEAL_REQUIRED : STYLE.HEADER_TEAL;
  }
  if (palette === "slate") {
    return column.required ? STYLE.HEADER_SLATE_REQUIRED : STYLE.HEADER_SLATE;
  }
  return column.required ? STYLE.HEADER_NAVY_REQUIRED : STYLE.HEADER_NAVY;
}
