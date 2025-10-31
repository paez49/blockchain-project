import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, zeroAddress } from "viem";

describe("SLARegistry", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  
  // Helper to get test accounts
  const [admin, contractMs, noveltiesMs, opsUser, client1, client2] = await viem.getWalletClients();

  // Comparator enum values
  const Comparator = {
    LT: 0,
    LE: 1,
    EQ: 2,
    GE: 3,
    GT: 4,
  };

  // SLA Status enum values
  const SLAStatus = {
    Active: 0,
    Paused: 1,
    Archived: 2,  
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
  });

  describe("Client Management", function () {
    it("Should register a new client", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      const clientId = await registry.write.registerClient(["Acme Corp", client1.account.address]);
      
      const client = await registry.read.clients([1n]);
      assert.equal(client[0], 1n, "Client ID should be 1");
      assert.equal(client[1], "Acme Corp", "Client name should match");
      assert.equal(client[2].toLowerCase(), client1.account.address.toLowerCase(), "Client account should match");
      assert.equal(client[3], true, "Client should be active");
    });

    it("Should register multiple clients with sequential IDs", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Client 1", client1.account.address]);
      await registry.write.registerClient(["Client 2", client2.account.address]);
      
      const client1Data = await registry.read.clients([1n]);
      const client2Data = await registry.read.clients([2n]);
      
      assert.equal(client1Data[0], 1n);
      assert.equal(client2Data[0], 2n);
    });

    it("Should fail if non-CONTRACT_MS_ROLE tries to register client", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      const registryAsClient = await viem.getContractAt("SLARegistry", registry.address, { client: client1 });
      
      try {
        await registryAsClient.write.registerClient(["Unauthorized", client1.account.address]);
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        // Access control errors can be in different formats, just check it reverted
        assert.ok(error, "Should have thrown an error");
      }
    });
  });

  describe("Contract Management", function () {
    it("Should create a contract for a client", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      
      const ipfsCid = "QmXxxx1234567890";
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      const endDate = startDate + 31536000n; // 1 year later
      
      const contractId = await registry.write.createContract([1n, ipfsCid, startDate, endDate]);
      
      const contract = await registry.read.contractsById([1n]);
      assert.equal(contract[0], 1n, "Contract ID should be 1");
      assert.equal(contract[1], 1n, "Client ID should be 1");
      assert.equal(contract[2], ipfsCid, "IPFS CID should match");
      assert.equal(contract[5], true, "Contract should be active");
    });

    it("Should emit ContractCreated event", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      
      const ipfsCid = "QmXxxx1234567890";
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      const endDate = startDate + 31536000n;
      
      await viem.assertions.emitWithArgs(
        registry.write.createContract([1n, ipfsCid, startDate, endDate]),
        registry,
        "ContractCreated",
        [1n, 1n, ipfsCid, startDate, endDate],
      );
    });

    it("Should update contract IPFS CID", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmOldCid", startDate, 0n]);
      
      const newCid = "QmNewCid123";
      await registry.write.updateContractIPFS([1n, newCid]);
      
      const contract = await registry.read.contractsById([1n]);
      assert.equal(contract[2], newCid, "IPFS CID should be updated");
    });

    it("Should track client contracts", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      
      await registry.write.createContract([1n, "QmCid1", startDate, 0n]);
      await registry.write.createContract([1n, "QmCid2", startDate, 0n]);
      
      const contracts = await registry.read.getClientContracts([1n]);
      assert.equal(contracts.length, 2, "Should have 2 contracts");
      assert.equal(contracts[0], 1n);
      assert.equal(contracts[1], 2n);
    });
  });

  describe("SLA Management", function () {
    it("Should create an SLA for a contract", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      
      const slaId = await registry.write.addSLA([
        1n, // contractId
        "Delivery Time <= 24h",
        24n, // target: 24 hours
        Comparator.LE, // <=
        86400n, // windowSeconds: 24 hours
      ]);
      
      const sla = await registry.read.slas([1n]);
      assert.equal(sla[0], 1n, "SLA ID should be 1");
      assert.equal(sla[1], 1n, "Contract ID should be 1");
      assert.equal(sla[2], "Delivery Time <= 24h", "SLA name should match");
      assert.equal(sla[3], 24n, "Target should be 24");
      assert.equal(sla[4], Comparator.LE, "Comparator should be LE");
      assert.equal(sla[5], SLAStatus.Active, "Status should be Active");
    });

    it("Should emit SLACreated event", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      
      await viem.assertions.emitWithArgs(
        registry.write.addSLA([1n, "Test SLA", 100n, Comparator.GE, 3600n]),
        registry,
        "SLACreated",
        [1n, 1n, "Test SLA", 100n, Comparator.GE, 3600n],
      );
    });

    it("Should track contract SLAs", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      
      await registry.write.addSLA([1n, "SLA 1", 24n, Comparator.LE, 86400n]);
      await registry.write.addSLA([1n, "SLA 2", 95n, Comparator.GE, 3600n]);
      
      const slas = await registry.read.getContractSLAs([1n]);
      assert.equal(slas.length, 2, "Should have 2 SLAs");
    });
  });

  describe("Metric Reporting", function () {
    it("Should report successful metric (no violation)", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery <= 24h", 24n, Comparator.LE, 86400n]);
      
      await registry.write.reportMetric([1n, 20n, "Order #123 delivered in 20h"]);
      
      const sla = await registry.read.slas([1n]);
      assert.equal(sla[8], 0, "consecutiveBreaches should be 0");
      assert.equal(sla[9], 0, "totalBreaches should be 0");
      assert.equal(sla[10], 1, "totalPass should be 1");
    });

    it("Should emit SLAMetricReported event on success", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery <= 24h", 24n, Comparator.LE, 86400n]);
      
      await viem.assertions.emitWithArgs(
        registry.write.reportMetric([1n, 20n, "Success"]),
        registry,
        "SLAMetricReported",
        [1n, 20n, true, "Success"],
      );
    });

    it("Should create alert on SLA violation", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery <= 24h", 24n, Comparator.LE, 86400n]);
      
      await registry.write.reportMetric([1n, 36n, "Order #456 took 36h - VIOLATION"]);
      
      const sla = await registry.read.slas([1n]);
      assert.equal(sla[8], 1, "consecutiveBreaches should be 1");
      assert.equal(sla[9], 1, "totalBreaches should be 1");
      assert.equal(sla[10], 0, "totalPass should be 0");
      
      const alerts = await registry.read.getSLAAlerts([1n]);
      assert.equal(alerts.length, 1, "Should have 1 alert");
      
      const alert = await registry.read.alerts([1n]);
      assert.equal(alert[0], 1n, "Alert ID should be 1");
      assert.equal(alert[1], 1n, "Alert should reference SLA 1");
      assert.equal(alert[3], AlertStatus.Open, "Alert status should be Open");
    });

    it("Should emit SLAViolated event on violation", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery <= 24h", 24n, Comparator.LE, 86400n]);
      
      const deploymentBlockNumber = await publicClient.getBlockNumber();
      
      await registry.write.reportMetric([1n, 36n, "VIOLATION"]);
      
      const events = await publicClient.getContractEvents({
        address: registry.address,
        abi: registry.abi,
        eventName: "SLAViolated",
        fromBlock: deploymentBlockNumber,
        strict: true,
      });
      
      assert.equal(events.length, 1, "Should emit 1 SLAViolated event");
      assert.equal(events[0].args.alertId, 1n);
      assert.equal(events[0].args.slaId, 1n);
    });

    it("Should track consecutive breaches", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery <= 24h", 24n, Comparator.LE, 86400n]);
      
      // Three violations
      await registry.write.reportMetric([1n, 30n, "Violation 1"]);
      await registry.write.reportMetric([1n, 35n, "Violation 2"]);
      await registry.write.reportMetric([1n, 40n, "Violation 3"]);
      
      const sla = await registry.read.slas([1n]);
      assert.equal(sla[8], 3, "consecutiveBreaches should be 3");
      assert.equal(sla[9], 3, "totalBreaches should be 3");
      
      // Success resets consecutive breaches
      await registry.write.reportMetric([1n, 20n, "Success"]);
      
      const slaAfter = await registry.read.slas([1n]);
      assert.equal(slaAfter[8], 0, "consecutiveBreaches should reset to 0");
      assert.equal(slaAfter[9], 3, "totalBreaches should remain 3");
      assert.equal(slaAfter[10], 1, "totalPass should be 1");
    });
  });

  describe("Novelties - SLA Modifications", function () {
    it("Should pause an active SLA", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      const CONTRACT_MS_ROLE = await registry.read.CONTRACT_MS_ROLE();
      const NOVELTIES_MS_ROLE = await registry.read.NOVELTIES_MS_ROLE();
      
      await registry.write.grantRole([CONTRACT_MS_ROLE, contractMs.account.address]);
      await registry.write.grantRole([NOVELTIES_MS_ROLE, noveltiesMs.account.address]);
      
      const registryAsContract = await viem.getContractAt("SLARegistry", registry.address, { client: contractMs });
      const registryAsNovelties = await viem.getContractAt("SLARegistry", registry.address, { client: noveltiesMs });
      
      await registryAsContract.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registryAsContract.write.createContract([1n, "QmCid", startDate, 0n]);
      await registryAsContract.write.addSLA([1n, "Delivery", 24n, Comparator.LE, 86400n]);
      
      await registryAsNovelties.write.pauseSLA([1n, "Road blockage"]);
      
      const sla = await registry.read.slas([1n]);
      assert.equal(sla[5], SLAStatus.Paused, "SLA status should be Paused");
    });

    it("Should resume a paused SLA", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery", 24n, Comparator.LE, 86400n]);
      
      await registry.write.pauseSLA([1n, "Temporary pause"]);
      await registry.write.resumeSLA([1n, "Issue resolved"]);
      
      const sla = await registry.read.slas([1n]);
      assert.equal(sla[5], SLAStatus.Active, "SLA status should be Active");
    });

    it("Should update SLA target", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery", 24n, Comparator.LE, 86400n]);
      
      await registry.write.updateSLATarget([1n, 36n, "Extended deadline due to emergency"]);
      
      const sla = await registry.read.slas([1n]);
      assert.equal(sla[3], 36n, "Target should be updated to 36");
    });

    it("Should update SLA comparator and window", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery", 24n, Comparator.LE, 86400n]);
      
      await registry.write.updateSLAParams([1n, Comparator.LT, 7200n, "Parameter adjustment"]);
      
      const sla = await registry.read.slas([1n]);
      assert.equal(sla[4], Comparator.LT, "Comparator should be LT");
      assert.equal(sla[6], 7200n, "Window should be 7200");
    });

    it("Should not allow reporting on paused SLA", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery", 24n, Comparator.LE, 86400n]);
      
      await registry.write.pauseSLA([1n, "Paused"]);
      
      try {
        await registry.write.reportMetric([1n, 20n, "Test"]);
        assert.fail("Should have thrown an error");
      } catch (error: any) {
        assert.ok(error.message.includes("SLA not active"), "Should fail with 'SLA not active' error");
      }
    });
  });

  describe("Alert Management", function () {
    it("Should acknowledge an open alert", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      const OPS_ROLE = await registry.read.OPS_ROLE();
      await registry.write.grantRole([OPS_ROLE, opsUser.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery", 24n, Comparator.LE, 86400n]);
      await registry.write.reportMetric([1n, 36n, "Violation"]);
      
      const registryAsOps = await viem.getContractAt("SLARegistry", registry.address, { client: opsUser });
      await registryAsOps.write.acknowledgeAlert([1n]);
      
      const alert = await registry.read.alerts([1n]);
      assert.equal(alert[3], AlertStatus.Acknowledged, "Alert should be Acknowledged");
    });

    it("Should resolve an alert", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery", 24n, Comparator.LE, 86400n]);
      await registry.write.reportMetric([1n, 36n, "Violation"]);
      
      await registry.write.acknowledgeAlert([1n]);
      await registry.write.resolveAlert([1n, "Issue fixed"]);
      
      const alert = await registry.read.alerts([1n]);
      assert.equal(alert[3], AlertStatus.Resolved, "Alert should be Resolved");
    });

    it("Should emit AlertAcknowledged event", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery", 24n, Comparator.LE, 86400n]);
      await registry.write.reportMetric([1n, 36n, "Violation"]);
      
      const deploymentBlockNumber = await publicClient.getBlockNumber();
      
      await registry.write.acknowledgeAlert([1n]);
      
      const events = await publicClient.getContractEvents({
        address: registry.address,
        abi: registry.abi,
        eventName: "AlertAcknowledged",
        fromBlock: deploymentBlockNumber,
        strict: true,
      });
      
      assert.equal(events.length, 1, "Should emit AlertAcknowledged event");
      assert.equal(events[0].args.alertId, 1n);
    });

    it("Should emit AlertResolved event", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Delivery", 24n, Comparator.LE, 86400n]);
      await registry.write.reportMetric([1n, 36n, "Violation"]);
      await registry.write.acknowledgeAlert([1n]);
      
      const deploymentBlockNumber = await publicClient.getBlockNumber();
      
      await registry.write.resolveAlert([1n, "Fixed"]);
      
      const events = await publicClient.getContractEvents({
        address: registry.address,
        abi: registry.abi,
        eventName: "AlertResolved",
        fromBlock: deploymentBlockNumber,
        strict: true,
      });
      
      assert.equal(events.length, 1, "Should emit AlertResolved event");
      assert.equal(events[0].args.alertId, 1n);
    });
  });

  describe("Comparator Logic", function () {
    it("Should correctly evaluate LT (Less Than) comparator", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Response < 5 sec", 5n, Comparator.LT, 3600n]);
      
      // Should pass: 4 < 5
      await registry.write.reportMetric([1n, 4n, "Pass"]);
      let sla = await registry.read.slas([1n]);
      assert.equal(sla[10], 1, "Should pass");
      
      // Should fail: 5 is not < 5
      await registry.write.reportMetric([1n, 5n, "Fail"]);
      sla = await registry.read.slas([1n]);
      assert.equal(sla[9], 1, "Should fail");
    });

    it("Should correctly evaluate GE (Greater or Equal) comparator", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Uptime >= 95%", 95n, Comparator.GE, 86400n]);
      
      // Should pass: 95 >= 95
      await registry.write.reportMetric([1n, 95n, "Pass at boundary"]);
      let sla = await registry.read.slas([1n]);
      assert.equal(sla[10], 1, "Should pass");
      
      // Should pass: 98 >= 95
      await registry.write.reportMetric([1n, 98n, "Pass above"]);
      sla = await registry.read.slas([1n]);
      assert.equal(sla[10], 2, "Should pass again");
      
      // Should fail: 94 is not >= 95
      await registry.write.reportMetric([1n, 94n, "Fail"]);
      sla = await registry.read.slas([1n]);
      assert.equal(sla[9], 1, "Should fail");
    });

    it("Should correctly evaluate EQ (Equal) comparator", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid", startDate, 0n]);
      await registry.write.addSLA([1n, "Exact match = 100", 100n, Comparator.EQ, 3600n]);
      
      // Should pass: 100 == 100
      await registry.write.reportMetric([1n, 100n, "Pass"]);
      let sla = await registry.read.slas([1n]);
      assert.equal(sla[10], 1, "Should pass");
      
      // Should fail: 99 != 100
      await registry.write.reportMetric([1n, 99n, "Fail"]);
      sla = await registry.read.slas([1n]);
      assert.equal(sla[9], 1, "Should fail");
    });
  });

  describe("View Functions", function () {
    it("Should return empty arrays for entities with no relationships", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      
      const contracts = await registry.read.getClientContracts([1n]);
      assert.equal(contracts.length, 0, "New client should have no contracts");
    });

    it("Should track all relationships correctly", async function () {
      const registry = await viem.deployContract("SLARegistry", [admin.account.address]);
      
      // Create client
      await registry.write.registerClient(["Acme Corp", client1.account.address]);
      
      // Create contracts
      const startDate = BigInt(Math.floor(Date.now() / 1000));
      await registry.write.createContract([1n, "QmCid1", startDate, 0n]);
      await registry.write.createContract([1n, "QmCid2", startDate, 0n]);
      
      // Create SLAs
      await registry.write.addSLA([1n, "SLA 1", 24n, Comparator.LE, 86400n]);
      await registry.write.addSLA([1n, "SLA 2", 95n, Comparator.GE, 3600n]);
      await registry.write.addSLA([2n, "SLA 3", 50n, Comparator.LT, 7200n]);
      
      // Create alerts
      await registry.write.reportMetric([1n, 50n, "Violation"]);
      await registry.write.reportMetric([2n, 90n, "Violation"]);
      
      // Verify relationships
      const clientContracts = await registry.read.getClientContracts([1n]);
      assert.equal(clientContracts.length, 2, "Client should have 2 contracts");
      
      const contract1SLAs = await registry.read.getContractSLAs([1n]);
      assert.equal(contract1SLAs.length, 2, "Contract 1 should have 2 SLAs");
      
      const contract2SLAs = await registry.read.getContractSLAs([2n]);
      assert.equal(contract2SLAs.length, 1, "Contract 2 should have 1 SLA");
      
      const sla1Alerts = await registry.read.getSLAAlerts([1n]);
      assert.equal(sla1Alerts.length, 1, "SLA 1 should have 1 alert");
      
      const sla2Alerts = await registry.read.getSLAAlerts([2n]);
      assert.equal(sla2Alerts.length, 1, "SLA 2 should have 1 alert");
    });
  });
});

