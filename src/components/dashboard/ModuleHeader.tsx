import type { ReactNode } from "react";
import { ProjectSelector } from "@/components/ui/ProjectSelector";

type ProjectOption = {
  id: string;
  nombre: string;
};

type ModuleHeaderProps = {
  title: string;
  description: string;
  projects: ProjectOption[];
  selectedProjectId: string;
  preserve?: Record<string, string | undefined>;
  actions?: ReactNode;
  showProjectSelector?: boolean;
};

export function ModuleHeader({
  title,
  description,
  projects,
  selectedProjectId,
  preserve,
  actions,
  showProjectSelector = true
}: ModuleHeaderProps): JSX.Element {
  return (
    <header className="rounded-md bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gold-400" />
            <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {actions}
          {showProjectSelector ? (
            <ProjectSelector
              projects={projects}
              selectedProjectId={selectedProjectId}
              preserve={preserve}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
