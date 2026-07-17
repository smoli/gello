import { describe, expect, it } from "vitest";
import {
  ALL_SKILLS,
  DISCUSS_SKILL,
  ONBOARD_SKILL,
  SKILL_VERSION,
  installDecision,
  managedSkillFile,
  resolveInstallTargets,
  skillFilePath,
} from "./skills";

describe("ALL_SKILLS (c029)", () => {
  it("ships the discuss and onboard skills, each with a distinct folder", () => {
    expect(ALL_SKILLS).toContain(DISCUSS_SKILL);
    expect(ALL_SKILLS).toContain(ONBOARD_SKILL);
    const folders = ALL_SKILLS.map((s) => s.folder);
    expect(new Set(folders).size).toBe(folders.length);
  });

  it("onboard skill round-trips through the managed-file machinery", () => {
    const file = managedSkillFile(ONBOARD_SKILL);
    expect(file).toContain("name: gello-onboard");
    expect(installDecision(file, ONBOARD_SKILL)).toBe("skip");
  });

  it("onboard skill embeds the migration invariants (propose→confirm, clean tree, migration.md)", () => {
    const body = ONBOARD_SKILL.body.toLowerCase();
    expect(body).toContain("propose");
    expect(body).toContain("clean");
    expect(body).toContain("migration.md");
    expect(body).toContain("done"); // completed items → done cards
  });
});

describe("skillFilePath", () => {
  it("nests the skill folder + SKILL.md under the skills dir", () => {
    expect(skillFilePath("/p/.claude/skills", DISCUSS_SKILL)).toBe(
      "/p/.claude/skills/gello-discuss/SKILL.md",
    );
  });
});

describe("managedSkillFile", () => {
  it("appends a gello-managed marker with the version and a body hash", () => {
    const file = managedSkillFile(DISCUSS_SKILL);
    expect(file.startsWith(DISCUSS_SKILL.body)).toBe(true);
    expect(file).toMatch(
      new RegExp(`<!-- gello-managed v${SKILL_VERSION} [a-z0-9]+ -->\\n$`),
    );
  });

  it("round-trips: a freshly generated file is recognised as current", () => {
    expect(installDecision(managedSkillFile(DISCUSS_SKILL), DISCUSS_SKILL)).toBe(
      "skip",
    );
  });
});

describe("installDecision", () => {
  it("installs when no file exists", () => {
    expect(installDecision(null, DISCUSS_SKILL)).toBe("install");
  });

  it("updates a pristine managed file from an older version", () => {
    const old = { ...DISCUSS_SKILL, version: SKILL_VERSION - 1, body: DISCUSS_SKILL.body };
    const oldFile = managedSkillFile(old);
    expect(installDecision(oldFile, DISCUSS_SKILL)).toBe("update");
  });

  it("leaves a user-edited managed file untouched", () => {
    const edited = managedSkillFile(DISCUSS_SKILL).replace(
      "discuss",
      "discuss (my notes)",
    );
    expect(installDecision(edited, DISCUSS_SKILL)).toBe("skip");
  });

  it("never touches a file without the gello marker", () => {
    expect(installDecision("# someone else's skill\n", DISCUSS_SKILL)).toBe("skip");
  });
});

describe("resolveInstallTargets", () => {
  const claude = "/p/.claude/skills";
  const pi = "/p/.pi/skills";
  const agents = "/p/.agents/skills";

  it("installs into every detected location independently", () => {
    expect(resolveInstallTargets([claude, pi])).toEqual([claude, pi]);
  });

  it("prefers .agents/skills over .pi/skills when both exist (pi reads both)", () => {
    expect(resolveInstallTargets([claude, pi, agents])).toEqual([claude, agents]);
  });

  it("keeps .pi/skills when .agents/skills is absent", () => {
    expect(resolveInstallTargets([pi])).toEqual([pi]);
  });

  it("returns nothing for no detected locations", () => {
    expect(resolveInstallTargets([])).toEqual([]);
  });
});
