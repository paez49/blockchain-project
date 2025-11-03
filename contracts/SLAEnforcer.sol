// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

contract SLAEnforcer {

    // Enums for better type safety and gas efficiency
    enum Comparator { GREATER_THAN, LESS_THAN, EQUAL, GREATER_OR_EQUAL, LESS_OR_EQUAL }
    enum SLAStatus { ACTIVE, VIOLATED, COMPLIANT, INACTIVE }

    // SLA struct is used to store the SLA details
    struct SLA {
        string id;
        string name;
        string description;
        uint target;
        Comparator comparator;
        SLAStatus status;
    }

    // CustomerContract struct is used to store the customer contract details
    struct CustomerContract {
        string id;
        string path;
        string customerId;
        SLA[] slas;
    }

    // contracts array is used to store all the contracts
    CustomerContract[] public contracts;

    // Mapping for quick contract lookup by id
    mapping(string => uint) private contractIndexById;
    mapping(string => bool) private contractExists;

    // Events for transparency
    event ContractAdded(string indexed contractId, string customerId);
    event SLAAdded(string indexed contractId, string slaId);
    event SLAStatusUpdated(string indexed contractId, string indexed slaId, SLAStatus newStatus);

    // ============= Contract Management =============

    // Add a new customer contract
    function addContract(
        string calldata _id,
        string calldata _path,
        string calldata _customerId
    ) external {
        require(bytes(_id).length > 0, "Contract ID cannot be empty");
        require(!contractExists[_id], "Contract already exists");

        CustomerContract storage newContract = contracts.push();
        newContract.id = _id;
        newContract.path = _path;
        newContract.customerId = _customerId;

        contractIndexById[_id] = contracts.length - 1;
        contractExists[_id] = true;

        emit ContractAdded(_id, _customerId);
    }

    // Get a contract by id
    function getContract(string calldata _id) external view returns (
        string memory id,
        string memory path,
        string memory customerId,
        SLA[] memory slas
    ) {
        require(contractExists[_id], "Contract does not exist");

        uint index = contractIndexById[_id];
        CustomerContract storage c = contracts[index];

        return (c.id, c.path, c.customerId, c.slas);
    }

    // Get total number of contracts
    function getContractCount() external view returns (uint) {
        return contracts.length;
    }

    // Get all contracts with full details including SLAs
    function getAllContracts() external view returns (CustomerContract[] memory) {
        uint length = contracts.length;
        CustomerContract[] memory allContracts = new CustomerContract[](length);

        for (uint i = 0; i < length; i++) {
            CustomerContract storage c = contracts[i];

            // Create a new contract with SLA array
            CustomerContract memory contractCopy;
            contractCopy.id = c.id;
            contractCopy.path = c.path;
            contractCopy.customerId = c.customerId;

            // Copy SLAs
            uint slaLength = c.slas.length;
            contractCopy.slas = new SLA[](slaLength);
            for (uint j = 0; j < slaLength; j++) {
                contractCopy.slas[j] = c.slas[j];
            }

            allContracts[i] = contractCopy;
        }

        return allContracts;
    }

    // ============= SLA Management =============

    // Add an SLA to an existing contract
    function addSLA(
        string calldata _contractId,
        string calldata _slaId,
        string calldata _name,
        string calldata _description,
        uint _target,
        Comparator _comparator
    ) external {
        require(contractExists[_contractId], "Contract does not exist");
        require(bytes(_slaId).length > 0, "SLA ID cannot be empty");

        uint index = contractIndexById[_contractId];

        contracts[index].slas.push(SLA({
            id: _slaId,
            name: _name,
            description: _description,
            target: _target,
            comparator: _comparator,
            status: SLAStatus.ACTIVE
        }));

        emit SLAAdded(_contractId, _slaId);
    }

    // Get all SLAs for a contract
    function getSLAs(string calldata _contractId) external view returns (SLA[] memory) {
        require(contractExists[_contractId], "Contract does not exist");

        uint index = contractIndexById[_contractId];
        return contracts[index].slas;
    }

    // Get a specific SLA by contract id and sla index
    function getSLA(string calldata _contractId, uint _slaIndex) external view returns (
        string memory id,
        string memory name,
        string memory description,
        uint target,
        Comparator comparator,
        SLAStatus status
    ) {
        require(contractExists[_contractId], "Contract does not exist");

        uint contractIndex = contractIndexById[_contractId];
        require(_slaIndex < contracts[contractIndex].slas.length, "SLA index out of bounds");

        SLA storage sla = contracts[contractIndex].slas[_slaIndex];
        return (sla.id, sla.name, sla.description, sla.target, sla.comparator, sla.status);
    }

    // ============= SLA Enforcement =============

    // Check if a value meets SLA requirements
    function checkSLA(string calldata _contractId, uint _slaIndex, uint _actualValue) external {
        require(contractExists[_contractId], "Contract does not exist");

        uint contractIndex = contractIndexById[_contractId];
        require(_slaIndex < contracts[contractIndex].slas.length, "SLA index out of bounds");

        SLA storage sla = contracts[contractIndex].slas[_slaIndex];
        require(sla.status == SLAStatus.ACTIVE, "SLA is not active");

        bool isCompliant = compareValues(_actualValue, sla.target, sla.comparator);

        SLAStatus newStatus = isCompliant ? SLAStatus.COMPLIANT : SLAStatus.VIOLATED;
        sla.status = newStatus;

        emit SLAStatusUpdated(_contractId, sla.id, newStatus);
    }

    // Helper function to compare values based on comparator
    function compareValues(uint actual, uint target, Comparator comp) private pure returns (bool) {
        if (comp == Comparator.GREATER_THAN) {
            return actual > target;
        } else if (comp == Comparator.LESS_THAN) {
            return actual < target;
        } else if (comp == Comparator.EQUAL) {
            return actual == target;
        } else if (comp == Comparator.GREATER_OR_EQUAL) {
            return actual >= target;
        } else if (comp == Comparator.LESS_OR_EQUAL) {
            return actual <= target;
        }
        return false;
    }

    // Set SLA status manually (for administrative purposes)
    function setSLAStatus(string calldata _contractId, uint _slaIndex, SLAStatus _status) external {
        require(contractExists[_contractId], "Contract does not exist");

        uint contractIndex = contractIndexById[_contractId];
        require(_slaIndex < contracts[contractIndex].slas.length, "SLA index out of bounds");

        SLA storage sla = contracts[contractIndex].slas[_slaIndex];
        sla.status = _status;

        emit SLAStatusUpdated(_contractId, sla.id, _status);
    }

}