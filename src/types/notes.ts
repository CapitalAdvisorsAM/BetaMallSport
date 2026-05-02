export type AnalysisViewKey = "EERR" | "CDG";
export type NoteStatusKey = "OPEN" | "RESOLVED";

export type NoteUserRef = {
  id: string;
  name: string | null;
  email: string | null;
};

export type AnalysisNoteRow = {
  id: string;
  projectId: string;
  lineKey: string;
  view: AnalysisViewKey;
  body: string;
  status: NoteStatusKey;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  createdBy: NoteUserRef;
  updatedBy: NoteUserRef | null;
  resolvedBy: NoteUserRef | null;
};

export type AnalysisNoteListResponse = {
  data: AnalysisNoteRow[];
};
