-- CreateTable
CREATE TABLE "DictationPreference" (
    "ownerId" TEXT NOT NULL PRIMARY KEY,
    "language" TEXT NOT NULL DEFAULT 'auto',
    "recognitionMode" TEXT NOT NULL DEFAULT 'local'
);
