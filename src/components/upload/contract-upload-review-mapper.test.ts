import { describe, expect, it } from "vitest";
import type { PreviewRow } from "@/types/upload";
import type { ContractDraftPayload } from "@/components/contracts/ContractForm";
import {
  previewRowToUploadDraft,
  uploadDraftToPreviewData
} from "@/components/upload/contract-upload-review-mapper";

type UploadRecord = Record<string, unknown>;

function makePreviewRow(data: UploadRecord): PreviewRow<UploadRecord> {
  return {
    rowNumber: 2,
    status: "NEW",
    data
  };
}

describe("contract-upload-review-mapper", () => {
  it("maps preview row to draft preserving contract and ggcc extras", () => {
    const row = makePreviewRow({
      numeroContrato: "C-900",
      localCodigo: "L-101",
      arrendatarioNombre: "ACME SPORT",

      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31",
      tarifaTipo: "FIJO_UF_M2",
      tarifaValor: "3.5",
      tarifaVigenciaDesde: "2026-01-01",
      tarifaVigenciaHasta: null,
      ggccTipo: "FIJO_UF",
      ggccValor: "120",
      ggccPctAdministracion: "8",
      ggccPctReajuste: "5",
      ggccMesesReajuste: 12
    });

    const mapped = previewRowToUploadDraft(row, "p1");

    expect(mapped.extras.numeroContrato).toBe("C-900");
    expect(mapped.draft.localIds[0]).toBe("L-101");
    expect(mapped.draft.arrendatarioId).toBe("ACME SPORT");
    expect(mapped.draft.tarifas[0]?.valor).toBe("3.5");
    expect(mapped.draft.ggcc[0]?.pctAdministracion).toBe("8");
  });

  it("maps draft back to preview payload preserving extras and nullable fields", () => {
    const draft: ContractDraftPayload = {
      proyectoId: "p1",
      localId: "L-102",
      localIds: ["L-102", "L-103"],
      arrendatarioId: "ACME SPORT",
      fechaInicio: "2027-01-01",
      fechaTermino: "2027-12-31",
      fechaEntrega: null,
      fechaApertura: null,

      rentaVariable: [],
      pctFondoPromocion: null,
      pctAdministracionGgcc: null,
      multiplicadorDiciembre: null,
      multiplicadorJunio: null,
      multiplicadorAgosto: null,
      codigoCC: null,
      pdfUrl: null,
      diasGracia: 0,
      notas: null,
      tarifas: [
        {
          _key: "t1",
          tipo: "FIJO_UF_M2",
          valor: "4.2",
          vigenciaDesde: "2027-01-01",
          vigenciaHasta: null,
          esDiciembre: false
        }
      ],
      ggcc: [
        {
          _key: "g1",
          tarifaBaseUfM2: "0.35",
          pctAdministracion: "9",
          pctReajuste: null,
          proximoReajuste: null,
          mesesReajuste: null
        }
      ],
      anexo: null
    };

    const payload = uploadDraftToPreviewData(draft, {
      numeroContrato: "C-901"
    });

    expect(payload.localCodigo).toBe("L-102");
    expect(payload.arrendatarioNombre).toBe("ACME SPORT");
    expect(payload.numeroContrato).toBe("C-901");
    expect(payload.ggccTipo).toBe("FIJO_UF_M2");
    expect(payload.ggccValor).toBe("0.35");
    expect(payload.anexoFecha).toBeNull();
    expect(payload.anexoDescripcion).toBeNull();
  });

  it("prioritizes localId over localIds[0] when serializing localCodigo", () => {
    const draft: ContractDraftPayload = {
      proyectoId: "p1",
      localId: "L-103",
      localIds: ["L-102", "L-103"],
      arrendatarioId: "ACME SPORT",
      fechaInicio: "2027-01-01",
      fechaTermino: "2027-12-31",
      fechaEntrega: null,
      fechaApertura: null,

      rentaVariable: [],
      pctFondoPromocion: null,
      pctAdministracionGgcc: null,
      multiplicadorDiciembre: null,
      multiplicadorJunio: null,
      multiplicadorAgosto: null,
      codigoCC: null,
      pdfUrl: null,
      diasGracia: 0,
      notas: null,
      tarifas: [],
      ggcc: [],
      anexo: null
    };

    const payload = uploadDraftToPreviewData(draft, {
      numeroContrato: "C-902"
    });

    expect(payload.localCodigo).toBe("L-103");
  });
});
