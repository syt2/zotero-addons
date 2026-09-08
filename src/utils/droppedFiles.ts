/** Read the complete native file list before deciding whether to take the drop. */
function readDroppedXPIPaths(transfer: DataTransfer | null): string[] {
  if (!transfer) return [];
  const paths = new Set<string>();
  const types = Array.from(transfer.types);
  if (types.some((type) => type.startsWith("zotero/"))) {
    return [];
  }
  if (!types.includes("Files") && !types.includes("application/x-moz-file")) {
    return [];
  }
  if (types.includes("application/x-moz-file")) {
    for (let index = 0; index < transfer.mozItemCount; index++) {
      try {
        const file = transfer.mozGetDataAt("application/x-moz-file", index) as {
          path?: string;
        } | null;
        if (!file?.path) {
          paths.clear();
          break;
        }
        paths.add(file.path);
      } catch {
        // Fall back to the complete DOM file list below.
        paths.clear();
        break;
      }
    }
  }
  if (!paths.size) {
    const files = Array.from(transfer.files ?? []);
    // Never install a subset when Gecko could not expose every native item.
    if (transfer.mozItemCount && files.length !== transfer.mozItemCount)
      return [];
    for (const file of files) {
      if (!file.mozFullPath) return [];
      paths.add(file.mozFullPath);
    }
  }
  if (!paths.size || [...paths].some((path) => !/\.xpi$/i.test(path))) {
    return [];
  }
  return [...paths];
}

/** Unavailable drag data must leave the original event untouched. */
export function getDroppedXPIPaths(transfer: DataTransfer | null): string[] {
  try {
    return readDroppedXPIPaths(transfer);
  } catch {
    return [];
  }
}

export function droppedFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}
