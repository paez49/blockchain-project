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
        LT,
        LE,
        EQ,
        GE,
        GT
    } // cómo comparar observed vs target
    enum SLAStatus {
        Active,
        Paused,
        Archived
    }
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
        string ipfsCid; // CID del documento legal en IPFS (contrato real)
        uint64 startDate; // epoch
        uint64 endDate; // epoch (0 si indeterminado)
        bool active;
    }

    struct SLA {
        uint256 id;
        uint256 contractId;
        string name; // ej. "Entrega <= 24h"
        uint256 target; // umbral (ej. 24 si son horas; o 95 si es %)
        Comparator comparator; // cómo evaluar
        SLAStatus status; // activo/pausa/archivo
        uint64 windowSeconds; // ventana de observación (si aplica)
        uint64 lastReportAt; // timestamp último reporte
        uint32 consecutiveBreaches; // contadores simples
        uint32 totalBreaches;
        uint32 totalPass;
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

    // ───────────────────────────── EVENTS ────────────────────────────
    event ContractCreated(
        uint256 indexed contractId,
        uint256 indexed clientId,
        string ipfsCid,
        uint64 startDate,
        uint64 endDate
    );
    event ContractUpdated(uint256 indexed contractId, string newIpfsCid);

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

    event SLAViolated(// <— ALERTA para que tu backend notifique
    uint256 indexed alertId, uint256 indexed slaId, string reason);

    event AlertAcknowledged(uint256 indexed alertId, address by);
    event AlertResolved(
        uint256 indexed alertId,
        address by,
        string resolutionNote
    );

    event NoveltyApplied(// <— cuando Novedades modifica un SLA
    uint256 indexed slaId, string field, string detail);

    event SLAStatusChanged(uint256 indexed slaId, SLAStatus newStatus);

    // ─────────────────────────── UTILIDADES ──────────────────────────
    function _compare(
        uint256 observed,
        uint256 target,
        Comparator cmp
    ) internal pure returns (bool) {
        if (cmp == Comparator.LT) return observed < target;
        if (cmp == Comparator.LE) return observed <= target;
        if (cmp == Comparator.EQ) return observed == target;
        if (cmp == Comparator.GE) return observed >= target;
        if (cmp == Comparator.GT) return observed > target;
        return false;
    }

    // ────────────────────── 1) REGISTRO DE CLIENTE ───────────────────
    function registerClient(
        string calldata name,
        address account
    ) external onlyRole(CONTRACT_MS_ROLE) returns (uint256 clientId) {
        _clientIds++;
        clientId = _clientIds;

        clients[clientId] = Client({
            id: clientId,
            name: name,
            account: account,
            active: true
        });

    }

    // ──────────── 1b) CREAR CONTRATO (con hash/CID IPFS legal) ───────
    function createContract(
        uint256 clientId,
        string calldata ipfsCid,
        uint64 startDate,
        uint64 endDate
    ) external onlyRole(CONTRACT_MS_ROLE) returns (uint256 contractId) {
        require(clients[clientId].active, "Client not active");

        _contractIds++;
        contractId = _contractIds;

        contractsById[contractId] = ClientContract({
            id: contractId,
            clientId: clientId,
            ipfsCid: ipfsCid,
            startDate: startDate,
            endDate: endDate,
            active: true
        });

        clientContracts[clientId].push(contractId);

        emit ContractCreated(contractId, clientId, ipfsCid, startDate, endDate);
    }

    // Opcional: actualizar/rotar el documento legal (nuevo CID/IPFS)
    function updateContractIPFS(
        uint256 contractId,
        string calldata newCid
    ) external onlyRole(CONTRACT_MS_ROLE) {
        require(contractsById[contractId].active, "Contract not active");
        contractsById[contractId].ipfsCid = newCid;
        emit ContractUpdated(contractId, newCid);
    }

    // ──────────── 2) DEFINIR SLA (objetivo, comparador, ventana) ─────
    function addSLA(
        uint256 contractId,
        string calldata name,
        uint256 target,
        Comparator comparator,
        uint64 windowSeconds
    ) external onlyRole(CONTRACT_MS_ROLE) returns (uint256 slaId) {
        require(contractsById[contractId].active, "Contract not active");

        _slaIds++;
        slaId = _slaIds;

        slas[slaId] = SLA({
            id: slaId,
            contractId: contractId,
            name: name,
            target: target,
            comparator: comparator,
            status: SLAStatus.Active,
            windowSeconds: windowSeconds,
            lastReportAt: 0,
            consecutiveBreaches: 0,
            totalBreaches: 0,
            totalPass: 0
        });

        contractSLAs[contractId].push(slaId);

        emit SLACreated(
            slaId,
            contractId,
            name,
            target,
            comparator,
            windowSeconds
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
        uint256 observed,
        string calldata note
    )
        external
        onlyRole(CONTRACT_MS_ROLE) // o el servicio que recolecte KPIs
    {
        SLA storage s = slas[slaId];
        require(s.status == SLAStatus.Active, "SLA not active");

        bool ok = _compare(observed, s.target, s.comparator);
        s.lastReportAt = uint64(block.timestamp);

        if (ok) {
            s.consecutiveBreaches = 0;
            s.totalPass += 1;
            emit SLAMetricReported(slaId, observed, true, note);
        } else {
            s.consecutiveBreaches += 1;
            s.totalBreaches += 1;
            emit SLAMetricReported(slaId, observed, false, note);

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

    // ───────────── 4) NOVEDADES: modificar/pausar un SLA ─────────────
    function pauseSLA(
        uint256 slaId,
        string calldata reason
    ) external onlyRole(NOVELTIES_MS_ROLE) {
        SLA storage s = slas[slaId];
        require(s.status == SLAStatus.Active, "SLA not active");
        s.status = SLAStatus.Paused;
        emit SLAStatusChanged(slaId, s.status);
        emit NoveltyApplied(slaId, "status", reason);
    }

    function resumeSLA(
        uint256 slaId,
        string calldata reason
    ) external onlyRole(NOVELTIES_MS_ROLE) {
        SLA storage s = slas[slaId];
        require(s.status == SLAStatus.Paused, "SLA not paused");
        s.status = SLAStatus.Active;
        emit SLAStatusChanged(slaId, s.status);
        emit NoveltyApplied(slaId, "status", reason);
    }

    // Cambiar el objetivo/umbral ante una novedad (p. ej., bloqueo de vías → objetivo pasa de 24h a 36h)
    function updateSLATarget(
        uint256 slaId,
        uint256 newTarget,
        string calldata reason
    ) external onlyRole(NOVELTIES_MS_ROLE) {
        SLA storage s = slas[slaId];
        s.target = newTarget;
        emit NoveltyApplied(slaId, "target", reason);
    }

    // Cambiar el comparador (ej. de <= a <) o ventana
    function updateSLAParams(
        uint256 slaId,
        Comparator newComparator,
        uint64 newWindowSeconds,
        string calldata reason
    ) external onlyRole(NOVELTIES_MS_ROLE) {
        SLA storage s = slas[slaId];
        s.comparator = newComparator;
        s.windowSeconds = newWindowSeconds;
        emit NoveltyApplied(slaId, "comparator|window", reason);
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

