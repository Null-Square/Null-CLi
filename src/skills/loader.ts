import fs from "node:fs/promises";
import path from "node:path";

export interface PublicSkill {
  slug: string;
  name: string;
  description: string;
  category: string;
  content: string;
  path: string;
}

const FRONTMATTER_RE = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/;

const parseFrontmatter = (raw: string): { meta: Record<string, string>; body: string } => {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) meta[key.trim()] = rest.join(":").trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body: match[2] };
};

const walkMarkdown = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(fullPath)));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
};

export const loadPublicSkills = async (skillsRoot: string): Promise<PublicSkill[]> => {
  const root = path.resolve(skillsRoot);
  const files = await walkMarkdown(root);
  const skills: PublicSkill[] = [];
  for (const file of files) {
    const raw = await fs.readFile(file, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const relative = path.relative(root, file).replace(/\\/g, "/");
    const fallbackSlug = relative.replace(/\.md$/, "").replace(/\//g, "-");
    skills.push({
      slug: meta.slug || fallbackSlug,
      name: meta.name || fallbackSlug,
      description: meta.description || "Public Null CLI skill.",
      category: meta.category || relative.split("/")[0] || "general",
      content: body.trim(),
      path: relative,
    });
  }
  return skills.sort((left, right) => left.slug.localeCompare(right.slug));
};

export const loadSkillBySlug = async (skillsRoot: string, slug: string): Promise<PublicSkill | undefined> => {
  const skills = await loadPublicSkills(skillsRoot);
  return skills.find((skill) => skill.slug === slug);
};
