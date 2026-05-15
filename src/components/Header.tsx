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
        className="cursor-pointer hover:text-red-200 px-2"
        type="button"
        onClick={() => onDelete()}
      >
        &times;
      </button>
    </div>
  );
}
