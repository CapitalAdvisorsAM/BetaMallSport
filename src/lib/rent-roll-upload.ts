import { buildErrorCsv, parseContractsFile } from "@/lib/upload/parse-contracts";

export { buildErrorCsv };

type ParseRentRollLegacyOptions = {
  existingContratos?: Parameters<typeof parseContractsFile>[1]["existingContratos"];
  existingLocalData?: Parameters<typeof parseContractsFile>[1]["existingLocalData"];
  existingLocalCodes?: Set<string>;
  existingArrendatarioNombres?: Parameters<typeof parseContractsFile>[1]["existingArrendatarioNombres"];
};

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

// @deprecated Usa parseContractsFile desde "@/lib/upload/parse-contratos".
export function parseRentRollFile(
  fileName: string,
  buffer: Buffer,
  options?: ParseRentRollLegacyOptions
) {
  const existingLocalData =
    options?.existingLocalData ??
    new Map(
      Array.from(options?.existingLocalCodes ?? new Set<string>()).map((codigo) => [codigo, { glam2: "1" }])
    );

  return parseContractsFile(toArrayBuffer(buffer), {
    fileName,
    existingContratos: options?.existingContratos ?? new Map(),
    existingLocalData,
    existingArrendatarioNombres: options?.existingArrendatarioNombres ?? new Map()
  });
}
