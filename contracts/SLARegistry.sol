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
    bytes32 public constant CONTRACT_MS_ROLE = keccak256("CONTRACT_MS_ROLE"); // microservicio de Contratos
    bytes32 public constant NOVELTIES_MS_ROLE = keccak256("NOVELTIES_MS_ROLE"); // microservicio de Novedades
    bytes32 public constant OPS_ROLE = keccak256("OPS_ROLE"); // Operaciones (ack/resolver alertas)

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CONTRACT_MS_ROLE, admin);
        _grantRole(NOVELTIES_MS_ROLE, admin);
        _grantRole(OPS_ROLE, admin);
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
        uint256 id;
        uint256 clientId;
        string externalId; // External ID from the backend system
        string path; // Path to the contract document
        bool active;
    }

    struct SLA {
        uint256 id;
        uint256 contractId;
        string externalId; // External ID from the backend system
        string name; // ej. "Entrega <= 24h"
        string description; // Descripción detallada del SLA
        int256 target; // umbral (ej. 24 si son horas; o 95 si es %)
        Comparator comparator; // cómo evaluar
        bool status; // true = activo, false = pausado
        uint64 windowSeconds; // ventana de tiempo para evaluación
        uint64 lastReportAt; // último reporte
        uint256 consecutiveBreaches; // incumplimientos consecutivos
        uint256 totalBreaches; // total de incumplimientos
        uint256 totalPass; // total de cumplimientos
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
        string id; // External ID from the backend system
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
    uint256 private _clientIds;
    uint256 private _contractIds;
    uint256 private _slaIds;
    uint256 private _alertIds;

    mapping(uint256 => Client) public clients;
    mapping(uint256 => ClientContract) public contractsById;
    mapping(uint256 => SLA) public slas;
    mapping(uint256 => Alert) public alerts;

    // Índices básicos
    mapping(uint256 => uint256[]) public clientContracts; // clientId => contractIds
    mapping(uint256 => uint256[]) public contractSLAs; // contractId => slaIds
    mapping(uint256 => uint256[]) public slaAlerts; // slaId => alertIds

    // Mapping for external contract IDs
    mapping(string => uint256) public externalContractIdToInternalId; // externalId => contractId

    // ───────────────────────────── EVENTS ────────────────────────────
    event ContractCreated(
        uint256 indexed contractId,
        uint256 indexed clientId,
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

    // ──────────── 1b) CREAR CONTRATO (con estructura completa) ───────
    function createContract(
        ContractInput calldata contractInput
    ) external onlyRole(CONTRACT_MS_ROLE) returns (uint256 contractId) {
        require(clients[contractInput.customerId].active, "Client not active");
        require(
            bytes(contractInput.id).length > 0,
            "External contract ID required"
        );
        require(
            externalContractIdToInternalId[contractInput.id] == 0,
            "Contract ID already exists"
        );

        _contractIds++;
        contractId = _contractIds;

        contractsById[contractId] = ClientContract({
            id: contractId,
            clientId: contractInput.customerId,
            externalId: contractInput.id,
            path: contractInput.path,
            active: true
        });

        clientContracts[contractInput.customerId].push(contractId);
        externalContractIdToInternalId[contractInput.id] = contractId;

        // Create SLAs associated with this contract
        for (uint256 i = 0; i < contractInput.slas.length; i++) {
            SLAInput calldata slaInput = contractInput.slas[i];

            _slaIds++;
            uint256 slaId = _slaIds;

            slas[slaId] = SLA({
                id: slaId,
                contractId: contractId,
                externalId: slaInput.id,
                name: slaInput.name,
                description: slaInput.description,
                target: slaInput.target,
                comparator: slaInput.comparator,
                status: slaInput.status,
                windowSeconds: 0,
                lastReportAt: 0,
                consecutiveBreaches: 0,
                totalBreaches: 0,
                totalPass: 0
            });

            contractSLAs[contractId].push(slaId);

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
            contractInput.id,
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
        onlyRole(CONTRACT_MS_ROLE) // o el servicio que recolecte KPIs
    {
        SLA storage s = slas[slaId];
        require(s.status, "SLA not active");

        bool ok = _compare(observed, s.target, s.comparator);
        s.lastReportAt = uint64(block.timestamp);

        if (ok) {
            s.consecutiveBreaches = 0;
            s.totalPass += 1;
            emit SLAMetricReported(slaId, uint256(observed), true, note);
        } else {
            s.consecutiveBreaches += 1;
            s.totalBreaches += 1;
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
    function acknowledgeAlert(uint256 alertId) external onlyRole(OPS_ROLE) {
        Alert storage a = alerts[alertId];
        require(a.status == AlertStatus.Open, "Alert not open");
        a.status = AlertStatus.Acknowledged;
        emit AlertAcknowledged(alertId, msg.sender);
    }

    function resolveAlert(
        uint256 alertId,
        string calldata resolutionNote
    ) external onlyRole(OPS_ROLE) {
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
        uint256 clientId
    ) external view returns (uint256[] memory) {
        return clientContracts[clientId];
    }

    function getContractSLAs(
        uint256 contractId
    ) external view returns (uint256[] memory) {
        return contractSLAs[contractId];
    }

    function getSLAAlerts(
        uint256 slaId
    ) external view returns (uint256[] memory) {
        return slaAlerts[slaId];
    }
}
