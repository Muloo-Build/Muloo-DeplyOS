import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const projectsDirectory = path.resolve(process.cwd(), "data", "projects");
  const entries = await fs.readdir(projectsDirectory).catch(() => []);
  const projectFiles = entries.filter((entry) => entry.endsWith(".json"));

  for (const fileName of projectFiles) {
    const filePath = path.join(projectsDirectory, fileName);
    const raw = await fs.readFile(filePath, "utf8");
    const projectData = JSON.parse(raw) as Record<string, unknown>;
    const projectId =
      typeof projectData.id === "string" ? projectData.id : path.basename(fileName, ".json");

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      console.info(`Skipped ${projectId}: no matching Prisma project record.`);
      continue;
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        discoveryData: projectData,
        blueprintData:
          typeof projectData.blueprint === "object" && projectData.blueprint
            ? (projectData.blueprint as Record<string, unknown>)
            : undefined,
        standardsData:
          typeof projectData.standards === "object" && projectData.standards
            ? (projectData.standards as Record<string, unknown>)
            : undefined
      }
    });

    console.info(`Migrated ${projectId} from filesystem JSON to Prisma.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
