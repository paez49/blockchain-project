import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress, keccak256, toHex, parseAbiItem } from "viem";

describe("SLARegistry", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [admin, contractMS, noveltiesMS, opsUser, client1, unauthorized] = await viem.getWalletClients();

  // Helper to get role hash
  const getRoleHash = (role: string) => keccak256(toHex(role));
  
  const CONTRACT_MS_ROLE = getRoleHash("CONTRACT_MS_ROLE");
  const NOVELTIES_MS_ROLE = getRoleHash("NOVELTIES_MS_ROLE");
  const OPS_ROLE = getRoleHash("OPS_ROLE");

  // Comparator enum
  const Comparator = {
    LT: 0,
    LE: 1,
    EQ: 2,
    GE: 3,
    GT: 4,
  };

  // SLA Status enum
  const SLAStatus = {
    Active: 0,
    Paused: 1,
    Archived: 2,
  };

  // Alert Status enum
  const AlertStatus = {
    Open: 0,
    Acknowledged: 1,
    Resolved: 2,
  };

  describe("Deployment and Role Management", function () {
    it("Should deploy with admin having all roles", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);

      // Check that admin has DEFAULT_ADMIN_ROLE
      const hasAdminRole = await registry.read.hasRole([
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        admin.account.address,
      ]);
      assert.equal(hasAdminRole, true);

      // Check that admin has CONTRACT_MS_ROLE
      const hasContractRole = await registry.read.hasRole([
        CONTRACT_MS_ROLE,
        admin.account.address,
      ]);
      assert.equal(hasContractRole, true);
    });

    it("Should allow admin to grant roles to other addresses", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);

      // Grant CONTRACT_MS_ROLE to contractMS
      await registry.write.grantRole([CONTRACT_MS_ROLE, contractMS.account.address]);
      const hasRole = await registry.read.hasRole([
        CONTRACT_MS_ROLE,
        contractMS.account.address,
      ]);
      assert.equal(hasRole, true);
    });
  });

  describe("Client Registration", function () {
    it("Should register a client with CONTRACT_MS_ROLE", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);

      const clientId = await registry.write.registerClient([
        "Test Client",
        client1.account.address,
      ]);

      // Read client data
      const client = await registry.read.clients([1n]);
      assert.equal(client.id, 1n);
      assert.equal(client.name, "Test Client");
      assert.equal(getAddress(client.account), getAddress(client1.account.address));
      assert.equal(client.active, true);
    });

    it("Should fail to register client without CONTRACT_MS_ROLE", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      const registryUnauth = await viem.getContractAt(
        "SLARegistry",
        registry.address,
        { client: unauthorized }
      );

      try {
        await registryUnauth.write.registerClient([
          "Test Client",
          client1.account.address,
        ]);
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert(error.message.includes("AccessControlUnauthorizedAccount") || 
               error.message.includes("reverted"));
      }
    });

    it("Should increment client IDs correctly", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);

      await registry.write.registerClient(["Client 1", client1.account.address]);
      await registry.write.registerClient(["Client 2", client1.account.address]);

      const client1Data = await registry.read.clients([1n]);
      const client2Data = await registry.read.clients([2n]);

      assert.equal(client1Data.id, 1n);
      assert.equal(client2Data.id, 2n);
    });
  });

  describe("Contract Creation", function () {
    it("Should create a contract for an active client", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      // Register client first
      await registry.write.registerClient(["Test Client", client1.account.address]);

      const startDate = BigInt(Math.floor(Date.now() / 1000));
      const endDate = startDate + 31536000n; // 1 year

      // Create contract
      await viem.assertions.emitWithArgs(
        registry.write.createContract([
          1n,
          "QmTestIPFSHash123",
          startDate,
          endDate,
        ]),
        registry,
        "ContractCreated",
        [1n, 1n, "QmTestIPFSHash123", startDate, endDate]
      );

      // Verify contract data
      const contract = await registry.read.contractsById([1n]);
      assert.equal(contract.id, 1n);
      assert.equal(contract.clientId, 1n);
      assert.equal(contract.ipfsCid, "QmTestIPFSHash123");
      assert.equal(contract.startDate, startDate);
      assert.equal(contract.endDate, endDate);
      assert.equal(contract.active, true);
    });

    it("Should fail to create contract for inactive client", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);

      await assert.rejects(
        async () => {
          await registry.write.createContract([
            999n,
            "QmTestIPFSHash123",
            1000n,
            2000n,
          ]);
        },
        /Client not active/
      );
    });

    it("Should track client contracts correctly", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);

      // Create multiple contracts
      await registry.write.createContract([1n, "QmHash1", 1000n, 2000n]);
      await registry.write.createContract([1n, "QmHash2", 1000n, 2000n]);
      await registry.write.createContract([1n, "QmHash3", 1000n, 2000n]);

      const clientContracts = await registry.read.getClientContracts([1n]);
      assert.equal(clientContracts.length, 3);
      assert.deepEqual(clientContracts, [1n, 2n, 3n]);
    });

    it("Should update contract IPFS CID", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmOldHash", 1000n, 2000n]);

      await viem.assertions.emitWithArgs(
        registry.write.updateContractIPFS([1n, "QmNewHash"]),
        registry,
        "ContractUpdated",
        [1n, "QmNewHash"]
      );

      const contract = await registry.read.contractsById([1n]);
      assert.equal(contract.ipfsCid, "QmNewHash");
    });
  });

  describe("SLA Management", function () {
    it("Should create an SLA for an active contract", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);

      await viem.assertions.emitWithArgs(
        registry.write.addSLA([
          1n, // contractId
          "Entrega <= 24h",
          24n, // target
          Comparator.LE,
          86400n, // windowSeconds
        ]),
        registry,
        "SLACreated",
        [1n, 1n, "Entrega <= 24h", 24n, Comparator.LE, 86400n]
      );

      const sla = await registry.read.slas([1n]);
      assert.equal(sla.id, 1n);
      assert.equal(sla.contractId, 1n);
      assert.equal(sla.name, "Entrega <= 24h");
      assert.equal(sla.target, 24n);
      assert.equal(sla.comparator, Comparator.LE);
      assert.equal(sla.status, SLAStatus.Active);
    });

    it("Should fail to create SLA for inactive contract", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);

      await assert.rejects(
        async () => {
          await registry.write.addSLA([
            999n,
            "Test SLA",
            100n,
            Comparator.GE,
            3600n,
          ]);
        },
        /Contract not active/
      );
    });

    it("Should track contract SLAs correctly", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);

      await registry.write.addSLA([1n, "SLA 1", 24n, Comparator.LE, 86400n]);
      await registry.write.addSLA([1n, "SLA 2", 95n, Comparator.GE, 3600n]);

      const contractSLAs = await registry.read.getContractSLAs([1n]);
      assert.equal(contractSLAs.length, 2);
      assert.deepEqual(contractSLAs, [1n, 2n]);
    });
  });

  describe("Metric Reporting and Alerts", function () {
    it("Should report successful metric (no alert)", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Delivery Time", 24n, Comparator.LE, 86400n]);

      // Report successful metric (20h <= 24h)
      await viem.assertions.emitWithArgs(
        registry.write.reportMetric([1n, 20n, "Order 1234 - 20h"]),
        registry,
        "SLAMetricReported",
        [1n, 20n, true, "Order 1234 - 20h"]
      );

      const sla = await registry.read.slas([1n]);
      assert.equal(sla.consecutiveBreaches, 0);
      assert.equal(sla.totalBreaches, 0);
      assert.equal(sla.totalPass, 1);
    });

    it("Should report failed metric and create alert (LE comparator)", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Delivery Time", 24n, Comparator.LE, 86400n]);

      // Report failed metric (36h > 24h)
      const deploymentBlock = await publicClient.getBlockNumber();
      
      await registry.write.reportMetric([1n, 36n, "Order 1234 - 36h"]);

      // Check SLAMetricReported event
      const metricEvents = await publicClient.getContractEvents({
        address: registry.address,
        abi: registry.abi,
        eventName: "SLAMetricReported",
        fromBlock: deploymentBlock,
      });

      assert.equal(metricEvents.length, 1);
      assert.equal(metricEvents[0].args.slaId, 1n);
      assert.equal(metricEvents[0].args.observed, 36n);
      assert.equal(metricEvents[0].args.success, false);

      // Check SLAViolated event
      const violatedEvents = await publicClient.getContractEvents({
        address: registry.address,
        abi: registry.abi,
        eventName: "SLAViolated",
        fromBlock: deploymentBlock,
      });

      assert.equal(violatedEvents.length, 1);
      assert.equal(violatedEvents[0].args.alertId, 1n);
      assert.equal(violatedEvents[0].args.slaId, 1n);

      // Check SLA counters
      const sla = await registry.read.slas([1n]);
      assert.equal(sla.consecutiveBreaches, 1);
      assert.equal(sla.totalBreaches, 1);
      assert.equal(sla.totalPass, 0);

      // Check alert created
      const alert = await registry.read.alerts([1n]);
      assert.equal(alert.id, 1n);
      assert.equal(alert.slaId, 1n);
      assert.equal(alert.status, AlertStatus.Open);
    });

    it("Should test all comparator types", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);

      // LT: observed < target (50 < 100 = success)
      await registry.write.addSLA([1n, "LT Test", 100n, Comparator.LT, 3600n]);
      await registry.write.reportMetric([1n, 50n, "LT success"]);
      let sla = await registry.read.slas([1n]);
      assert.equal(sla.totalPass, 1);

      // LE: observed <= target (100 <= 100 = success)
      await registry.write.addSLA([1n, "LE Test", 100n, Comparator.LE, 3600n]);
      await registry.write.reportMetric([2n, 100n, "LE success"]);
      sla = await registry.read.slas([2n]);
      assert.equal(sla.totalPass, 1);

      // EQ: observed == target (100 == 100 = success)
      await registry.write.addSLA([1n, "EQ Test", 100n, Comparator.EQ, 3600n]);
      await registry.write.reportMetric([3n, 100n, "EQ success"]);
      sla = await registry.read.slas([3n]);
      assert.equal(sla.totalPass, 1);

      // GE: observed >= target (100 >= 100 = success)
      await registry.write.addSLA([1n, "GE Test", 100n, Comparator.GE, 3600n]);
      await registry.write.reportMetric([4n, 100n, "GE success"]);
      sla = await registry.read.slas([4n]);
      assert.equal(sla.totalPass, 1);

      // GT: observed > target (150 > 100 = success)
      await registry.write.addSLA([1n, "GT Test", 100n, Comparator.GT, 3600n]);
      await registry.write.reportMetric([5n, 150n, "GT success"]);
      sla = await registry.read.slas([5n]);
      assert.equal(sla.totalPass, 1);
    });

    it("Should track consecutive breaches", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      // First breach
      await registry.write.reportMetric([1n, 30n, "Breach 1"]);
      let sla = await registry.read.slas([1n]);
      assert.equal(sla.consecutiveBreaches, 1);

      // Second breach
      await registry.write.reportMetric([1n, 32n, "Breach 2"]);
      sla = await registry.read.slas([1n]);
      assert.equal(sla.consecutiveBreaches, 2);
      assert.equal(sla.totalBreaches, 2);

      // Success - resets consecutive
      await registry.write.reportMetric([1n, 20n, "Success"]);
      sla = await registry.read.slas([1n]);
      assert.equal(sla.consecutiveBreaches, 0);
      assert.equal(sla.totalBreaches, 2);
      assert.equal(sla.totalPass, 1);
    });

    it("Should fail to report metric on paused SLA", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      // Pause SLA
      await registry.write.pauseSLA([1n, "Maintenance"]);

      await assert.rejects(
        async () => {
          await registry.write.reportMetric([1n, 20n, "Test"]);
        },
        /SLA not active/
      );
    });
  });

  describe("Novelty Operations (Pause/Resume/Update)", function () {
    it("Should pause an active SLA", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      const deploymentBlock = await publicClient.getBlockNumber();

      await registry.write.pauseSLA([1n, "Road closure"]);

      const sla = await registry.read.slas([1n]);
      assert.equal(sla.status, SLAStatus.Paused);

      // Check events
      const events = await publicClient.getContractEvents({
        address: registry.address,
        abi: registry.abi,
        eventName: "NoveltyApplied",
        fromBlock: deploymentBlock,
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].args.slaId, 1n);
      assert.equal(events[0].args.field, "status");
      assert.equal(events[0].args.detail, "Road closure");
    });

    it("Should resume a paused SLA", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      await registry.write.pauseSLA([1n, "Paused"]);
      await registry.write.resumeSLA([1n, "Resumed"]);

      const sla = await registry.read.slas([1n]);
      assert.equal(sla.status, SLAStatus.Active);
    });

    it("Should fail to pause already paused SLA", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      await registry.write.pauseSLA([1n, "Paused"]);

      await assert.rejects(
        async () => {
          await registry.write.pauseSLA([1n, "Pause again"]);
        },
        /SLA not active/
      );
    });

    it("Should update SLA target", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      await registry.write.updateSLATarget([1n, 36n, "Emergency extension"]);

      const sla = await registry.read.slas([1n]);
      assert.equal(sla.target, 36n);
    });

    it("Should update SLA comparator and window", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      await registry.write.updateSLAParams([
        1n,
        Comparator.LT,
        172800n, // 48 hours
        "Policy change",
      ]);

      const sla = await registry.read.slas([1n]);
      assert.equal(sla.comparator, Comparator.LT);
      assert.equal(sla.windowSeconds, 172800n);
    });

    it("Should require NOVELTIES_MS_ROLE for novelty operations", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      const registryUnauth = await viem.getContractAt(
        "SLARegistry",
        registry.address,
        { client: unauthorized }
      );

      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      try {
        await registryUnauth.write.pauseSLA([1n, "Unauthorized"]);
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert(error.message.includes("AccessControlUnauthorizedAccount") || 
               error.message.includes("reverted"));
      }
    });
  });

  describe("Alert Management", function () {
    it("Should acknowledge an open alert", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      // Create alert by reporting failed metric
      await registry.write.reportMetric([1n, 36n, "Failed"]);

      // Acknowledge alert
      await viem.assertions.emitWithArgs(
        registry.write.acknowledgeAlert([1n]),
        registry,
        "AlertAcknowledged",
        [1n, getAddress(admin.account.address)]
      );

      const alert = await registry.read.alerts([1n]);
      assert.equal(alert.status, AlertStatus.Acknowledged);
    });

    it("Should resolve an acknowledged alert", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      await registry.write.reportMetric([1n, 36n, "Failed"]);
      await registry.write.acknowledgeAlert([1n]);

      await viem.assertions.emitWithArgs(
        registry.write.resolveAlert([1n, "Issue fixed"]),
        registry,
        "AlertResolved",
        [1n, getAddress(admin.account.address), "Issue fixed"]
      );

      const alert = await registry.read.alerts([1n]);
      assert.equal(alert.status, AlertStatus.Resolved);
    });

    it("Should resolve an open alert directly", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      await registry.write.reportMetric([1n, 36n, "Failed"]);

      // Resolve without acknowledging first
      await registry.write.resolveAlert([1n, "Quick fix"]);

      const alert = await registry.read.alerts([1n]);
      assert.equal(alert.status, AlertStatus.Resolved);
    });

    it("Should fail to acknowledge non-open alert", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      await registry.write.reportMetric([1n, 36n, "Failed"]);
      await registry.write.acknowledgeAlert([1n]);

      await assert.rejects(
        async () => {
          await registry.write.acknowledgeAlert([1n]);
        },
        /Alert not open/
      );
    });

    it("Should track SLA alerts correctly", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      // Create multiple alerts
      await registry.write.reportMetric([1n, 36n, "Fail 1"]);
      await registry.write.reportMetric([1n, 40n, "Fail 2"]);
      await registry.write.reportMetric([1n, 42n, "Fail 3"]);

      const slaAlerts = await registry.read.getSLAAlerts([1n]);
      assert.equal(slaAlerts.length, 3);
      assert.deepEqual(slaAlerts, [1n, 2n, 3n]);
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete workflow: client -> contract -> SLA -> metrics -> alerts", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      const deploymentBlock = await publicClient.getBlockNumber();

      // 1. Register client
      await registry.write.registerClient(["Acme Corp", client1.account.address]);

      // 2. Create contract
      await registry.write.createContract([
        1n,
        "QmAcmeContract2024",
        BigInt(Math.floor(Date.now() / 1000)),
        BigInt(Math.floor(Date.now() / 1000)) + 31536000n,
      ]);

      // 3. Add multiple SLAs
      await registry.write.addSLA([
        1n,
        "Delivery Time <= 24h",
        24n,
        Comparator.LE,
        86400n,
      ]);
      await registry.write.addSLA([
        1n,
        "Success Rate >= 95%",
        95n,
        Comparator.GE,
        604800n,
      ]);

      // 4. Report metrics (mixed success/failure)
      await registry.write.reportMetric([1n, 20n, "Order 1 - 20h"]); // Success
      await registry.write.reportMetric([1n, 30n, "Order 2 - 30h"]); // Failure
      await registry.write.reportMetric([2n, 98n, "Week 1 - 98%"]); // Success
      await registry.write.reportMetric([2n, 92n, "Week 2 - 92%"]); // Failure

      // 5. Check SLA statistics
      const sla1 = await registry.read.slas([1n]);
      assert.equal(sla1.totalBreaches, 1);
      assert.equal(sla1.totalPass, 1);

      const sla2 = await registry.read.slas([2n]);
      assert.equal(sla2.totalBreaches, 1);
      assert.equal(sla2.totalPass, 1);

      // 6. Check alerts created
      const sla1Alerts = await registry.read.getSLAAlerts([1n]);
      const sla2Alerts = await registry.read.getSLAAlerts([2n]);
      assert.equal(sla1Alerts.length, 1);
      assert.equal(sla2Alerts.length, 1);

      // 7. Acknowledge and resolve alerts
      await registry.write.acknowledgeAlert([1n]);
      await registry.write.resolveAlert([1n, "Delivery improved"]);

      const alert1 = await registry.read.alerts([1n]);
      assert.equal(alert1.status, AlertStatus.Resolved);

      // 8. Apply novelty - pause SLA due to emergency
      await registry.write.pauseSLA([1n, "Hurricane affecting logistics"]);

      const sla1Updated = await registry.read.slas([1n]);
      assert.equal(sla1Updated.status, SLAStatus.Paused);
    });

    it("Should handle multiple clients with multiple contracts and SLAs", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);

      // Client 1 with 2 contracts
      await registry.write.registerClient(["Client A", client1.account.address]);
      await registry.write.createContract([1n, "QmContractA1", 1000n, 2000n]);
      await registry.write.createContract([1n, "QmContractA2", 1000n, 2000n]);
      await registry.write.addSLA([1n, "SLA A1-1", 24n, Comparator.LE, 86400n]);
      await registry.write.addSLA([2n, "SLA A2-1", 95n, Comparator.GE, 3600n]);

      // Client 2 with 1 contract
      await registry.write.registerClient(["Client B", client1.account.address]);
      await registry.write.createContract([2n, "QmContractB1", 1000n, 2000n]);
      await registry.write.addSLA([3n, "SLA B1-1", 48n, Comparator.LE, 172800n]);

      // Verify structure
      const client1Contracts = await registry.read.getClientContracts([1n]);
      const client2Contracts = await registry.read.getClientContracts([2n]);
      assert.equal(client1Contracts.length, 2);
      assert.equal(client2Contracts.length, 1);

      const contract1SLAs = await registry.read.getContractSLAs([1n]);
      const contract2SLAs = await registry.read.getContractSLAs([2n]);
      const contract3SLAs = await registry.read.getContractSLAs([3n]);
      assert.equal(contract1SLAs.length, 1);
      assert.equal(contract2SLAs.length, 1);
      assert.equal(contract3SLAs.length, 1);
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should handle zero values correctly", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 0n]); // endDate = 0

      const contract = await registry.read.contractsById([1n]);
      assert.equal(contract.endDate, 0n);
    });

    it("Should handle empty strings", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["", "0x0000000000000000000000000000000000000000"]);

      const client = await registry.read.clients([1n]);
      assert.equal(client.name, "");
    });

    it("Should properly track lastReportAt timestamp", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      const slaBefore = await registry.read.slas([1n]);
      assert.equal(slaBefore.lastReportAt, 0n);

      await registry.write.reportMetric([1n, 20n, "Test"]);

      const slaAfter = await registry.read.slas([1n]);
      assert(slaAfter.lastReportAt > 0n);
    });

    it("Should verify alert timestamp is set correctly", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      await registry.write.reportMetric([1n, 36n, "Failed"]);

      const alert = await registry.read.alerts([1n]);
      assert(alert.createdAt > 0n);
    });

    it("Should maintain data integrity across operations", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      // Setup
      await registry.write.registerClient(["Test Client", client1.account.address]);
      await registry.write.createContract([1n, "QmHash", 1000n, 2000n]);
      await registry.write.addSLA([1n, "Test SLA", 24n, Comparator.LE, 86400n]);

      // Multiple operations
      await registry.write.reportMetric([1n, 20n, "Success 1"]);
      await registry.write.pauseSLA([1n, "Pause"]);
      await registry.write.resumeSLA([1n, "Resume"]);
      await registry.write.reportMetric([1n, 22n, "Success 2"]);
      await registry.write.updateSLATarget([1n, 30n, "Update"]);
      await registry.write.reportMetric([1n, 25n, "Success 3"]);

      // Verify final state
      const sla = await registry.read.slas([1n]);
      assert.equal(sla.target, 30n);
      assert.equal(sla.status, SLAStatus.Active);
      assert.equal(sla.totalBreaches, 0);
      assert.equal(sla.totalPass, 3);
    });
  });
});

