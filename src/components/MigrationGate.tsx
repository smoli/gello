import "./MigrationGate.css";

/**
 * c0079: shown instead of the board when a pre-epic milestone-format board is
 * opened. gello no longer reads the old format transparently — the board is
 * gated until the user runs the one-click, recoverable migration.
 */
export function MigrationGate({
  onMigrate,
  busy,
  error,
}: {
  onMigrate: () => void;
  /** Migration in flight — disables the button and shows progress. */
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className="migration-gate" role="dialog" aria-label="board needs migration">
      <div className="migration-gate-panel">
        <h1 className="migration-gate-title">This board needs migrating</h1>
        <p className="migration-gate-text">
          It's still in gello's old <strong>milestone</strong> format. Convert it
          to the new <strong>epic</strong> format to open it — <code>milestones/</code>{" "}
          becomes <code>epics/</code> and each <code>mNN</code> id becomes{" "}
          <code>eNN</code>.
        </p>
        <p className="migration-gate-note">
          The new files are written before the old ones are removed, so an
          interruption never leaves a half-migrated board. Back up (or commit)
          first if you'd like a restore point.
        </p>
        {error && (
          <p role="alert" className="migration-gate-error">
            {error}
          </p>
        )}
        <button
          type="button"
          className="migration-gate-button"
          onClick={onMigrate}
          disabled={busy}
        >
          {busy ? "Migrating…" : "Migrate board"}
        </button>
      </div>
    </div>
  );
}
