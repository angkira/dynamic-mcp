/*
  Warnings:

  - A unique constraint covering the columns `[responseToId]` on the table `Message` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "responseToId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Message_responseToId_key" ON "public"."Message"("responseToId");

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_responseToId_fkey" FOREIGN KEY ("responseToId") REFERENCES "public"."Message"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
