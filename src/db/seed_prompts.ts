import { readdir, readFile } from "fs/promises";
import { join } from "path";
import matter from "gray-matter";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { prompts } from "./schema";

interface PromptFrontmatter {
  title: string;
  description?: string;
}

export async function seedDefaultPrompts(
  db: BetterSQLite3Database,
  resourcesPath: string,
): Promise<void> {
  const promptsDir = join(resourcesPath, "default-prompts");

  try {
    const files = await readdir(promptsDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    for (const file of mdFiles) {
      const filePath = join(promptsDir, file);
      const fileContent = await readFile(filePath, "utf-8");
      const { data, content } = matter(fileContent);
      const frontmatter = data as PromptFrontmatter;

      // Check if prompt already exists by title
      const existing = db
        .select()
        .from(prompts)
        .where(eq(prompts.title, frontmatter.title))
        .get();

      if (!existing) {
        db.insert(prompts)
          .values({
            title: frontmatter.title,
            description: frontmatter.description || null,
            content: content.trim(),
            isReadOnly: true,
          })
          .run();

        console.log(`Seeded default prompt: ${frontmatter.title}`);
      }
    }
  } catch (error) {
    // If directory doesn't exist, skip seeding (dev mode)
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
