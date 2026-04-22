import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NOW = new Date("2026-04-22T10:00:00.000Z");
const APRIL_START = new Date("2026-04-01T00:00:00.000Z");
const MARCH_START = new Date("2026-03-01T00:00:00.000Z");
const MAY_START = new Date("2026-05-01T00:00:00.000Z");
const ROLLOVER_EXPIRY = new Date("2026-06-29T23:59:59.000Z");

const ids = {
  workspaceUser: "phase-c1-operator",
  portal: "phase-c1-portal",
  client: "phase-c1-end-client",
  clientBillTo: "phase-c1-client-billto",
  agencyBillTo: "phase-c1-agency-billto",
  clientUser: "phase-c1-client-user",
  projectAgency: "phase-c1-project-agency",
  projectDirect: "phase-c1-project-direct",
  projectTopup: "phase-c1-project-topup",
  retainerAgency: "phase-c1-retainer-agency",
  retainerDirect: "phase-c1-retainer-direct",
  retainerTopup: "phase-c1-retainer-topup",
  agencyMarchPeriod: "phase-c1-agency-march",
  agencyAprilPeriod: "phase-c1-agency-april",
  directMarchPeriod: "phase-c1-direct-march",
  directAprilPeriod: "phase-c1-direct-april",
  topupAprilPeriod: "phase-c1-topup-april",
  directRolloverBucket: "phase-c1-direct-rollover",
  agencyInvoice: "phase-c1-invoice-agency",
  directInvoice: "phase-c1-invoice-direct",
  task10a: "phase-c1-task-10a",
  task10b: "phase-c1-task-10b",
  task10c: "phase-c1-task-10c",
  task10d: "phase-c1-task-10d",
  task5: "phase-c1-task-5",
  task6: "phase-c1-task-6"
};

