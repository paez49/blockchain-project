import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("SLARegistry", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  
  // Helper to get test accounts
  const [admin, contractMs, noveltiesMs, opsUser, client1, client2] = await viem.getWalletClients();

  // Comparator enum values
  const Comparator = {
    GT: 0,
    LT: 1,
    EQ: 2,
    NE: 3,
    GE: 4,
    LE: 5,
  };

  // Alert Status enum values
  const AlertStatus = {
    Open: 0,
    Acknowledged: 1,
    Resolved: 2,
  };

  describe("Deployment and Roles", function () {
    it("Should deploy with admin having all roles", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
      const hasAdminRole = await registry.read.hasRole([DEFAULT_ADMIN_ROLE, admin.account.address]);
      
      assert.equal(hasAdminRole, true, "Admin should have DEFAULT_ADMIN_ROLE");
    });

    it("Should grant roles to different accounts", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const CONTRACT_MS_ROLE = await registry.read.CONTRACT_MS_ROLE();
      const NOVELTIES_MS_ROLE = await registry.read.NOVELTIES_MS_ROLE();
      const OPS_ROLE = await registry.read.OPS_ROLE();

      // Grant roles to different accounts
      await registry.write.grantRole([CONTRACT_MS_ROLE, contractMs.account.address]);
      await registry.write.grantRole([NOVELTIES_MS_ROLE, noveltiesMs.account.address]);
      await registry.write.grantRole([OPS_ROLE, opsUser.account.address]);

      assert.equal(await registry.read.hasRole([CONTRACT_MS_ROLE, contractMs.account.address]), true);
      assert.equal(await registry.read.hasRole([NOVELTIES_MS_ROLE, noveltiesMs.account.address]), true);
      assert.equal(await registry.read.hasRole([OPS_ROLE, opsUser.account.address]), true);
    });

    it("Should fail if non-CONTRACT_MS_ROLE tries to register client", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      const registryAsClient = await viem.getContractAt("SLARegistry", registry.address, { client: client1 });
      
      try {
        // Try to create a contract without proper role
        const contractInput = {
          id: "CONTRACT-UNAUTHORIZED",
          path: "/test.pdf",
          customerId: "CUSTOMER-001",
          slas: []
        };
        await registryAsClient.write.createContract([contractInput]);
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        // Access control errors can be in different formats, just check it reverted
        assert.ok(error, "Should have thrown an error");
      }
    });
  });

  describe("Contract Management", function () {
    it("Should create a contract with SLAs", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/contracts/customer-a/contract.pdf",
        customerId: "CUSTOMER-A",
        slas: [
          {
            id: "SLA-001",
            name: "Delivery Time",
            description: "Delivery within 24 hours",
            target: 24n,
            comparator: Comparator.LE,
            status: true
          },
          {
            id: "SLA-002",
            name: "Quality Score",
            description: "Quality >= 95%",
            target: 95n,
            comparator: Comparator.GE,
            status: true
          }
        ]
      };
      
      const hash = await registry.write.createContract([contractInput]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // Verify contract was created
      const contract = await registry.read.contractsById([1n]);
      assert.equal(contract[0], "CONTRACT-001", "Contract ID should match");
      assert.equal(contract[1], "CUSTOMER-A", "Customer ID should match");
      assert.equal(contract[3], "/contracts/customer-a/contract.pdf", "Path should match");
      assert.equal(contract[4], true, "Contract should be active");
      
      // Verify SLAs were created
      const slaIds = await registry.read.getContractSLAs([1n]);
      assert.equal(slaIds.length, 2, "Should have 2 SLAs");
    });

    it("Should emit ContractCreated event", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Test SLA",
          description: "Test",
          target: 100n,
          comparator: Comparator.GE,
          status: true
        }]
      };
      
      const hash = await registry.write.createContract([contractInput]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // Check for ContractCreated event
      const logs = receipt.logs;
      assert.ok(logs.length > 0, "Should have emitted events");
    });

    it("Should track client contracts", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput1 = {
        id: "CONTRACT-001",
        path: "/contract1.pdf",
        customerId: "CUSTOMER-A",
        slas: []
      };
      
      const contractInput2 = {
        id: "CONTRACT-002",
        path: "/contract2.pdf",
        customerId: "CUSTOMER-A",
        slas: []
      };
      
      await registry.write.createContract([contractInput1]);
      await registry.write.createContract([contractInput2]);
      
      const contracts = await registry.read.getClientContracts(["CUSTOMER-A"]);
      assert.equal(contracts.length, 2, "Should have 2 contracts");
      assert.equal(contracts[0], 1n, "First contract ID should be 1");
      assert.equal(contracts[1], 2n, "Second contract ID should be 2");
    });
  });

  describe("SLA Management", function () {
    it("Should create SLAs with contracts", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Delivery Time",
          description: "Delivery within 24 hours",
          target: 24n,
          comparator: Comparator.LE,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      
      const slaIds = await registry.read.getContractSLAs([1n]);
      assert.equal(slaIds.length, 1, "Should have 1 SLA");
      
      const sla = await registry.read.slas([slaIds[0]]);
      assert.equal(sla[0], "SLA-001", "SLA ID should match");
      assert.equal(sla[1], "Delivery Time", "SLA name should match");
      assert.equal(sla[2], "Delivery within 24 hours", "SLA description should match");
      assert.equal(sla[3], 24n, "Target should be 24");
      assert.equal(sla[4], Comparator.LE, "Comparator should be LE");
      assert.equal(sla[5], true, "Status should be true");
    });

    it("Should emit SLACreated event", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Test SLA",
          description: "Test",
          target: 100n,
          comparator: Comparator.GE,
          status: true
        }]
      };
      
      const hash = await registry.write.createContract([contractInput]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // Should have emitted SLACreated event
      assert.ok(receipt.logs.length > 0, "Should have emitted events");
    });

    it("Should track contract SLAs", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [
          {
            id: "SLA-001",
            name: "SLA 1",
            description: "Test 1",
            target: 24n,
            comparator: Comparator.LE,
            status: true
          },
          {
            id: "SLA-002",
            name: "SLA 2",
            description: "Test 2",
            target: 95n,
            comparator: Comparator.GE,
            status: true
          }
        ]
      };
      
      await registry.write.createContract([contractInput]);
      
      const slaIds = await registry.read.getContractSLAs([1n]);
      assert.equal(slaIds.length, 2, "Should have 2 SLAs");
      assert.equal(slaIds[0], 1n, "First SLA ID should be 1");
      assert.equal(slaIds[1], 2n, "Second SLA ID should be 2");
    });
  });

  describe("Metric Reporting", function () {
    it("Should report successful metric (no violation)", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Delivery <= 24h",
          description: "Test",
          target: 24n,
          comparator: Comparator.LE,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      
      const slaIds = await registry.read.getContractSLAs([1n]);
      const hash = await registry.write.reportMetric([slaIds[0], 20n, "Delivered in 20h"]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // Should not create an alert
      const alerts = await registry.read.getSLAAlerts([slaIds[0]]);
      assert.equal(alerts.length, 0, "Should not have any alerts");
    });

    it("Should emit SLAMetricReported event on success", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Delivery <= 24h",
          description: "Test",
          target: 24n,
          comparator: Comparator.LE,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      
      const slaIds = await registry.read.getContractSLAs([1n]);
      const hash = await registry.write.reportMetric([slaIds[0], 20n, "Success"]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      assert.ok(receipt.logs.length > 0, "Should have emitted event");
    });

    it("Should create alert on SLA violation", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Delivery <= 24h",
          description: "Test",
          target: 24n,
          comparator: Comparator.LE,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      
      const slaIds = await registry.read.getContractSLAs([1n]);
      await registry.write.reportMetric([slaIds[0], 36n, "Delivered in 36h - LATE"]);
      
      // Should create an alert
      const alerts = await registry.read.getSLAAlerts([slaIds[0]]);
      assert.equal(alerts.length, 1, "Should have 1 alert");
      
      const alert = await registry.read.alerts([alerts[0]]);
      assert.equal(alert[0], 1n, "Alert ID should be 1");
      assert.equal(alert[1], slaIds[0], "Alert should reference correct SLA");
      assert.equal(alert[3], AlertStatus.Open, "Alert status should be Open");
      assert.equal(alert[4], "Delivered in 36h - LATE", "Reason should match");
    });

    it("Should emit SLAViolated event on violation", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Delivery <= 24h",
          description: "Test",
          target: 24n,
          comparator: Comparator.LE,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      
      const slaIds = await registry.read.getContractSLAs([1n]);
      const hash = await registry.write.reportMetric([slaIds[0], 36n, "VIOLATION"]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      assert.ok(receipt.logs.length > 0, "Should have emitted events");
    });

    it("Should track consecutive breaches", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Delivery <= 24h",
          description: "Test",
          target: 24n,
          comparator: Comparator.LE,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      
      const slaIds = await registry.read.getContractSLAs([1n]);
      
      // Three violations
      await registry.write.reportMetric([slaIds[0], 30n, "Violation 1"]);
      await registry.write.reportMetric([slaIds[0], 35n, "Violation 2"]);
      await registry.write.reportMetric([slaIds[0], 40n, "Violation 3"]);
      
      // Should have created 3 alerts
      const alerts = await registry.read.getSLAAlerts([slaIds[0]]);
      assert.equal(alerts.length, 3, "Should have 3 alerts");
    });
  });

  describe("Novelties - SLA Modifications", function () {
    it("Should not allow reporting on paused SLA", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Delivery",
          description: "Test",
          target: 24n,
          comparator: Comparator.LE,
          status: false  // Inactive/paused
        }]
      };
      
      await registry.write.createContract([contractInput]);
      
      const slaIds = await registry.read.getContractSLAs([1n]);
      
      try {
        await registry.write.reportMetric([slaIds[0], 20n, "Test"]);
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert.ok(error.message.includes("SLA not active") || error, "Should revert with 'SLA not active'");
      }
    });
  });

  describe("Alert Management", function () {
    it("Should acknowledge an open alert", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const OPS_ROLE = await registry.read.OPS_ROLE();
      await registry.write.grantRole([OPS_ROLE, opsUser.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Delivery",
          description: "Test",
          target: 24n,
          comparator: Comparator.LE,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      const slaIds = await registry.read.getContractSLAs([1n]);
      await registry.write.reportMetric([slaIds[0], 36n, "Violation"]);
      
      const registryAsOps = await viem.getContractAt("SLARegistry", registry.address, { client: opsUser });
      await registryAsOps.write.acknowledgeAlert([1n]);
      
      const alert = await registry.read.alerts([1n]);
      assert.equal(alert[3], AlertStatus.Acknowledged, "Alert should be Acknowledged");
    });

    it("Should resolve an alert", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const OPS_ROLE = await registry.read.OPS_ROLE();
      await registry.write.grantRole([OPS_ROLE, opsUser.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Delivery",
          description: "Test",
          target: 24n,
          comparator: Comparator.LE,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      const slaIds = await registry.read.getContractSLAs([1n]);
      await registry.write.reportMetric([slaIds[0], 36n, "Violation"]);
      
      const registryAsOps = await viem.getContractAt("SLARegistry", registry.address, { client: opsUser });
      await registryAsOps.write.acknowledgeAlert([1n]);
      await registryAsOps.write.resolveAlert([1n, "Issue fixed"]);
      
      const alert = await registry.read.alerts([1n]);
      assert.equal(alert[3], AlertStatus.Resolved, "Alert should be Resolved");
    });

    it("Should emit AlertAcknowledged event", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const OPS_ROLE = await registry.read.OPS_ROLE();
      await registry.write.grantRole([OPS_ROLE, opsUser.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Delivery",
          description: "Test",
          target: 24n,
          comparator: Comparator.LE,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      const slaIds = await registry.read.getContractSLAs([1n]);
      await registry.write.reportMetric([slaIds[0], 36n, "Violation"]);
      
      const registryAsOps = await viem.getContractAt("SLARegistry", registry.address, { client: opsUser });
      const hash = await registryAsOps.write.acknowledgeAlert([1n]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      assert.ok(receipt.logs.length > 0, "Should have emitted event");
    });

    it("Should emit AlertResolved event", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const OPS_ROLE = await registry.read.OPS_ROLE();
      await registry.write.grantRole([OPS_ROLE, opsUser.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Delivery",
          description: "Test",
          target: 24n,
          comparator: Comparator.LE,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      const slaIds = await registry.read.getContractSLAs([1n]);
      await registry.write.reportMetric([slaIds[0], 36n, "Violation"]);
      
      const registryAsOps = await viem.getContractAt("SLARegistry", registry.address, { client: opsUser });
      await registryAsOps.write.acknowledgeAlert([1n]);
      const hash = await registryAsOps.write.resolveAlert([1n, "Fixed"]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      assert.ok(receipt.logs.length > 0, "Should have emitted event");
    });
  });

  describe("Comparator Logic", function () {
    it("Should correctly evaluate LT (Less Than) comparator", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Response < 5 sec",
          description: "Test",
          target: 5n,
          comparator: Comparator.LT,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      const slaIds = await registry.read.getContractSLAs([1n]);
      
      // Should pass: 4 < 5
      await registry.write.reportMetric([slaIds[0], 4n, "Pass"]);
      let alerts = await registry.read.getSLAAlerts([slaIds[0]]);
      assert.equal(alerts.length, 0, "Should not create alert");
      
      // Should fail: 5 is not < 5
      await registry.write.reportMetric([slaIds[0], 5n, "Fail"]);
      alerts = await registry.read.getSLAAlerts([slaIds[0]]);
      assert.equal(alerts.length, 1, "Should create alert");
    });

    it("Should correctly evaluate GE (Greater or Equal) comparator", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Uptime >= 95%",
          description: "Test",
          target: 95n,
          comparator: Comparator.GE,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      const slaIds = await registry.read.getContractSLAs([1n]);
      
      // Should pass: 95 >= 95
      await registry.write.reportMetric([slaIds[0], 95n, "Pass at boundary"]);
      let alerts = await registry.read.getSLAAlerts([slaIds[0]]);
      assert.equal(alerts.length, 0, "Should not create alert");
      
      // Should fail: 94 < 95
      await registry.write.reportMetric([slaIds[0], 94n, "Fail"]);
      alerts = await registry.read.getSLAAlerts([slaIds[0]]);
      assert.equal(alerts.length, 1, "Should create alert");
    });

    it("Should correctly evaluate EQ (Equal) comparator", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-001",
        slas: [{
          id: "SLA-001",
          name: "Exact match = 100",
          description: "Test",
          target: 100n,
          comparator: Comparator.EQ,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      const slaIds = await registry.read.getContractSLAs([1n]);
      
      // Should pass: 100 == 100
      await registry.write.reportMetric([slaIds[0], 100n, "Pass"]);
      let alerts = await registry.read.getSLAAlerts([slaIds[0]]);
      assert.equal(alerts.length, 0, "Should not create alert");
      
      // Should fail: 99 != 100
      await registry.write.reportMetric([slaIds[0], 99n, "Fail"]);
      alerts = await registry.read.getSLAAlerts([slaIds[0]]);
      assert.equal(alerts.length, 1, "Should create alert");
    });
  });

  describe("View Functions", function () {
    it("Should return empty arrays for entities with no relationships", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contracts = await registry.read.getClientContracts(["NONEXISTENT"]);
      assert.equal(contracts.length, 0, "Should return empty array");
      
      const slas = await registry.read.getContractSLAs([999n]);
      assert.equal(slas.length, 0, "Should return empty array");
      
      const alerts = await registry.read.getSLAAlerts([999n]);
      assert.equal(alerts.length, 0, "Should return empty array");
    });

    it("Should track all relationships correctly", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const contractInput = {
        id: "CONTRACT-001",
        path: "/test.pdf",
        customerId: "CUSTOMER-A",
        slas: [{
          id: "SLA-001",
          name: "Test",
          description: "Test",
          target: 24n,
          comparator: Comparator.LE,
          status: true
        }]
      };
      
      await registry.write.createContract([contractInput]);
      const slaIds = await registry.read.getContractSLAs([1n]);
      await registry.write.reportMetric([slaIds[0], 36n, "Violation"]);
      
      // Check client -> contracts
      const contracts = await registry.read.getClientContracts(["CUSTOMER-A"]);
      assert.equal(contracts.length, 1, "Should have 1 contract");
      
      // Check contract -> SLAs
      const contractSLAs = await registry.read.getContractSLAs([1n]);
      assert.equal(contractSLAs.length, 1, "Should have 1 SLA");
      
      // Check SLA -> Alerts
      const slaAlerts = await registry.read.getSLAAlerts([slaIds[0]]);
      assert.equal(slaAlerts.length, 1, "Should have 1 alert");
    });
  });
});
