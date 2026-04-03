type ModuleLoadingStateProps = {
  message?: string;
};

export function ModuleLoadingState({
  message = "Cargando..."
}: ModuleLoadingStateProps): JSX.Element {
  return <div className="flex h-40 items-center justify-center text-sm text-slate-500">{message}</div>;
}
