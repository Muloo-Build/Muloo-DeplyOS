ALTER TABLE "Client"
ADD COLUMN "additionalWebsites" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "linkedinUrl" TEXT,
ADD COLUMN "facebookUrl" TEXT,
ADD COLUMN "instagramUrl" TEXT,
ADD COLUMN "xUrl" TEXT,
ADD COLUMN "youtubeUrl" TEXT;
