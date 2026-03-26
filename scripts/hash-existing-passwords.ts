import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isBcryptHash(value: string | null | undefined) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function main() {
  const workspaceUsers = await prisma.workspaceUser.findMany({
    where: {
      password: {
        not: null
      }
    }
  });
  const clientUsers = await prisma.clientPortalUser.findMany({
    where: {
      password: {
        not: null
      }
    }
  });

  let updatedCount = 0;

  for (const user of workspaceUsers) {
    if (!user.password || isBcryptHash(user.password)) {
      continue;
    }

    await prisma.workspaceUser.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(user.password, 12)
      }
    });
    updatedCount += 1;
  }

  for (const user of clientUsers) {
    if (!user.password || isBcryptHash(user.password)) {
      continue;
    }

    await prisma.clientPortalUser.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(user.password, 12)
      }
    });
    updatedCount += 1;
  }

  console.info(`Hashed ${updatedCount} plaintext password(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
