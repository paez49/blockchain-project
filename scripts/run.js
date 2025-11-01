import { ethers } from "ethers";
// 1. Connect to the contract (Replace with your provider/RPC)
const provider = new ethers.JsonRpcProvider("https://rpc-amoy.polygon.technology");
const privateKey = "7bc39dec01d203b967cc180cf00d6d3a53e6ca3abcb1f686a64df36c3b9a1f7a";
const wallet = new ethers.Wallet(privateKey, provider);

// 2. Contract ABI (auto-generated from Remix: Compile → ABI)
const abi = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "admin",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "AccessControlBadConfirmation",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"internalType": "bytes32",
				"name": "neededRole",
				"type": "bytes32"
			}
		],
		"name": "AccessControlUnauthorizedAccount",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "alertId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "by",
				"type": "address"
			}
		],
		"name": "AlertAcknowledged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "alertId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "by",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "resolutionNote",
				"type": "string"
			}
		],
		"name": "AlertResolved",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "contractId",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "string",
				"name": "clientId",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "externalId",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "path",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "slaCount",
				"type": "uint256"
			}
		],
		"name": "ContractCreated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "slaId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "field",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "detail",
				"type": "string"
			}
		],
		"name": "NoveltyApplied",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "previousAdminRole",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "newAdminRole",
				"type": "bytes32"
			}
		],
		"name": "RoleAdminChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "RoleGranted",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			}
		],
		"name": "RoleRevoked",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "slaId",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "contractId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "name",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "target",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "enum SLARegistry.Comparator",
				"name": "comparator",
				"type": "uint8"
			},
			{
				"indexed": false,
				"internalType": "uint64",
				"name": "windowSeconds",
				"type": "uint64"
			}
		],
		"name": "SLACreated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "slaId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "observed",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "success",
				"type": "bool"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "note",
				"type": "string"
			}
		],
		"name": "SLAMetricReported",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "slaId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "isActive",
				"type": "bool"
			}
		],
		"name": "SLAStatusChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "alertId",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "slaId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "reason",
				"type": "string"
			}
		],
		"name": "SLAViolated",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "DEFAULT_ADMIN_ROLE",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "alertId",
				"type": "uint256"
			}
		],
		"name": "acknowledgeAlert",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "alerts",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "id",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "slaId",
				"type": "uint256"
			},
			{
				"internalType": "uint64",
				"name": "createdAt",
				"type": "uint64"
			},
			{
				"internalType": "enum SLARegistry.AlertStatus",
				"name": "status",
				"type": "uint8"
			},
			{
				"internalType": "string",
				"name": "reason",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "clientContracts",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "clients",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "id",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "name",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "active",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "contractSLAs",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"name": "contractsById",
		"outputs": [
			{
				"internalType": "string",
				"name": "id",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "clientId",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "path",
				"type": "string"
			},
			{
				"internalType": "bool",
				"name": "active",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"components": [
					{
						"internalType": "string",
						"name": "id",
						"type": "string"
					},
					{
						"internalType": "string",
						"name": "path",
						"type": "string"
					},
					{
						"internalType": "string",
						"name": "customerId",
						"type": "string"
					},
					{
						"components": [
							{
								"internalType": "string",
								"name": "id",
								"type": "string"
							},
							{
								"internalType": "string",
								"name": "name",
								"type": "string"
							},
							{
								"internalType": "string",
								"name": "description",
								"type": "string"
							},
							{
								"internalType": "int256",
								"name": "target",
								"type": "int256"
							},
							{
								"internalType": "enum SLARegistry.Comparator",
								"name": "comparator",
								"type": "uint8"
							},
							{
								"internalType": "bool",
								"name": "status",
								"type": "bool"
							}
						],
						"internalType": "struct SLARegistry.SLAInput[]",
						"name": "slas",
						"type": "tuple[]"
					}
				],
				"internalType": "struct SLARegistry.ContractInput",
				"name": "contractInput",
				"type": "tuple"
			}
		],
		"name": "createContract",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "contractId",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"name": "externalContractIdToInternalId",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "clientId",
				"type": "string"
			}
		],
		"name": "getClientContracts",
		"outputs": [
			{
				"internalType": "string[]",
				"name": "",
				"type": "string[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "contractId",
				"type": "string"
			}
		],
		"name": "getContractSLAs",
		"outputs": [
			{
				"internalType": "uint256[]",
				"name": "",
				"type": "uint256[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			}
		],
		"name": "getRoleAdmin",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "slaId",
				"type": "uint256"
			}
		],
		"name": "getSLAAlerts",
		"outputs": [
			{
				"internalType": "uint256[]",
				"name": "",
				"type": "uint256[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "grantRole",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "hasRole",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "callerConfirmation",
				"type": "address"
			}
		],
		"name": "renounceRole",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "slaId",
				"type": "uint256"
			},
			{
				"internalType": "int256",
				"name": "observed",
				"type": "int256"
			},
			{
				"internalType": "string",
				"name": "note",
				"type": "string"
			}
		],
		"name": "reportMetric",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "alertId",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "resolutionNote",
				"type": "string"
			}
		],
		"name": "resolveAlert",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "role",
				"type": "bytes32"
			},
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "revokeRole",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "slaAlerts",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "slas",
		"outputs": [
			{
				"internalType": "string",
				"name": "id",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "name",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "description",
				"type": "string"
			},
			{
				"internalType": "int256",
				"name": "target",
				"type": "int256"
			},
			{
				"internalType": "enum SLARegistry.Comparator",
				"name": "comparator",
				"type": "uint8"
			},
			{
				"internalType": "bool",
				"name": "status",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes4",
				"name": "interfaceId",
				"type": "bytes4"
			}
		],
		"name": "supportsInterface",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];
