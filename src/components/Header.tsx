export function Header({
  children,
  onDelete,
}: {
  children: string;
  onDelete: () => void;
}) {
  return (
    <div className="inline-flex items-center">
      <div className="text-xs">{children}</div>

      <button
        className="px-2 text-yellow-100/50 hover:text-white active:opacity-50"
        type="button"
        onClick={() => onDelete()}
      >
        &times;
      </button>
    </div>
  );
}
