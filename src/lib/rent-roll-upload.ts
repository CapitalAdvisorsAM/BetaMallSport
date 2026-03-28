import { buildErrorCsv, parseContratosFile } from "@/lib/upload/parse-contratos";

export { buildErrorCsv };

type ParseRentRollLegacyOptions = {
  existingContratos?: Parameters<typeof parseContratosFile>[1]["existingContratos"];
  existingLocalCodes?: Parameters<typeof parseContratosFile>[1]["existingLocalCodes"];
  existingArrendatarioRuts?: Parameters<typeof parseContratosFile>[1]["existingArrendatarioRuts"];
};

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

// @deprecated Usa parseContratosFile desde "@/lib/upload/parse-contratos".
export function parseRentRollFile(
  fileName: string,
  buffer: Buffer,
  options?: ParseRentRollLegacyOptions
) {
  return parseContratosFile(toArrayBuffer(buffer), {
    fileName,
    existingContratos: options?.existingContratos ?? new Map(),
    existingLocalCodes: options?.existingLocalCodes ?? new Set(),
    existingArrendatarioRuts: options?.existingArrendatarioRuts ?? new Set()
  });
}
