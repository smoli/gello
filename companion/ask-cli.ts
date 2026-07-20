// c0102: `gello ask` — the CLI surface for parking a question. pi has no MCP
// ("No MCP. Build CLI tools with READMEs", its own recommended pattern), so the
// agent asks by running a command. Claude reaches the same core through the
// `add_question` MCP tool; both are thin shells over askQuestion().
//
// The card is not the agent's to choose: the companion puts the run's card id
// in GELLO_CARD_ID when it spawns the agent, and an explicit --card is only
// accepted when it matches.

import { askQuestion } from "./ask.ts";
import { findBoardRoot } from "./core.ts";

const USAGE = "usage: gello ask [--card <id>] <question markdown>";

/** Run the `ask` subcommand. Returns a process exit code; all output goes
 *  through `write` so tests can read it. */
export function runAsk(
  argv: string[],
  env: Record<string, string | undefined>,
  cwd: string,
  write: (message: string) => void,
): number {
  let requested: string | null = null;
  const words: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--card") {
      requested = argv[++i] ?? null;
    } else {
      words.push(argv[i]);
    }
  }

  const markdown = words.join(" ").trim();
  if (markdown === "") {
    write(USAGE);
    return 1;
  }

  const scoped = env.GELLO_CARD_ID ?? null;
  if (requested !== null && scoped !== null && requested !== scoped) {
    write(`this run is for card ${scoped}; cannot ask on ${requested}`);
    return 1;
  }
  const cardId = scoped ?? requested;
  if (cardId === null) {
    write("no card in scope: set GELLO_CARD_ID or pass --card <id>");
    return 1;
  }

  const root = findBoardRoot(cwd);
  if (!root) {
    write(`no .gello board found from ${cwd}`);
    return 1;
  }

  try {
    askQuestion(root, cardId, markdown);
  } catch (error) {
    write((error as Error).message);
    return 1;
  }
  write(`question parked on ${cardId} — exit now; you resume when it is answered`);
  return 0;
}
