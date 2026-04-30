-- AlterTable: add record-count fields so we can distinguish "how many contacts"
-- from "how many contact properties". Property counts already exist; the new
-- record-count columns capture the actual CRM record totals per object type.
ALTER TABLE "PortalSnapshot"
  ADD COLUMN "contactRecordCount" INTEGER,
  ADD COLUMN "companyRecordCount" INTEGER,
  ADD COLUMN "dealRecordCount"    INTEGER,
  ADD COLUMN "ticketRecordCount"  INTEGER;
