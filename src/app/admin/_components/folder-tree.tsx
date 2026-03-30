import Link from "next/link";

type FolderTreeProps = {
  folders: string[];
  selectedFolder: string;
  selectedView: "queue" | "done";
};

function itemClasses(isActive: boolean) {
  return isActive
    ? "block rounded-xl border border-[#F4D400] bg-[#F4D400]/30 px-3 py-2 text-sm font-semibold text-[#111827]"
    : "block rounded-xl px-3 py-2 text-sm text-[#111827] hover:bg-[#F7F7F8]";
}

function getFolderDepth(folderPath: string) {
  return Math.max(folderPath.split("/").length - 1, 0);
}

export default function FolderTree({
  folders,
  selectedFolder,
  selectedView,
}: FolderTreeProps) {
  return (
    <aside className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Workspace</h2>
      <div className="mt-3 space-y-1">
        <Link href="/admin?view=queue&folder=all" className={itemClasses(selectedView === "queue" && selectedFolder === "all")}>
          Queue / All Folders
        </Link>
        {folders.map((folder) => (
          <Link
            key={folder}
            href={`/admin?view=queue&folder=${encodeURIComponent(folder)}`}
            className={itemClasses(selectedView === "queue" && selectedFolder === folder)}
            style={{ paddingLeft: `${12 + getFolderDepth(folder) * 14}px` }}
          >
            {folder.split("/").pop()}
          </Link>
        ))}
      </div>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Archive</h3>
      <div className="mt-2 space-y-1">
        <Link
          href="/admin?view=done"
          className={itemClasses(selectedView === "done")}
        >
          Done Jobs
        </Link>
      </div>
    </aside>
  );
}
