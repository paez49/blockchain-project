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

    bytes32 CONTRACT_MS_ROLE;
    bytes32 NOVELTIES_MS_ROLE;
    bytes32 OPS_ROLE;

    function setUp() public {
        registry = new SLARegistry(admin);
    }

    // ═══════════════════════════════════════════════════════════════════
    // DEPLOYMENT AND ROLES
    // ═══════════════════════════════════════════════════════════════════

    function test_DeploymentWithAdminRole() public view {
        bytes32 DEFAULT_ADMIN_ROLE = 0x00;
        require(registry.hasRole(DEFAULT_ADMIN_ROLE, admin), "Admin should have DEFAULT_ADMIN_ROLE");
    }

    function test_RoleAssignment() public view {
        require(registry.hasRole(CONTRACT_MS_ROLE, contractMs), "contractMs should have CONTRACT_MS_ROLE");
        require(registry.hasRole(NOVELTIES_MS_ROLE, noveltiesMs), "noveltiesMs should have NOVELTIES_MS_ROLE");
        require(registry.hasRole(OPS_ROLE, opsUser), "opsUser should have OPS_ROLE");
    }

    // ═══════════════════════════════════════════════════════════════════
    // CONTRACT CREATION WITH SLAS
    // ═══════════════════════════════════════════════════════════════════

    function test_CreateContractWithSLAs() public {
        SLARegistry.SLAInput[] memory slas = new SLARegistry.SLAInput[](2);
        
        slas[0] = SLARegistry.SLAInput({
            id: "SLA-001",
            name: "Delivery Time",
            description: "Delivery must be within 24 hours",
            target: 24,
            comparator: SLARegistry.Comparator.LE,
            status: true
        });
        
        slas[1] = SLARegistry.SLAInput({
            id: "SLA-002",
            name: "Quality Score",
            description: "Quality score must be >= 95%",
            target: 95,
            comparator: SLARegistry.Comparator.GE,
            status: true
        });
        
        SLARegistry.ContractInput memory contractInput = SLARegistry.ContractInput({
            id: "CONTRACT-001",
            path: "/contracts/customer-a/contract-2024.pdf",
            customerId: "CUSTOMER-A",
            slas: slas
        });
        
        uint256 contractId = registry.createContract(contractInput);
        
        require(contractId == 1, "Contract ID should be 1");
        
        // Verify contract was created
        (
            string memory id,
            string memory clientId,
            ,  // externalId (unused)
            string memory path,
            bool active
        ) = registry.contractsById(contractId);
        
        require(keccak256(bytes(id)) == keccak256(bytes("CONTRACT-001")), "Contract ID should match");
        require(keccak256(bytes(clientId)) == keccak256(bytes("CUSTOMER-A")), "Customer ID should match");
        require(keccak256(bytes(path)) == keccak256(bytes("/contracts/customer-a/contract-2024.pdf")), "Path should match");
        require(active == true, "Contract should be active");
        
        // Verify SLAs were created
        uint256[] memory slaIds = registry.getContractSLAs(contractId);
        require(slaIds.length == 2, "Should have 2 SLAs");
    }

    function test_CreateContractEmitsEvent() public {
        SLARegistry.SLAInput[] memory slas = new SLARegistry.SLAInput[](1);
        slas[0] = SLARegistry.SLAInput({
            id: "SLA-001",
            name: "Test SLA",
            description: "Test",
            target: 100,
            comparator: SLARegistry.Comparator.GE,
            status: true
        });
        
        SLARegistry.ContractInput memory contractInput = SLARegistry.ContractInput({
            id: "CONTRACT-001",
            path: "/test.pdf",
            customerId: "CUSTOMER-001",
            slas: slas
        });
        
        vm.expectEmit(true, true, false, true);
        emit SLARegistry.ContractCreated(1, "CUSTOMER-001", "CONTRACT-001", "/test.pdf", 1);
        registry.createContract(contractInput);
    }

    // ═══════════════════════════════════════════════════════════════════
    // METRIC REPORTING AND ALERTS
    // ═══════════════════════════════════════════════════════════════════

    function test_ReportMetric_Success() public {
        uint256 contractId = _createTestContract();
        uint256[] memory slaIds = registry.getContractSLAs(contractId);
        uint256 slaId = slaIds[0];
        
        vm.expectEmit(true, false, false, true);
        emit SLARegistry.SLAMetricReported(slaId, 20, true, "Delivered in 20h");
        
        registry.reportMetric(slaId, 20, "Delivered in 20h");
    }

    function test_ReportMetric_Violation_CreatesAlert() public {
        uint256 contractId = _createTestContract();
        uint256[] memory slaIds = registry.getContractSLAs(contractId);
        uint256 slaId = slaIds[0];
        
        // Report a violation (36h > 24h target)
        registry.reportMetric(slaId, 36, "Delivered in 36h - LATE");
        
        // Check alert was created
        uint256[] memory alerts = registry.getSLAAlerts(slaId);
        require(alerts.length == 1, "Should have 1 alert");
        
        // Verify alert details
        (
            uint256 alertId,
            uint256 alertSlaId,
            ,  // createdAt (unused)
            SLARegistry.AlertStatus status,
            string memory reason
        ) = registry.alerts(alerts[0]);
        
        require(alertId == 1, "Alert ID should be 1");
        require(alertSlaId == slaId, "Alert should reference correct SLA");
        require(status == SLARegistry.AlertStatus.Open, "Alert should be Open");
        require(keccak256(bytes(reason)) == keccak256(bytes("Delivered in 36h - LATE")), "Reason should match");
    }

    function test_ReportMetric_OnInactiveSLAFails() public {
        // Create contract with inactive SLA
        SLARegistry.SLAInput[] memory slas = new SLARegistry.SLAInput[](1);
        slas[0] = SLARegistry.SLAInput({
            id: "SLA-001",
            name: "Test SLA",
            description: "Test",
            target: 24,
            comparator: SLARegistry.Comparator.LE,
            status: false  // Inactive
        });
        
        SLARegistry.ContractInput memory contractInput = SLARegistry.ContractInput({
            id: "CONTRACT-001",
            path: "/test.pdf",
            customerId: "CUSTOMER-001",
            slas: slas
        });
        
        uint256 contractId = registry.createContract(contractInput);
        uint256[] memory slaIds = registry.getContractSLAs(contractId);
        
        vm.expectRevert("SLA not active");
        registry.reportMetric(slaIds[0], 20, "Test");
    }

    // ═══════════════════════════════════════════════════════════════════
    // ALERT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    function test_AcknowledgeAlert() public {
        uint256 alertId = _createTestAlert();
        
        vm.prank(opsUser);
        registry.acknowledgeAlert(alertId);
        
        (, , , SLARegistry.AlertStatus status, ) = registry.alerts(alertId);
        require(status == SLARegistry.AlertStatus.Acknowledged, "Alert should be Acknowledged");
    }

    function test_AcknowledgeAlert_UnauthorizedFails() public {
        uint256 alertId = _createTestAlert();
        
        address unauthorized = address(0x999);
        vm.prank(unauthorized);
        vm.expectRevert();
        registry.acknowledgeAlert(alertId);
    }

    function test_ResolveAlert() public {
        uint256 alertId = _createTestAlert();
        
        vm.prank(opsUser);
        registry.acknowledgeAlert(alertId);
        
        vm.prank(opsUser);
        registry.resolveAlert(alertId, "Issue fixed - driver rescheduled");
        
        (, , , SLARegistry.AlertStatus status, ) = registry.alerts(alertId);
        require(status == SLARegistry.AlertStatus.Resolved, "Alert should be Resolved");
    }

    function test_ResolveAlert_FromOpenStatus() public {
        uint256 alertId = _createTestAlert();
        
        // Can resolve directly from Open without acknowledging
        vm.prank(opsUser);
        registry.resolveAlert(alertId, "Quick fix applied");
        
        (, , , SLARegistry.AlertStatus status, ) = registry.alerts(alertId);
        require(status == SLARegistry.AlertStatus.Resolved, "Alert should be Resolved");
    }

    function test_ResolveAlert_UnauthorizedFails() public {
        uint256 alertId = _createTestAlert();
        
        address unauthorized = address(0x999);
        vm.prank(unauthorized);
        vm.expectRevert();
        registry.resolveAlert(alertId, "Not allowed");
    }

    // ═══════════════════════════════════════════════════════════════════
    // COMPARATOR LOGIC TESTS
    // ═══════════════════════════════════════════════════════════════════

    function test_Comparator_LE() public {
        uint256 slaId = _createSLAWithComparator(24, SLARegistry.Comparator.LE);
        
        // Should pass: 24 <= 24
        registry.reportMetric(slaId, 24, "At boundary");
        uint256[] memory alerts1 = registry.getSLAAlerts(slaId);
        require(alerts1.length == 0, "Should not create alert");
        
        // Should pass: 20 <= 24
        registry.reportMetric(slaId, 20, "Below target");
        uint256[] memory alerts2 = registry.getSLAAlerts(slaId);
        require(alerts2.length == 0, "Should not create alert");
        
        // Should fail: 25 > 24
        registry.reportMetric(slaId, 25, "Above target");
        uint256[] memory alerts3 = registry.getSLAAlerts(slaId);
        require(alerts3.length == 1, "Should create alert");
    }

    function test_Comparator_GE() public {
        uint256 slaId = _createSLAWithComparator(95, SLARegistry.Comparator.GE);
        
        // Should pass: 95 >= 95
        registry.reportMetric(slaId, 95, "At boundary");
        require(registry.getSLAAlerts(slaId).length == 0, "Should not create alert");
        
        // Should pass: 98 >= 95
        registry.reportMetric(slaId, 98, "Above target");
        require(registry.getSLAAlerts(slaId).length == 0, "Should not create alert");
        
        // Should fail: 94 < 95
        registry.reportMetric(slaId, 94, "Below target");
        require(registry.getSLAAlerts(slaId).length == 1, "Should create alert");
    }

    function test_Comparator_LT() public {
        uint256 slaId = _createSLAWithComparator(5, SLARegistry.Comparator.LT);
        
        // Should pass: 4 < 5
        registry.reportMetric(slaId, 4, "Below target");
        require(registry.getSLAAlerts(slaId).length == 0, "Should not create alert");
        
        // Should fail: 5 = 5 (not <)
        registry.reportMetric(slaId, 5, "At boundary");
        require(registry.getSLAAlerts(slaId).length == 1, "Should create alert");
    }

    function test_Comparator_GT() public {
        uint256 slaId = _createSLAWithComparator(50, SLARegistry.Comparator.GT);
        
        // Should pass: 51 > 50
        registry.reportMetric(slaId, 51, "Above target");
        require(registry.getSLAAlerts(slaId).length == 0, "Should not create alert");
        
        // Should fail: 50 = 50 (not >)
        registry.reportMetric(slaId, 50, "At boundary");
        require(registry.getSLAAlerts(slaId).length == 1, "Should create alert");
    }

    function test_Comparator_EQ() public {
        uint256 slaId = _createSLAWithComparator(100, SLARegistry.Comparator.EQ);
        
        // Should pass: 100 == 100
        registry.reportMetric(slaId, 100, "Exact match");
        require(registry.getSLAAlerts(slaId).length == 0, "Should not create alert");
        
        // Should fail: 99 != 100
        registry.reportMetric(slaId, 99, "Not equal");
        require(registry.getSLAAlerts(slaId).length == 1, "Should create alert");
    }

    function test_Comparator_NE() public {
        uint256 slaId = _createSLAWithComparator(0, SLARegistry.Comparator.NE);
        
        // Should pass: 1 != 0
        registry.reportMetric(slaId, 1, "Not equal");
        require(registry.getSLAAlerts(slaId).length == 0, "Should not create alert");
        
        // Should fail: 0 == 0
        registry.reportMetric(slaId, 0, "Equal");
        require(registry.getSLAAlerts(slaId).length == 1, "Should create alert");
    }

    // ═══════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    function test_GetClientContracts() public {
        _createTestContract();
        _createTestContract();
        
        uint256[] memory contracts = registry.getClientContracts("CUSTOMER-TEST");
        require(contracts.length == 2, "Should have 2 contracts");
        require(contracts[0] == 1, "First contract ID should be 1");
        require(contracts[1] == 2, "Second contract ID should be 2");
    }

    function test_GetContractSLAs() public {
        uint256 contractId = _createTestContract();
        
        uint256[] memory slaIds = registry.getContractSLAs(contractId);
        require(slaIds.length == 1, "Should have 1 SLA");
        require(slaIds[0] == 1, "SLA ID should be 1");
    }

    function test_GetSLAAlerts() public {
        uint256 contractId = _createTestContract();
        uint256[] memory slaIds = registry.getContractSLAs(contractId);
        uint256 slaId = slaIds[0];
        
        // Create 3 violations
        registry.reportMetric(slaId, 30, "Violation 1");
        registry.reportMetric(slaId, 35, "Violation 2");
        registry.reportMetric(slaId, 40, "Violation 3");
        
        uint256[] memory alerts = registry.getSLAAlerts(slaId);
        require(alerts.length == 3, "Should have 3 alerts");
    }

    // ═══════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    function _createTestContract() internal returns (uint256) {
        SLARegistry.SLAInput[] memory slas = new SLARegistry.SLAInput[](1);
        slas[0] = SLARegistry.SLAInput({
            id: "SLA-001",
            name: "Delivery Time",
            description: "Delivery within 24 hours",
            target: 24,
            comparator: SLARegistry.Comparator.LE,
            status: true
        });
        
        SLARegistry.ContractInput memory contractInput = SLARegistry.ContractInput({
            id: "CONTRACT-TEST",
            path: "/test.pdf",
            customerId: "CUSTOMER-TEST",
            slas: slas
        });
        
        return registry.createContract(contractInput);
    }

    function _createTestAlert() internal returns (uint256) {
        uint256 contractId = _createTestContract();
        uint256[] memory slaIds = registry.getContractSLAs(contractId);
        
        // Create a violation to generate an alert
        registry.reportMetric(slaIds[0], 36, "Violation");
        
        uint256[] memory alerts = registry.getSLAAlerts(slaIds[0]);
        return alerts[0];
    }

    function _createSLAWithComparator(
        int256 target,
        SLARegistry.Comparator comparator
    ) internal returns (uint256) {
        SLARegistry.SLAInput[] memory slas = new SLARegistry.SLAInput[](1);
        slas[0] = SLARegistry.SLAInput({
            id: "SLA-TEST",
            name: "Test SLA",
            description: "Test",
            target: target,
            comparator: comparator,
            status: true
        });
        
        SLARegistry.ContractInput memory contractInput = SLARegistry.ContractInput({
            id: "CONTRACT-TEST",
            path: "/test.pdf",
            customerId: "CUSTOMER-TEST",
            slas: slas
        });
        
        uint256 contractId = registry.createContract(contractInput);
        uint256[] memory slaIds = registry.getContractSLAs(contractId);
        return slaIds[0];
    }
}