const contractAddress = "0x68761395181Ce2163fEEFAA1e4aEd0dcC8B92143";
const slaRegistry = new ethers.Contract(contractAddress, abi, wallet);

// 3. Create a contract with SLAs
async function createContractExample() {
  const contractInput = {
    id: "1",
    path: "bafkreihu2rd6n7y2jxwlor5vyk5ijzabx63kxanhjzmnqokqeqo7bgvzpi",
    customerId: "1",
    slas: [
      {
        id: "SLA-DELIVERY-1",
        name: "Delivery Time",
        description: "Max 24h delivery for urgent orders",
        target: 24,                     // 24 hours
        comparator: 1,                 // LT ("<")
        status: true
      },
      {
        id: "SLA-ACCURACY-1",
        name: "Order Accuracy",
        description: "95%+ order accuracy",
        target: 95,                     // 95%
        comparator: 4,                 // GE (">=")
        status: true
      }
    ]
  };

  console.log("📝 Creating contract with ID:", contractInput.id);
  console.log("👤 Customer ID:", contractInput.customerId);
  
  const tx = await slaRegistry.createContract(contractInput);
  console.log("⏳ Waiting for transaction confirmation...");
  const receipt = await tx.wait();
  
  console.log("✅ Contract created with SLAs!");
  console.log("📦 Tx Hash:", receipt.hash);
  console.log("🔗 Block Number:", receipt.blockNumber);
  
  // Parse the events to get the contract ID
  const contractCreatedEvent = receipt.logs.find(
    (log) => {
      try {
        const parsed = slaRegistry.interface.parseLog(log);
        return parsed && parsed.name === "ContractCreated";
      } catch (e) {
        return false;
      }
    }
  );
  
  if (contractCreatedEvent) {
    const parsed = slaRegistry.interface.parseLog(contractCreatedEvent);
    console.log("🆔 Internal Contract ID:", parsed.args.contractId.toString());
    console.log("📊 SLAs Created:", parsed.args.slaCount.toString());
  }
  
  return receipt;
}

// 4. Report a metric (trigger alert if violated)
async function reportMetricExample() {
  // Get SLA IDs for the contract using the correct contract ID
  const slaIds = await slaRegistry.getContractSLAs("1"); // Use "1" which matches the created contract
  console.log("📋 Available SLA IDs:", slaIds.map(id => id.toString()));
  
  if (slaIds.length === 0) {
    console.log("❌ No SLAs found for this contract!");
    return;
  }
  
  const deliverySlaId = slaIds[0];  // First SLA (Delivery Time - target < 24h)
  console.log("\n🎯 Testing SLA ID:", deliverySlaId.toString());
  
  // Get SLA details before reporting
  const slaData = await slaRegistry.slas(deliverySlaId);
  console.log("📝 SLA Details:");
  console.log("   Name:", slaData.name);
  console.log("   Target:", slaData.target.toString());
  console.log("   Comparator:", slaData.comparator, "(1 = LT '<')");
  console.log("   Status:", slaData.status ? "Active" : "Inactive");

  // Report a metric that VIOLATES the SLA (36h > 24h target with LT comparator)
  console.log("\n📊 Reporting metric: 36 hours (should violate 24h target)");
  const tx = await slaRegistry.reportMetric(
    deliverySlaId,
    36,                               // Observed value (36 hours)
    "Order #1234 - Delivery took 36h"
  );
  
  console.log("⏳ Waiting for transaction confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed!");
  console.log("📦 Tx Hash:", receipt.hash);

  // Parse all events to see what happened
  console.log("\n📢 Events emitted:");
  for (const log of receipt.logs) {
    try {
      const parsed = slaRegistry.interface.parseLog(log);
      if (parsed) {
        console.log(`   - ${parsed.name}`);
        if (parsed.name === "SLAMetricReported") {
          console.log(`     SLA ID: ${parsed.args.slaId.toString()}`);
          console.log(`     Observed: ${parsed.args.observed.toString()}`);
          console.log(`     Success: ${parsed.args.success}`);
          console.log(`     Note: ${parsed.args.note}`);
        } else if (parsed.name === "SLAViolated") {
          console.log(`     Alert ID: ${parsed.args.alertId.toString()}`);
          console.log(`     SLA ID: ${parsed.args.slaId.toString()}`);
          console.log(`     Reason: ${parsed.args.reason}`);
        }
      }
    } catch (e) {
      // Skip logs that aren't from our contract
    }
  }

  // Find the SLAViolated event
  const slaViolatedEvent = receipt.logs.find(
    (log) => {
      try {
        const parsed = slaRegistry.interface.parseLog(log);
        return parsed && parsed.name === "SLAViolated";
      } catch (e) {
        return false;
      }
    }
  );
  
  if (slaViolatedEvent) {
    const parsed = slaRegistry.interface.parseLog(slaViolatedEvent);
    const alertId = parsed.args.alertId;
    console.log(`\n🚨 Alert triggered! Alert ID: ${alertId.toString()}`);
    return alertId;
  } else {
    console.log("\n✅ No alert triggered - metric passed SLA requirements");
    return null;
  }
}

