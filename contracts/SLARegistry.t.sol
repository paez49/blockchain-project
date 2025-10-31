// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SLARegistry} from "./SLARegistry.sol";
import {Test} from "forge-std/Test.sol";

contract SLARegistryTest is Test {
    SLARegistry registry;
    
    address admin = address(this);
    address contractMs = address(0x1);
    address noveltiesMs = address(0x2);
    address opsUser = address(0x3);
    address client1 = address(0x4);
    address client2 = address(0x5);

    bytes32 CONTRACT_MS_ROLE;
    bytes32 NOVELTIES_MS_ROLE;
    bytes32 OPS_ROLE;

    function setUp() public {
        registry = new SLARegistry(admin);
        
        CONTRACT_MS_ROLE = registry.CONTRACT_MS_ROLE();
        NOVELTIES_MS_ROLE = registry.NOVELTIES_MS_ROLE();
        OPS_ROLE = registry.OPS_ROLE();
        
        // Grant roles to test accounts
        registry.grantRole(CONTRACT_MS_ROLE, contractMs);
        registry.grantRole(NOVELTIES_MS_ROLE, noveltiesMs);
        registry.grantRole(OPS_ROLE, opsUser);
    }

    // ═══════════════════════════════════════════════════════════════════
    // DEPLOYMENT AND ROLES
    // ═══════════════════════════════════════════════════════════════════

    function test_DeploymentWithAdminRole() public view {
        bytes32 DEFAULT_ADMIN_ROLE = 0x00;
        require(registry.hasRole(DEFAULT_ADMIN_ROLE, admin), "Admin should have DEFAULT_ADMIN_ROLE");
        require(registry.hasRole(CONTRACT_MS_ROLE, admin), "Admin should have CONTRACT_MS_ROLE");
        require(registry.hasRole(NOVELTIES_MS_ROLE, admin), "Admin should have NOVELTIES_MS_ROLE");
        require(registry.hasRole(OPS_ROLE, admin), "Admin should have OPS_ROLE");
    }

    function test_RoleAssignment() public view {
        require(registry.hasRole(CONTRACT_MS_ROLE, contractMs), "contractMs should have CONTRACT_MS_ROLE");
        require(registry.hasRole(NOVELTIES_MS_ROLE, noveltiesMs), "noveltiesMs should have NOVELTIES_MS_ROLE");
        require(registry.hasRole(OPS_ROLE, opsUser), "opsUser should have OPS_ROLE");
    }

    // ═══════════════════════════════════════════════════════════════════
    // CLIENT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    function test_RegisterClient() public {
        uint256 clientId = registry.registerClient("Acme Corp", client1);
        
        (uint256 id, string memory name, address account, bool active) = registry.clients(clientId);
        
        require(id == 1, "Client ID should be 1");
        require(keccak256(bytes(name)) == keccak256(bytes("Acme Corp")), "Client name should match");
        require(account == client1, "Client account should match");
        require(active == true, "Client should be active");
    }

    function test_RegisterMultipleClients() public {
        uint256 clientId1 = registry.registerClient("Client 1", client1);
        uint256 clientId2 = registry.registerClient("Client 2", client2);
        
        require(clientId1 == 1, "First client ID should be 1");
        require(clientId2 == 2, "Second client ID should be 2");
    }

    function test_RegisterClient_UnauthorizedFails() public {
        vm.prank(client1);
        vm.expectRevert();
        registry.registerClient("Unauthorized", client1);
    }

    // ═══════════════════════════════════════════════════════════════════
    // CONTRACT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    function test_CreateContract() public {
        registry.registerClient("Acme Corp", client1);
        
        string memory ipfsCid = "QmXxxx1234567890";
        uint64 startDate = uint64(block.timestamp);
        uint64 endDate = startDate + 365 days;
        
        uint256 contractId = registry.createContract(1, ipfsCid, startDate, endDate);
        
        (
            uint256 id,
            uint256 clientId,
            string memory cid,
            uint64 start,
            uint64 end,
            bool active
        ) = registry.contractsById(contractId);
        
        require(id == 1, "Contract ID should be 1");
        require(clientId == 1, "Client ID should be 1");
        require(keccak256(bytes(cid)) == keccak256(bytes(ipfsCid)), "IPFS CID should match");
        require(start == startDate, "Start date should match");
        require(end == endDate, "End date should match");
        require(active == true, "Contract should be active");
    }

    function test_CreateContract_EmitsEvent() public {
        registry.registerClient("Acme Corp", client1);
        
        string memory ipfsCid = "QmXxxx1234567890";
        uint64 startDate = uint64(block.timestamp);
        uint64 endDate = startDate + 365 days;
        
        vm.expectEmit(true, true, false, true);
        emit SLARegistry.ContractCreated(1, 1, ipfsCid, startDate, endDate);
        registry.createContract(1, ipfsCid, startDate, endDate);
    }

    function test_UpdateContractIPFS() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmOldCid", startDate, 0);
        
        string memory newCid = "QmNewCid123";
        registry.updateContractIPFS(1, newCid);
        
        (, , string memory cid, , , ) = registry.contractsById(1);
        require(keccak256(bytes(cid)) == keccak256(bytes(newCid)), "IPFS CID should be updated");
    }

    function test_GetClientContracts() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        
        registry.createContract(1, "QmCid1", startDate, 0);
        registry.createContract(1, "QmCid2", startDate, 0);
        
        uint256[] memory contracts = registry.getClientContracts(1);
        require(contracts.length == 2, "Should have 2 contracts");
        require(contracts[0] == 1, "First contract ID should be 1");
        require(contracts[1] == 2, "Second contract ID should be 2");
    }

    // ═══════════════════════════════════════════════════════════════════
    // SLA MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    function test_AddSLA() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        
        uint256 slaId = registry.addSLA(
            1,
            "Delivery Time <= 24h",
            24,
            SLARegistry.Comparator.LE,
            86400
        );
        
        (
            uint256 id,
            uint256 contractId,
            string memory name,
            uint256 target,
            SLARegistry.Comparator comparator,
            SLARegistry.SLAStatus status,
            uint64 windowSeconds,
            uint64 lastReportAt,
            uint32 consecutiveBreaches,
            uint32 totalBreaches,
            uint32 totalPass
        ) = registry.slas(slaId);
        
        require(id == 1, "SLA ID should be 1");
        require(contractId == 1, "Contract ID should be 1");
        require(keccak256(bytes(name)) == keccak256(bytes("Delivery Time <= 24h")), "SLA name should match");
        require(target == 24, "Target should be 24");
        require(comparator == SLARegistry.Comparator.LE, "Comparator should be LE");
        require(status == SLARegistry.SLAStatus.Active, "Status should be Active");
        require(windowSeconds == 86400, "Window should be 86400");
        require(lastReportAt == 0, "Last report should be 0");
        require(consecutiveBreaches == 0, "Consecutive breaches should be 0");
        require(totalBreaches == 0, "Total breaches should be 0");
        require(totalPass == 0, "Total pass should be 0");
    }

    function test_AddSLA_EmitsEvent() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        
        vm.expectEmit(true, true, false, true);
        emit SLARegistry.SLACreated(1, 1, "Test SLA", 100, SLARegistry.Comparator.GE, 3600);
        registry.addSLA(1, "Test SLA", 100, SLARegistry.Comparator.GE, 3600);
    }

    function test_GetContractSLAs() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        
        registry.addSLA(1, "SLA 1", 24, SLARegistry.Comparator.LE, 86400);
        registry.addSLA(1, "SLA 2", 95, SLARegistry.Comparator.GE, 3600);
        
        uint256[] memory slas = registry.getContractSLAs(1);
        require(slas.length == 2, "Should have 2 SLAs");
        require(slas[0] == 1, "First SLA ID should be 1");
        require(slas[1] == 2, "Second SLA ID should be 2");
    }

    // ═══════════════════════════════════════════════════════════════════
    // METRIC REPORTING
    // ═══════════════════════════════════════════════════════════════════

    function test_ReportMetric_Success() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Delivery <= 24h", 24, SLARegistry.Comparator.LE, 86400);
        
        registry.reportMetric(1, 20, "Order #123 delivered in 20h");
        
        (, , , , , , , , uint32 consecutiveBreaches, uint32 totalBreaches, uint32 totalPass) = registry.slas(1);
        
        require(consecutiveBreaches == 0, "Consecutive breaches should be 0");
        require(totalBreaches == 0, "Total breaches should be 0");
        require(totalPass == 1, "Total pass should be 1");
    }

    function test_ReportMetric_Violation() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Delivery <= 24h", 24, SLARegistry.Comparator.LE, 86400);
        
        registry.reportMetric(1, 36, "Order #456 took 36h - VIOLATION");
        
        (, , , , , , , , uint32 consecutiveBreaches, uint32 totalBreaches, uint32 totalPass) = registry.slas(1);
        
        require(consecutiveBreaches == 1, "Consecutive breaches should be 1");
        require(totalBreaches == 1, "Total breaches should be 1");
        require(totalPass == 0, "Total pass should be 0");
        
        // Check alert was created
        uint256[] memory alerts = registry.getSLAAlerts(1);
        require(alerts.length == 1, "Should have 1 alert");
        
        (uint256 alertId, uint256 slaId, , SLARegistry.AlertStatus status, ) = registry.alerts(1);
        require(alertId == 1, "Alert ID should be 1");
        require(slaId == 1, "Alert should reference SLA 1");
        require(status == SLARegistry.AlertStatus.Open, "Alert status should be Open");
    }

    function test_ReportMetric_EmitsViolationEvent() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Delivery <= 24h", 24, SLARegistry.Comparator.LE, 86400);
        
        vm.expectEmit(true, true, false, true);
        emit SLARegistry.SLAViolated(1, 1, "VIOLATION");
        registry.reportMetric(1, 36, "VIOLATION");
    }

    function test_ReportMetric_ConsecutiveBreaches() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Delivery <= 24h", 24, SLARegistry.Comparator.LE, 86400);
        
        // Three violations
        registry.reportMetric(1, 30, "Violation 1");
        registry.reportMetric(1, 35, "Violation 2");
        registry.reportMetric(1, 40, "Violation 3");
        
        (, , , , , , , , uint32 consecutiveBreaches, uint32 totalBreaches, ) = registry.slas(1);
        require(consecutiveBreaches == 3, "Consecutive breaches should be 3");
        require(totalBreaches == 3, "Total breaches should be 3");
        
        // Success resets consecutive breaches
        registry.reportMetric(1, 20, "Success");
        
        uint32 totalPass2;
        (, , , , , , , , consecutiveBreaches, totalBreaches, totalPass2) = registry.slas(1);
        require(consecutiveBreaches == 0, "Consecutive breaches should reset to 0");
        require(totalBreaches == 3, "Total breaches should remain 3");
        require(totalPass2 == 1, "Total pass should be 1");
    }

    function test_ReportMetric_OnPausedSLAFails() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Delivery", 24, SLARegistry.Comparator.LE, 86400);
        
        registry.pauseSLA(1, "Paused");
        
        vm.expectRevert("SLA not active");
        registry.reportMetric(1, 20, "Test");
    }

    // ═══════════════════════════════════════════════════════════════════
    // NOVELTIES - SLA MODIFICATIONS
    // ═══════════════════════════════════════════════════════════════════

    function test_PauseSLA() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Delivery", 24, SLARegistry.Comparator.LE, 86400);
        
        vm.prank(noveltiesMs);
        registry.pauseSLA(1, "Road blockage");
        
        (, , , , , SLARegistry.SLAStatus status, , , , , ) = registry.slas(1);
        require(status == SLARegistry.SLAStatus.Paused, "SLA status should be Paused");
    }

    function test_ResumeSLA() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Delivery", 24, SLARegistry.Comparator.LE, 86400);
        
        registry.pauseSLA(1, "Temporary pause");
        registry.resumeSLA(1, "Issue resolved");
        
        (, , , , , SLARegistry.SLAStatus status, , , , , ) = registry.slas(1);
        require(status == SLARegistry.SLAStatus.Active, "SLA status should be Active");
    }

    function test_UpdateSLATarget() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Delivery", 24, SLARegistry.Comparator.LE, 86400);
        
        vm.prank(noveltiesMs);
        registry.updateSLATarget(1, 36, "Extended deadline due to emergency");
        
        (, , , uint256 target, , , , , , , ) = registry.slas(1);
        require(target == 36, "Target should be updated to 36");
    }

    function test_UpdateSLAParams() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Delivery", 24, SLARegistry.Comparator.LE, 86400);
        
        vm.prank(noveltiesMs);
        registry.updateSLAParams(1, SLARegistry.Comparator.LT, 7200, "Parameter adjustment");
        
        (, , , , SLARegistry.Comparator comparator, , uint64 windowSeconds, , , , ) = registry.slas(1);
        require(comparator == SLARegistry.Comparator.LT, "Comparator should be LT");
        require(windowSeconds == 7200, "Window should be 7200");
    }

    // ═══════════════════════════════════════════════════════════════════
    // ALERT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    function test_AcknowledgeAlert() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Delivery", 24, SLARegistry.Comparator.LE, 86400);
        registry.reportMetric(1, 36, "Violation");
        
        vm.prank(opsUser);
        registry.acknowledgeAlert(1);
        
        (, , , SLARegistry.AlertStatus status, ) = registry.alerts(1);
        require(status == SLARegistry.AlertStatus.Acknowledged, "Alert should be Acknowledged");
    }

    function test_ResolveAlert() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Delivery", 24, SLARegistry.Comparator.LE, 86400);
        registry.reportMetric(1, 36, "Violation");
        
        registry.acknowledgeAlert(1);
        registry.resolveAlert(1, "Issue fixed");
        
        (, , , SLARegistry.AlertStatus status, ) = registry.alerts(1);
        require(status == SLARegistry.AlertStatus.Resolved, "Alert should be Resolved");
    }

    function test_ResolveAlert_FromOpenStatus() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Delivery", 24, SLARegistry.Comparator.LE, 86400);
        registry.reportMetric(1, 36, "Violation");
        
        // Can resolve directly from Open without acknowledging
        registry.resolveAlert(1, "Quick fix");
        
        (, , , SLARegistry.AlertStatus status, ) = registry.alerts(1);
        require(status == SLARegistry.AlertStatus.Resolved, "Alert should be Resolved");
    }

    // ═══════════════════════════════════════════════════════════════════
    // COMPARATOR LOGIC
    // ═══════════════════════════════════════════════════════════════════

    function test_Comparator_LT() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Response < 5 sec", 5, SLARegistry.Comparator.LT, 3600);
        
        // Should pass: 4 < 5
        registry.reportMetric(1, 4, "Pass");
        (, , , , , , , , , , uint32 totalPass) = registry.slas(1);
        require(totalPass == 1, "Should pass");
        
        // Should fail: 5 is not < 5
        registry.reportMetric(1, 5, "Fail");
        (, , , , , , , , , uint32 totalBreaches, ) = registry.slas(1);
        require(totalBreaches == 1, "Should fail");
    }

    function test_Comparator_LE() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Time <= 24h", 24, SLARegistry.Comparator.LE, 86400);
        
        // Should pass: 24 <= 24
        registry.reportMetric(1, 24, "Pass at boundary");
        (, , , , , , , , , , uint32 totalPass) = registry.slas(1);
        require(totalPass == 1, "Should pass");
        
        // Should fail: 25 is not <= 24
        registry.reportMetric(1, 25, "Fail");
        (, , , , , , , , , uint32 totalBreaches, ) = registry.slas(1);
        require(totalBreaches == 1, "Should fail");
    }

    function test_Comparator_EQ() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Exact match = 100", 100, SLARegistry.Comparator.EQ, 3600);
        
        // Should pass: 100 == 100
        registry.reportMetric(1, 100, "Pass");
        (, , , , , , , , , , uint32 totalPass) = registry.slas(1);
        require(totalPass == 1, "Should pass");
        
        // Should fail: 99 != 100
        registry.reportMetric(1, 99, "Fail");
        (, , , , , , , , , uint32 totalBreaches, ) = registry.slas(1);
        require(totalBreaches == 1, "Should fail");
    }

    function test_Comparator_GE() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Uptime >= 95%", 95, SLARegistry.Comparator.GE, 86400);
        
        // Should pass: 95 >= 95
        registry.reportMetric(1, 95, "Pass at boundary");
        (, , , , , , , , , , uint32 totalPass) = registry.slas(1);
        require(totalPass == 1, "Should pass");
        
        // Should pass: 98 >= 95
        registry.reportMetric(1, 98, "Pass above");
        (, , , , , , , , , , totalPass) = registry.slas(1);
        require(totalPass == 2, "Should pass again");
        
        // Should fail: 94 is not >= 95
        registry.reportMetric(1, 94, "Fail");
        (, , , , , , , , , uint32 totalBreaches, ) = registry.slas(1);
        require(totalBreaches == 1, "Should fail");
    }

    function test_Comparator_GT() public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Score > 50", 50, SLARegistry.Comparator.GT, 3600);
        
        // Should pass: 51 > 50
        registry.reportMetric(1, 51, "Pass");
        (, , , , , , , , , , uint32 totalPass) = registry.slas(1);
        require(totalPass == 1, "Should pass");
        
        // Should fail: 50 is not > 50
        registry.reportMetric(1, 50, "Fail");
        (, , , , , , , , , uint32 totalBreaches, ) = registry.slas(1);
        require(totalBreaches == 1, "Should fail");
    }

    // ═══════════════════════════════════════════════════════════════════
    // FUZZ TESTS
    // ═══════════════════════════════════════════════════════════════════

    function testFuzz_ReportMetric_LE(uint8 observed) public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Test", 50, SLARegistry.Comparator.LE, 3600);
        
        registry.reportMetric(1, observed, "Fuzz test");
        
        (, , , , , , , , , uint32 totalBreaches, uint32 totalPass) = registry.slas(1);
        
        if (observed <= 50) {
            require(totalPass == 1, "Should pass when observed <= 50");
            require(totalBreaches == 0, "Should have no breaches");
        } else {
            require(totalBreaches == 1, "Should breach when observed > 50");
            require(totalPass == 0, "Should have no passes");
        }
    }

    function testFuzz_ReportMetric_GE(uint8 observed) public {
        registry.registerClient("Acme Corp", client1);
        uint64 startDate = uint64(block.timestamp);
        registry.createContract(1, "QmCid", startDate, 0);
        registry.addSLA(1, "Test", 50, SLARegistry.Comparator.GE, 3600);
        
        registry.reportMetric(1, observed, "Fuzz test");
        
        (, , , , , , , , , uint32 totalBreaches, uint32 totalPass) = registry.slas(1);
        
        if (observed >= 50) {
            require(totalPass == 1, "Should pass when observed >= 50");
            require(totalBreaches == 0, "Should have no breaches");
        } else {
            require(totalBreaches == 1, "Should breach when observed < 50");
            require(totalPass == 0, "Should have no passes");
        }
    }

    function testFuzz_MultipleClients(uint8 numClients) public {
        vm.assume(numClients > 0 && numClients <= 100);
        
        for (uint8 i = 0; i < numClients; i++) {
            address clientAddr = address(uint160(1000 + i));
            string memory clientName = string(abi.encodePacked("Client ", i));
            uint256 clientId = registry.registerClient(clientName, clientAddr);
            require(clientId == i + 1, "Client ID should increment correctly");
        }
    }
}

