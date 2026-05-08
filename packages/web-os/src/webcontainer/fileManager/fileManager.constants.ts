/** Spec §5：独立 IndexedDB，避免与 `fileSystem` 的 snapshots store 纠缠。 */
export const FILE_MANAGER_IDB_NAME = "openclaw-wc-file-manager";

/** v2：`drive_registry`、`settings`；v1→v2 自 `tree_records` 回填注册表。 */
export const FILE_MANAGER_DB_VERSION = 2;

export const FILE_MANAGER_TREE_STORE = "tree_records";

/** §5：`FileManagerDriveRecord`，`keyPath: driveId` */
export const FILE_MANAGER_DRIVE_STORE = "drive_registry";

/** §5：`{ key, value }`，`keyPath: key` */
export const FILE_MANAGER_SETTINGS_STORE = "settings";

/** `settings` 中当前默认硬盘的 key */
export const FILE_MANAGER_SETTINGS_KEY_CURRENT_DRIVE = "currentDriveId";
