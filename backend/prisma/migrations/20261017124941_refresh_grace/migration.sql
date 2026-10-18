-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "previousTokenHash" TEXT,
ADD COLUMN     "rotatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Session_previousTokenHash_key" ON "Session"("previousTokenHash");