async function main() {
  await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actor: "phase-c1-operator@muloo.dev" },
          { actor: "phase-c1.client@example.com" }
        ]
      }
    });

    await prisma.taskApproval.deleteMany({
      where: { projectId: { in: [ids.projectAgency, ids.projectDirect, ids.projectTopup] } }
    });

    await prisma.retainerLedgerEntry.deleteMany({
      where: {
        retainerPeriodId: {
          in: [
            ids.agencyMarchPeriod,
            ids.agencyAprilPeriod,
            ids.directMarchPeriod,
            ids.directAprilPeriod,
            ids.topupAprilPeriod
          ]
        }
      }
    });

    await prisma.retainerTopUp.deleteMany({
      where: { retainerPeriodId: { in: [ids.topupAprilPeriod] } }
    });

    await prisma.invoice.deleteMany({
      where: { id: { in: [ids.agencyInvoice, ids.directInvoice] } }
    });

    await prisma.rolloverBucket.deleteMany({
      where: { id: { in: [ids.directRolloverBucket] } }
    });

    await prisma.retainerPeriod.deleteMany({
      where: {
        id: {
          in: [
            ids.agencyMarchPeriod,
            ids.agencyAprilPeriod,
            ids.directMarchPeriod,
            ids.directAprilPeriod,
            ids.topupAprilPeriod
          ]
        }
      }
    });

    await prisma.task.deleteMany({
      where: {
        id: {
          in: [
            ids.task10a,
            ids.task10b,
            ids.task10c,
            ids.task10d,
            ids.task5,
            ids.task6
          ]
        }
      }
    });

    await prisma.clientProjectAccess.deleteMany({
      where: { projectId: { in: [ids.projectAgency, ids.projectDirect, ids.projectTopup] } }
    });

    await prisma.project.deleteMany({
      where: { id: { in: [ids.projectAgency, ids.projectDirect, ids.projectTopup] } }
    });

    await prisma.retainer.deleteMany({
      where: {
        id: { in: [ids.retainerAgency, ids.retainerDirect, ids.retainerTopup] }
      }
    });

    await prisma.billToEntity.deleteMany({
      where: { id: { in: [ids.clientBillTo, ids.agencyBillTo] } }
    });

    await prisma.clientPortalUser.deleteMany({ where: { id: ids.clientUser } });
    await prisma.client.deleteMany({ where: { id: ids.client } });
    await prisma.hubSpotPortal.deleteMany({ where: { id: ids.portal } });
    await prisma.workspaceUser.deleteMany({ where: { id: ids.workspaceUser } });

    await prisma.workspaceUser.create({
      data: {
        id: ids.workspaceUser,
        name: "Phase C1 Operator",
        email: "phase-c1-operator@muloo.dev",
        password: "phasec1-admin",
        role: "Operations",
        isActive: true,
        sortOrder: 1
      }
    });

    await prisma.hubSpotPortal.create({
      data: {
        id: ids.portal,
        portalId: "phase-c1-demo-portal",
        displayName: "Phase C1 Acceptance Portal",
        connected: false
      }
    });

    await prisma.client.create({
      data: {
        id: ids.client,
        name: "Phase C1 End Client",
        slug: "phase-c1-end-client",
        clientRoles: ["client"],
        hubSpotPortalId: ids.portal,
        website: "https://phase-c1.example.com"
      }
    });

    await prisma.billToEntity.create({
      data: {
        id: ids.clientBillTo,
        name: "Phase C1 End Client",
        type: "CLIENT",
        clientId: ids.client
      }
    });

    await prisma.billToEntity.create({
      data: {
        id: ids.agencyBillTo,
        name: "Tusk Agency (Phase C1)",
        type: "PARTNER_AGENCY",
        vatNumber: "ZA123456789",
        address: "123 Agency Road, Cape Town",
        primaryContactEmail: "finance@tusk.example.com",
        primaryContactName: "Tusk Finance"
      }
    });

    await prisma.clientPortalUser.create({
      data: {
        id: ids.clientUser,
        firstName: "Paige",
        lastName: "Client",
        email: "phase-c1.client@example.com",
        password: "phasec1-client"
      }
    });

    await prisma.retainer.create({
      data: {
        id: ids.retainerAgency,
        clientId: ids.client,
        billToEntityId: ids.agencyBillTo,
        serviceLine: "TECHNICAL_DELIVERY",
        blockSize: 40,
        rate: "1700.00",
        currency: "ZAR",
        startDate: MARCH_START,
        status: "ACTIVE"
      }
    });

    await prisma.retainer.create({
      data: {
        id: ids.retainerDirect,
        clientId: ids.client,
        billToEntityId: ids.clientBillTo,
        serviceLine: "TECHNICAL_DELIVERY",
        blockSize: 40,
        rate: "1700.00",
        currency: "ZAR",
        startDate: MARCH_START,
        status: "ACTIVE"
      }
    });

    await prisma.retainer.create({
      data: {
        id: ids.retainerTopup,
        clientId: ids.client,
        billToEntityId: ids.clientBillTo,
        serviceLine: "TECHNICAL_DELIVERY",
        blockSize: 40,
        rate: "1700.00",
        currency: "ZAR",
        startDate: APRIL_START,
        status: "ACTIVE"
      }
    });

    await prisma.project.createMany({
      data: [
        {
          id: ids.projectAgency,
          name: "Phase C1 Agency-Billed Project",
          status: "active",
          owner: "Phase C1 Operator",
          ownerEmail: "phase-c1-operator@muloo.dev",
          clientId: ids.client,
          portalId: ids.portal,
          retainerId: ids.retainerAgency
        },
        {
          id: ids.projectDirect,
          name: "Phase C1 Direct-Billed Project",
          status: "active",
          owner: "Phase C1 Operator",
          ownerEmail: "phase-c1-operator@muloo.dev",
          clientId: ids.client,
          portalId: ids.portal,
          retainerId: ids.retainerDirect
        },
        {
          id: ids.projectTopup,
          name: "Phase C1 Top-Up Project",
          status: "active",
          owner: "Phase C1 Operator",
          ownerEmail: "phase-c1-operator@muloo.dev",
          clientId: ids.client,
          portalId: ids.portal,
          retainerId: ids.retainerTopup
        }
      ]
    });

    await prisma.clientProjectAccess.createMany({
      data: [
        { userId: ids.clientUser, projectId: ids.projectAgency, role: "owner" },
        { userId: ids.clientUser, projectId: ids.projectDirect, role: "owner" },
        { userId: ids.clientUser, projectId: ids.projectTopup, role: "owner" }
      ]
    });

    await prisma.retainerPeriod.createMany({
      data: [
        {
          id: ids.agencyMarchPeriod,
          retainerId: ids.retainerAgency,
          periodMonth: MARCH_START,
          blockHours: 40,
          consumedHours: "40.00",
          status: "CLOSED"
        },
        {
          id: ids.agencyAprilPeriod,
          retainerId: ids.retainerAgency,
          periodMonth: APRIL_START,
          blockHours: 40,
          consumedHours: "12.00",
          status: "OPEN"
        },
        {
          id: ids.directMarchPeriod,
          retainerId: ids.retainerDirect,
          periodMonth: MARCH_START,
          blockHours: 40,
          consumedHours: "35.00",
          rolledOutHours: 5,
          status: "CLOSED"
        },
        {
          id: ids.directAprilPeriod,
          retainerId: ids.retainerDirect,
          periodMonth: APRIL_START,
          blockHours: 40,
          rolledInHours: 5,
          consumedHours: "20.00",
          status: "OPEN"
        },
        {
          id: ids.topupAprilPeriod,
          retainerId: ids.retainerTopup,
          periodMonth: APRIL_START,
          blockHours: 40,
          consumedHours: "0.00",
          status: "OPEN"
        }
      ]
    });

    await prisma.rolloverBucket.create({
      data: {
        id: ids.directRolloverBucket,
        retainerId: ids.retainerDirect,
        hoursOriginal: "5.00",
        hoursRemaining: "5.00",
        earnMonth: MARCH_START,
        expiresAt: ROLLOVER_EXPIRY,
        status: "ACTIVE"
      }
    });

    await prisma.invoice.createMany({
      data: [
        {
          id: ids.agencyInvoice,
          reference: "PHASE-C1-AGENCY-001",
          billToEntityId: ids.agencyBillTo,
          retainerId: ids.retainerAgency,
          retainerPeriodId: ids.agencyMarchPeriod,
          invoiceType: "RETAINER_BLOCK",
          amount: "68000.00",
          currency: "ZAR",
          issueDate: new Date("2026-04-02T00:00:00.000Z"),
          dueDate: new Date("2026-04-16T00:00:00.000Z"),
          xeroUrl: "https://go.xero.com/phase-c1-agency-001",
          status: "SENT",
          createdByUserId: ids.workspaceUser,
          sentAt: new Date("2026-04-02T00:00:00.000Z"),
          notes: "Agency-billed retainer block"
        },
        {
          id: ids.directInvoice,
          reference: "PHASE-C1-CLIENT-001",
          billToEntityId: ids.clientBillTo,
          retainerId: ids.retainerDirect,
          retainerPeriodId: ids.directMarchPeriod,
          invoiceType: "RETAINER_BLOCK",
          amount: "68000.00",
          currency: "ZAR",
          issueDate: new Date("2026-04-03T00:00:00.000Z"),
          dueDate: new Date("2026-04-17T00:00:00.000Z"),
          xeroUrl: "https://go.xero.com/phase-c1-client-001",
          status: "SENT",
          createdByUserId: ids.workspaceUser,
          sentAt: new Date("2026-04-03T00:00:00.000Z"),
          notes: "Client-billed retainer block"
        }
      ]
    });

    await prisma.task.createMany({
      data: [
        {
          id: ids.task10a,
          projectId: ids.projectTopup,
          title: "Phase C1 Top-Up Task 10A",
          status: "complete",
          plannedHours: 10,
          executionType: "manual"
        },
        {
          id: ids.task10b,
          projectId: ids.projectTopup,
          title: "Phase C1 Top-Up Task 10B",
          status: "complete",
          plannedHours: 10,
          executionType: "manual"
        },
        {
          id: ids.task10c,
          projectId: ids.projectTopup,
          title: "Phase C1 Top-Up Task 10C",
          status: "complete",
          plannedHours: 10,
          executionType: "manual"
        },
        {
          id: ids.task10d,
          projectId: ids.projectTopup,
          title: "Phase C1 Top-Up Task 10D",
          status: "complete",
          plannedHours: 10,
          executionType: "manual"
        },
        {
          id: ids.task5,
          projectId: ids.projectTopup,
          title: "Phase C1 Top-Up Task 5",
          status: "complete",
          plannedHours: 5,
          executionType: "manual"
        },
        {
          id: ids.task6,
          projectId: ids.projectTopup,
          title: "Phase C1 Top-Up Task 6",
          status: "complete",
          plannedHours: 6,
          executionType: "manual"
        }
      ]
    });

  console.log(
    JSON.stringify(
      {
        operator: {
          email: "phase-c1-operator@muloo.dev",
          password: "phasec1-admin"
        },
        clientUser: {
          email: "phase-c1.client@example.com",
          password: "phasec1-client"
        },
        projects: {
          agency: ids.projectAgency,
          direct: ids.projectDirect,
          topup: ids.projectTopup
        },
        retainers: {
          agency: ids.retainerAgency,
          direct: ids.retainerDirect,
          topup: ids.retainerTopup
        },
        now: NOW.toISOString(),
        nextPeriodMonth: MAY_START.toISOString()
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
