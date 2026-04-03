type ModuleEmptyStateProps = {
  message: string;
  actionHref?: string;
  actionLabel?: string;
};

export function ModuleEmptyState({
  message,
  actionHref,
  actionLabel
}: ModuleEmptyStateProps): JSX.Element {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
      <p>{message}</p>
      {actionHref && actionLabel ? (
        <a href={actionHref} className="text-brand-500 underline">
          {actionLabel}
        </a>
      ) : null}
    </div>
  );
}
