ALTER TABLE "Task" ADD COLUMN "assignedAgentId" TEXT;

ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedAgentId_fkey"
FOREIGN KEY ("assignedAgentId") REFERENCES "AgentDefinition"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
