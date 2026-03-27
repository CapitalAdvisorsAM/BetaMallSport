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
  return (
    <form className="flex items-center gap-2">
      {Object.entries(preserve).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null
      )}
      <label htmlFor="proyecto" className="text-sm font-medium text-slate-700">
        Proyecto
      </label>
      <select
        id="proyecto"
        name="proyecto"
        defaultValue={selectedProjectId}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.nombre}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Cambiar
      </button>
    </form>
  );
}
