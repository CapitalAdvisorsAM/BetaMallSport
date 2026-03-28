"use client";

import { usePathname, useRouter } from "next/navigation";

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
      <label htmlFor="proyecto" className="text-sm font-medium text-slate-700">
        Proyecto
      </label>
      <select
        id="proyecto"
        value={selectedProjectId}
        onChange={(event) => handleProjectChange(event.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
