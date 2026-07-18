import "./SkillPrompt.css";

/** One-time prompt (c032) offering to install the gello discuss skill into
 *  the project's detected agent-skill directories. */
export function SkillPrompt({
  dirs,
  onInstall,
  onNotNow,
  onDontAsk,
}: {
  /** Skill directories that will receive the skill. */
  dirs: string[];
  onInstall: () => void;
  onNotNow: () => void;
  onDontAsk: () => void;
}) {
  return (
    <div className="skill-prompt" role="dialog" aria-label="install gello skill">
      <p className="skill-prompt-text">
        Install gello's agent skills (<strong>discuss</strong>,{" "}
        <strong>onboard</strong> + <strong>plan</strong>) into this project?
      </p>
      <ul className="skill-prompt-dirs">
        {dirs.map((dir) => (
          <li key={dir}>{dir}</li>
        ))}
      </ul>
      <div className="skill-prompt-actions">
        <button type="button" onClick={onInstall}>
          Install
        </button>
        <button type="button" onClick={onNotNow}>
          Not now
        </button>
        <button type="button" onClick={onDontAsk}>
          Don't ask again
        </button>
      </div>
    </div>
  );
}