// 5. Acknowledge and resolve the alert
async function manageAlertExample(alertId) {
  // Acknowledge
  let tx = await slaRegistry.acknowledgeAlert(alertId);
  await tx.wait();
  console.log("📌 Alert acknowledged!");

  // Resolve
  tx = await slaRegistry.resolveAlert(
    alertId,
    "Root cause: Courier delay. Compensated client with 10% discount."
  );
  await tx.wait();
  console.log("✅ Alert resolved!");
}

// 6. Query data
async function queryExample() {
  try {
    console.log("🔍 Attempting to query contract data...");
    
    // First, try to query the contract directly by ID
    console.log("\n1️⃣ Querying contract by ID '1'...");
    try {
      const contractData = await slaRegistry.contractsById("1");
      console.log("✅ Contract Details:", {
        id: contractData.id,
        clientId: contractData.clientId,
        path: contractData.path,
        active: contractData.active
      });
    } catch (e) {
      console.log("❌ Contract not found:", e.message);
    }
    
    // Get all contracts for a client (use "1" which matches customerId in createContract)
    console.log("\n2️⃣ Querying contracts for customerId '1'...");
    const contracts = await slaRegistry.getClientContracts("1");
    console.log("📋 Contracts array:", contracts);
    
    if (contracts.length === 0) {
      console.log("⚠️  Empty array returned - no contracts found for this customer.");
      console.log("\n🔧 Debugging tips:");
      console.log("   - Check if the contract address is correct");
      console.log("   - Verify you're on the right network");
      console.log("   - Make sure the createContract transaction was successful");
      return;
    }

    // Get all SLAs for a contract (use "1" which matches the contract id)
    console.log("\n3️⃣ Querying SLAs for contract '1'...");
    const slaIds = await slaRegistry.getContractSLAs("1");
    console.log("📊 SLA IDs:", slaIds);

    // Get all alerts for an SLA (if any SLAs exist)
    if (slaIds.length > 0) {
      console.log("\n4️⃣ Querying SLA details...");
      
      // Query all SLAs
      for (let i = 0; i < slaIds.length; i++) {
        const slaId = slaIds[i];
        const slaData = await slaRegistry.slas(slaId);
        const alerts = await slaRegistry.getSLAAlerts(slaId);
        
        console.log(`\n   SLA #${i + 1} (ID: ${slaId.toString()}):`);
        console.log("   ├─ Name:", slaData.name);
        console.log("   ├─ Description:", slaData.description);
        console.log("   ├─ Target:", slaData.target.toString());
        console.log("   ├─ Comparator:", slaData.comparator);
        console.log("   ├─ Status:", slaData.status ? "Active" : "Inactive");
        console.log("   └─ Alerts:", alerts.length);
      }
    } else {
      console.log("⚠️  No SLAs found for this contract.");
    }
    
  } catch (error) {
    if (error.code === 'BAD_DATA' && error.value === '0x') {
      console.log("\n❌ BAD_DATA error - the contract returned empty data");
      console.log("💡 This typically means:");
      console.log("   1. The mapping doesn't have data for this key");
      console.log("   2. You're connected to a different contract than expected");
      console.log("   3. The contract state was reset");
      console.log("\n📍 Current contract address:", contractAddress);
    } else {
      console.error("\n❌ Unexpected error:", error.message);
      console.error("Full error:", error);
    }
  }
}

// Run the example
(async () => {
  try {
    // Create a contract with SLAs
    await createContractExample();
    
    // Wait a moment for the transaction to propagate (especially on testnets)
    console.log("\n⏸️  Waiting 2 seconds for transaction to propagate...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Query the data to verify it was stored correctly
    console.log("\n📊 Querying stored data...");
    await queryExample();
    
    // Test metric reporting and alert management
    console.log("\n📈 Testing reportMetric function...");
    await reportMetricExample();
    
    // Query alerts that were created
    const slaIds = await slaRegistry.getContractSLAs("1");
    if (slaIds.length > 0) {
      const alerts = await slaRegistry.getSLAAlerts(slaIds[0]);
      console.log("\n🔔 Total alerts created:", alerts.length);
      
      if (alerts.length > 0) {
        console.log("\n🔧 Managing alert...");
        await manageAlertExample(alerts[0]);
      }
    }
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
})();