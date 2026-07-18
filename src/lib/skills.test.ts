import { describe, expect, it } from "vitest";
import {
  ALL_SKILLS,
  DISCUSS_SKILL,
  ONBOARD_SKILL,
  PLAN_SKILL,
  SKILL_VERSION,
  dirsNeedingInstall,
  installDecision,
  managedSkillFile,
  resolveInstallTargets,
  skillFilePath,
} from "./skills";

describe("dirsNeedingInstall (i0009)", () => {
  it("returns dirs with at least one missing/outdated skill", () => {
    const entries = [
      { dir: "/a", existing: null, skill: DISCUSS_SKILL }, // missing → needs install
      { dir: "/a", existing: managedSkillFile(ONBOARD_SKILL), skill: ONBOARD_SKILL },
    ];
    expect(dirsNeedingInstall(entries)).toEqual(["/a"]);
  });

  it("returns nothing when every skill is already present and current", () => {
    const entries = ALL_SKILLS.map((skill) => ({
      dir: "/a",
      existing: managedSkillFile(skill),
      skill,
    }));
    expect(dirsNeedingInstall(entries)).toEqual([]);
  });

  it("dedupes dirs and skips those fully satisfied", () => {
    const entries = [
      { dir: "/a", existing: managedSkillFile(DISCUSS_SKILL), skill: DISCUSS_SKILL },
      { dir: "/b", existing: null, skill: DISCUSS_SKILL },
      { dir: "/b", existing: null, skill: ONBOARD_SKILL },
    ];
    expect(dirsNeedingInstall(entries)).toEqual(["/b"]);
  });
});

describe("ALL_SKILLS (c029)", () => {
  it("ships the discuss, onboard, and plan skills, each with a distinct folder", () => {
    expect(ALL_SKILLS).toContain(DISCUSS_SKILL);
    expect(ALL_SKILLS).toContain(ONBOARD_SKILL);
    expect(ALL_SKILLS).toContain(PLAN_SKILL);
    const folders = ALL_SKILLS.map((s) => s.folder);
    expect(new Set(folders).size).toBe(folders.length);
  });

  it("c0081: no skill template still uses the old milestone vocabulary", () => {
    for (const skill of ALL_SKILLS) {
      expect(skill.body.toLowerCase()).not.toContain("milestone");
    }
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

  it("plan skill: gello-plan folder, round-trips, and is self-contained", () => {
    expect(PLAN_SKILL.folder).toBe("gello-plan");
    expect(PLAN_SKILL.version).toBe(SKILL_VERSION);
    const file = managedSkillFile(PLAN_SKILL);
    expect(file).toContain("name: gello-plan");
    expect(installDecision(file, PLAN_SKILL)).toBe("skip");
  });

  it("plan skill embeds the two-phase, epic-format invariants", () => {
    const body = PLAN_SKILL.body.toLowerCase();
    // two-phase, human-gated: plan into epic.md, then create only on approval
    expect(body).toContain("epic.md");
    expect(body).toContain("approv"); // approve/approval
    expect(body).toContain("depends"); // child cards wired by dependency
    expect(body).toContain("epics/"); // the epic folder home
    // nothing created before approval
    expect(body).toMatch(/before .*approv|only .*approv|approv.* before/);
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
