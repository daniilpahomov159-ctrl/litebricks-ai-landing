-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "contactRawEncrypted" TEXT,
ADD COLUMN IF NOT EXISTS "encryptionVersion" INTEGER DEFAULT 1;

