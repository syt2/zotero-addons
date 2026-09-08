import { getString } from "../utils/locale";
import { droppedFileName, getDroppedXPIPaths } from "../utils/droppedFiles";
import {
  installLocalAddon,
  LocalAddonInstallError,
} from "../services/LocalAddonInstallService";

function confirmInstall(win: Window, paths: string[]): boolean {
  return (
    Services.prompt.confirmEx(
      win as unknown as mozIDOMWindowProxy,
      getString("xpi-drop-title"),
      getString("xpi-drop-message", {
        args: { files: paths.map(droppedFileName).join("\n") },
      }),
      Services.prompt.BUTTON_POS_0! * Services.prompt.BUTTON_TITLE_IS_STRING! +
        Services.prompt.BUTTON_POS_1! * Services.prompt.BUTTON_TITLE_IS_STRING!,
      getString("xpi-drop-install"),
      getString("xpi-drop-cancel"),
      "",
      "",
      { value: false },
    ) === 0
  );
}

async function installFiles(
  win: Window,
  paths: string[],
  isActive: () => boolean,
): Promise<void> {
  for (const path of paths) {
    if (!isActive()) return;
    const name = droppedFileName(path);
    let failure: { error: unknown } | undefined;
    try {
      if (!(await installLocalAddon(path, isActive))) return;
    } catch (error) {
      failure = { error };
      ztoolkit.log("Failed to install dropped XPI", path, error);
    }
    if (!isActive()) return;

    // Notification failures are not installation failures, and must not prevent
    // subsequent packages from installing or escape as unhandled rejections.
    try {
      if (failure) {
        const { error } = failure;
        const detail =
          error instanceof LocalAddonInstallError
            ? getString(
                error.reason === "incompatible"
                  ? "install-failed-uncompatible"
                  : "xpi-drop-invalid",
              )
            : String(error);
        Services.prompt.alert(
          win as unknown as mozIDOMWindowProxy,
          getString("xpi-drop-title"),
          `${getString("install-failed", { args: { name } })}\n${detail}`,
        );
      } else {
        new ztoolkit.ProgressWindow(getString("addon-name"))
          .createLine({
            text: getString("install-succeed", { args: { name } }),
            type: "success",
          })
          .show(3000);
      }
    } catch (error) {
      ztoolkit.log("Failed to report dropped XPI installation result", error);
    }
  }
}

const registrations = new Map<Window, () => void>();

export function registerXPIDropInstaller(win: Window): void {
  if (registrations.has(win)) return;
  let disposed = false;
  let confirming = false;
  const isActive = () => !disposed && !win.closed;
  const acceptDrag = (event: DragEvent) => {
    if (!isActive() || !getDroppedXPIPaths(event.dataTransfer).length) return;
    event.preventDefault();
    // Let Zotero retain its copy/move/link choice for the Cancel path.
  };
  const drop = (event: DragEvent) => {
    if (!isActive() || confirming) return;
    const paths = getDroppedXPIPaths(event.dataTransfer);
    if (!paths.length) return;

    // Keep this synchronous: Cancel must continue the original trusted event,
    // with its original target, modifiers and DataTransfer still intact.
    let confirmed: boolean;
    confirming = true;
    try {
      confirmed = confirmInstall(win, paths);
    } catch (error) {
      ztoolkit.log("Failed to confirm dropped XPI", error);
      return;
    } finally {
      confirming = false;
    }
    if (!confirmed) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // Installing reads the source package; it must never request a move from
    // the file manager. Change the effect only after the user chose Install.
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    void installFiles(win, paths, isActive).catch((error) => {
      ztoolkit.log("Dropped XPI installation task failed", error);
    });
  };
  win.addEventListener("dragover", acceptDrag, true);
  win.addEventListener("drop", drop, true);
  registrations.set(win, () => {
    disposed = true;
    win.removeEventListener("dragover", acceptDrag, true);
    win.removeEventListener("drop", drop, true);
  });
}

export function unregisterXPIDropInstaller(win: Window): void {
  registrations.get(win)?.();
  registrations.delete(win);
}

export function unregisterAllXPIDropInstallers(): void {
  for (const win of registrations.keys()) unregisterXPIDropInstaller(win);
}
