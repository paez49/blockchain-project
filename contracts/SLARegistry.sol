// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SLARegistry
 * @dev Registro de Clientes, Contratos (con hash/IPFS del documento legal) y SLAs con alertas por incumplimiento.
 * - Microservicio "Contratos" registra clientes/contratos/SLAs.
 * - Microservicio "Novedades" puede ajustar/pausar SLAs cuando llegan novedades operativas.
 * - Cualquier reporte de métrica que incumpla dispara un evento de alerta.
 *
 * Eventos = "webhooks" on-chain: los escuchas con tu backend para notificar (email, Slack, etc.)
 */

import "@openzeppelin/contracts/access/AccessControl.sol";

contract SLARegistry is AccessControl {
    // ───────────────────────────── ROLES ─────────────────────────────


    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ──────────────────────────── TYPES ──────────────────────────────
    enum Comparator {
        GT, // ">"  Greater
        LT, // "<"  Less
        EQ, // "==" Equal
        NE, // "!=" NotEqual
        GE, // ">=" GreaterOrEqual
        LE // "<=" LessOrEqual
    } // cómo comparar observed vs target
    enum AlertStatus {
        Open,
        Acknowledged,
        Resolved
    }

    struct Client {
        uint256 id;
        string name; // opcional (para referencia off-chain)
        address account; // dueño/propietario lógico (opcional)
        bool active;
    }

    struct ClientContract {
        string id;
        string clientId;
        string path; // Path to the contract document
        bool active;
    }

    struct SLA {
        string id; // External ID
        string name;
        string description;
        int256 target;
        Comparator comparator;
        bool status;
    }

    struct SLAInput {
        string id; // External ID
        string name;
        string description;
        int256 target;
        Comparator comparator;
        bool status;
    }

    struct ContractInput {
        string id; 
        string path; // Path to the contract document (replaces ipfsCid)
        string customerId; // Client ID (replaces clientId)
        SLAInput[] slas; // Array of SLAs to create with the contract
    }

    struct Alert {
        uint256 id;
        uint256 slaId;
        uint64 createdAt;
        AlertStatus status;
        string reason; // texto libre corto: por qué se disparó (ej. "Tiempo=36h > 24h")
    }

    // ──────────────────────────── STORAGE ────────────────────────────
    
    uint256 private _contractIds;
    uint256 private _slaIds;
    uint256 private _alertIds;

    mapping(uint256 => Client) public clients;
    mapping(string => ClientContract) public contractsById;
    mapping(uint256 => SLA) public slas;
    mapping(uint256 => Alert) public alerts;

    // Índices básicos
    mapping(string => string[]) public clientContracts; // clientId (string) => contract string IDs
    mapping(string => uint256[]) public contractSLAs; // contract string ID => slaIds
    mapping(uint256 => uint256[]) public slaAlerts; // slaId => alertIds

    // Mapping for external contract IDs
    mapping(string => uint256) public externalContractIdToInternalId; // externalId => contractId

    // ───────────────────────────── EVENTS ────────────────────────────
    event ContractCreated(
        uint256 indexed contractId,
        string indexed clientId,
        string externalId,
        string path,
        uint256 slaCount
    );

    event SLACreated(
        uint256 indexed slaId,
        uint256 indexed contractId,
        string name,
        uint256 target,
        Comparator comparator,
        uint64 windowSeconds
    );

    event SLAMetricReported(
        uint256 indexed slaId,
        uint256 observed,
        bool success,
        string note
    );

    event SLAViolated(
        // <— ALERTA para que tu backend notifique
        uint256 indexed alertId,
        uint256 indexed slaId,
        string reason
    );

    event AlertAcknowledged(uint256 indexed alertId, address by);
    event AlertResolved(
        uint256 indexed alertId,
        address by,
        string resolutionNote
    );

    event NoveltyApplied(
        // <— cuando Novedades modifica un SLA
        uint256 indexed slaId,
        string field,
        string detail
    );

    event SLAStatusChanged(uint256 indexed slaId, bool isActive);

    // ─────────────────────────── UTILIDADES ──────────────────────────
    function _compare(
        int256 observed,
        int256 target,
        Comparator cmp
    ) internal pure returns (bool) {
        if (cmp == Comparator.GT) return observed > target;
        if (cmp == Comparator.LT) return observed < target;
        if (cmp == Comparator.EQ) return observed == target;
        if (cmp == Comparator.NE) return observed != target;
        if (cmp == Comparator.GE) return observed >= target;
        if (cmp == Comparator.LE) return observed <= target;
        return false;
    }

    function createContract(
        ContractInput calldata contractInput
    ) external returns (uint256 contractId) {
        
        _contractIds++;
        contractId = _contractIds;
 
        contractsById[contractInput.id] = ClientContract({
            id: contractInput.id,
            clientId: contractInput.customerId,
            path: contractInput.path,
            active: true
        });

        // Map external string ID to internal numeric ID
        externalContractIdToInternalId[contractInput.id] = contractId;

        // Store string contract ID in client contracts array
        clientContracts[contractInput.customerId].push(contractInput.id);

        // Create SLAs associated with this contract
        for (uint256 i = 0; i < contractInput.slas.length; i++) {
            SLAInput calldata slaInput = contractInput.slas[i];

            _slaIds++;
            uint256 slaId = _slaIds;

            slas[slaId] = SLA({
                id: slaInput.id,
                name: slaInput.name,
                description: slaInput.description,
                target: slaInput.target,
                comparator: slaInput.comparator,
                status: slaInput.status
            });

            contractSLAs[contractInput.id].push(slaId);

            emit SLACreated(
                slaId,
                contractId,
                slaInput.name,
                uint256(slaInput.target),
                slaInput.comparator,
                0
            );
        }

        emit ContractCreated(
            contractId,
            contractInput.customerId,
            "", // externalId - you may want to add this to ContractInput if needed
            contractInput.path,
            contractInput.slas.length
        );
    }
    // ───────────── 3) REPORTE DE MÉTRICA (genera alerta si falla) ────
    /**
     * @param slaId     SLA a evaluar
     * @param observed  Valor observado (ej. 36 si fueron 36h; 92 si es 92%)
     * @param note      Texto breve (ej. "Pedido 1234 - entrega 36h")
     */
    function reportMetric(
        uint256 slaId,
        int256 observed,
        string calldata note
    )
        external
       
    {
        SLA storage s = slas[slaId];
        require(s.status, "SLA not active");

        bool ok = _compare(observed, s.target, s.comparator);
       

        if (ok) {
            emit SLAMetricReported(slaId, uint256(observed), true, note);
        } else {
            emit SLAMetricReported(slaId, uint256(observed), false, note);

            // Crear alerta
            _alertIds++;
            uint256 alertId = _alertIds;

            alerts[alertId] = Alert({
                id: alertId,
                slaId: slaId,
                createdAt: uint64(block.timestamp),
                status: AlertStatus.Open,
                reason: note
            });

            slaAlerts[slaId].push(alertId);
            emit SLAViolated(alertId, slaId, note); // <— escuchado por tu backend para notificar
        }
    }

    // ───────────── ACK/RESOLVER ALERTAS (Operaciones) ────────────────
    function acknowledgeAlert(uint256 alertId) external  {
        Alert storage a = alerts[alertId];
        require(a.status == AlertStatus.Open, "Alert not open");
        a.status = AlertStatus.Acknowledged;
        emit AlertAcknowledged(alertId, msg.sender);
    }

    function resolveAlert(
        uint256 alertId,
        string calldata resolutionNote
    ) external  {
        Alert storage a = alerts[alertId];
        require(
            a.status == AlertStatus.Acknowledged ||
                a.status == AlertStatus.Open,
            "Alert not open/ack"
        );
        a.status = AlertStatus.Resolved;
        emit AlertResolved(alertId, msg.sender, resolutionNote);
    }

    // ────────────────────────── VIEWS ÚTILES ─────────────────────────
    function getClientContracts(
        string calldata clientId
    ) external view returns (string[] memory) {
        return clientContracts[clientId];
    }

    function getContractSLAs(
        string calldata contractId
    ) external view returns (uint256[] memory) {
        return contractSLAs[contractId];
    }

    function getSLAAlerts(
        uint256 slaId
    ) external view returns (uint256[] memory) {
        return slaAlerts[slaId];
    }
}
