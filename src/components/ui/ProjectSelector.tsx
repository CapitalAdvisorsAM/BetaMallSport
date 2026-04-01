"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

type ProjectSelectorProps = {
  projects: Array<{ id: string; nombre: string }>;
  selectedProjectId: string;
  preserve?: Record<string, string | undefined>;
};

export function ProjectSelector({
  projects,
  selectedProjectId,
  preserve = {}
}: ProjectSelectorProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const projectSelectorId = "proyecto";

  const handleProjectChange = (nextProjectId: string): void => {
    const params = new URLSearchParams();
    params.set("proyecto", nextProjectId);

    Object.entries(preserve).forEach(([key, value]) => {
      if (!value || key === "proyecto") {
        return;
      }
      params.set(key, value);
    });

    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={projectSelectorId} className="text-sm font-medium text-slate-700">
        Proyecto
      </label>
      <Select value={selectedProjectId} onValueChange={handleProjectChange}>
        <SelectTrigger id={projectSelectorId} className="w-[200px]">
          <SelectValue placeholder="Selecciona un proyecto" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
