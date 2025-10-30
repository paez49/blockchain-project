/**
 * Client Example Script
 * Demonstrates how to interact with the SLARegistry smart contract from a Node.js client
 * 
 * Usage: npx hardhat run scripts/client-example.ts --network hardhatMainnet
 */

import { createPublicClient, createWalletClient, http, parseAbiItem, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load the contract ABI and address
function loadContractData() {
  try {
    // Try to load from deployed addresses
    const deployedAddressesPath = resolve(__dirname, "../ignition/deployments/chain-31337/deployed_addresses.json");
    const deployedAddresses = JSON.parse(readFileSync(deployedAddressesPath, "utf-8"));
    const contractAddress = deployedAddresses["SLARegistryModule#SLARegistry"] as `0x${string}`;

    // Load ABI
    const abiPath = resolve(__dirname, "../artifacts/contracts/SLARegistry.sol/SLARegistry.json");
    const contractArtifact = JSON.parse(readFileSync(abiPath, "utf-8"));

    return {
      address: contractAddress,
      abi: contractArtifact.abi,
    };
  } catch (error) {
    console.error("❌ Could not load contract data. Make sure the contract is deployed.");
    console.error("Run: npx hardhat ignition deploy ignition/modules/SLARegistry.ts --network hardhatMainnet");
    throw error;
  }
}

// Enum definitions (must match Solidity contract)
const Comparator = {
  LT: 0,
  LE: 1,
  EQ: 2,
  GE: 3,
  GT: 4,
};

const SLAStatus = {
  Active: 0,
  Paused: 1,
  Archived: 2,
};

const AlertStatus = {
  Open: 0,
  Acknowledged: 1,
  Resolved: 2,
};

async function main() {
  console.log("🚀 SLA Registry Client Example\n");

  // Setup clients (for local Hardhat network)
  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http("http://127.0.0.1:8545"),
  });

  // In production, use environment variables for private keys
  const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`
  ); // Default Hardhat account #0

  const walletClient = createWalletClient({
    account,
    chain: hardhat,
    transport: http("http://127.0.0.1:8545"),
  });

  // Load contract
  const { address: contractAddress, abi } = loadContractData();
  console.log(`📄 Contract Address: ${contractAddress}\n`);

  // ============================================================================
  // EXAMPLE 1: Register a Client
  // ============================================================================
  console.log("📝 Step 1: Registering a new client...");

  const clientName = "Hospital Central";
  const clientAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Hardhat account #1

  const registerTxHash = await walletClient.writeContract({
    address: contractAddress,
    abi: abi,
    functionName: "registerClient",
    args: [clientName, clientAddress],
  });

  console.log(`   Transaction: ${registerTxHash}`);
  await publicClient.waitForTransactionReceipt({ hash: registerTxHash });

  // Read client data
  const clientData = await publicClient.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "clients",
    args: [1n],
  });

  console.log(`   ✅ Client registered:`, {
    id: clientData[0],
    name: clientData[1],
    account: clientData[2],
    active: clientData[3],
  });
  console.log();

  // ============================================================================
  // EXAMPLE 2: Create a Contract with IPFS Document
  // ============================================================================
  console.log("📜 Step 2: Creating a contract with IPFS document...");

  const clientId = 1n;
  const ipfsCid = "QmYwAPJzv5CZsnAzt8auVZRKsGCU7EMQQ"; // Example IPFS CID
  const startDate = BigInt(Math.floor(Date.now() / 1000));
  const endDate = startDate + BigInt(365 * 24 * 60 * 60); // 1 year from now

  const createContractTxHash = await walletClient.writeContract({
    address: contractAddress,
    abi: abi,
    functionName: "createContract",
    args: [clientId, ipfsCid, startDate, endDate],
  });

  console.log(`   Transaction: ${createContractTxHash}`);
  await publicClient.waitForTransactionReceipt({ hash: createContractTxHash });

  const contractData = await publicClient.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "contractsById",
    args: [1n],
  });

  console.log(`   ✅ Contract created:`, {
    id: contractData[0],
    clientId: contractData[1],
    ipfsCid: contractData[2],
    startDate: new Date(Number(contractData[3]) * 1000).toISOString(),
    endDate: new Date(Number(contractData[4]) * 1000).toISOString(),
    active: contractData[5],
  });
  console.log();

  // ============================================================================
  // EXAMPLE 3: Add SLA to Contract
  // ============================================================================
  console.log("📊 Step 3: Adding SLA to contract...");

  const contractId = 1n;
  const slaName = "Delivery Time <= 24 hours";
  const target = 24n; // 24 hours
  const comparator = Comparator.LE; // Less than or equal
  const windowSeconds = BigInt(86400); // 24 hours in seconds

  const addSLATxHash = await walletClient.writeContract({
    address: contractAddress,
    abi: abi,
    functionName: "addSLA",
    args: [contractId, slaName, target, comparator, windowSeconds],
  });

  console.log(`   Transaction: ${addSLATxHash}`);
  await publicClient.waitForTransactionReceipt({ hash: addSLATxHash });

  const slaData = await publicClient.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "slas",
    args: [1n],
  });

  console.log(`   ✅ SLA created:`, {
    id: slaData[0],
    contractId: slaData[1],
    name: slaData[2],
    target: slaData[3],
    comparator: slaData[4],
    status: Object.keys(SLAStatus)[slaData[5]],
  });
  console.log();

  // ============================================================================
  // EXAMPLE 4: Report Metrics (Success Case)
  // ============================================================================
  console.log("✅ Step 4: Reporting successful metric...");

  const slaId = 1n;
  const observedValue = 20n; // 20 hours (under 24h threshold)
  const note = "Order #1234 - Delivered in 20 hours";

  const reportMetricTxHash = await walletClient.writeContract({
    address: contractAddress,
    abi: abi,
    functionName: "reportMetric",
    args: [slaId, observedValue, note],
  });

  console.log(`   Transaction: ${reportMetricTxHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: reportMetricTxHash });

  // Parse events from receipt
  const logs = receipt.logs;
  console.log(`   ✅ Metric reported successfully - No alert generated`);
  console.log();

  // ============================================================================
  // EXAMPLE 5: Report Metrics (Failure Case - Creates Alert)
  // ============================================================================
  console.log("⚠️  Step 5: Reporting failed metric (will create alert)...");

  const failedValue = 36n; // 36 hours (exceeds 24h threshold)
  const failedNote = "Order #1235 - Delivered in 36 hours (BREACH)";

  const reportFailedMetricTxHash = await walletClient.writeContract({
    address: contractAddress,
    abi: abi,
    functionName: "reportMetric",
    args: [slaId, failedValue, failedNote],
  });

  console.log(`   Transaction: ${reportFailedMetricTxHash}`);
  const failedReceipt = await publicClient.waitForTransactionReceipt({ 
    hash: reportFailedMetricTxHash 
  });

  // Check for SLAViolated event
  console.log(`   🚨 SLA Violation detected - Alert created!`);

  const alertData = await publicClient.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "alerts",
    args: [1n],
  });

  console.log(`   Alert details:`, {
    id: alertData[0],
    slaId: alertData[1],
    createdAt: new Date(Number(alertData[2]) * 1000).toISOString(),
    status: Object.keys(AlertStatus)[alertData[3]],
    reason: alertData[4],
  });
  console.log();

  // ============================================================================
  // EXAMPLE 6: Acknowledge Alert
  // ============================================================================
  console.log("👀 Step 6: Acknowledging the alert...");

  const alertId = 1n;

  const acknowledgeTxHash = await walletClient.writeContract({
    address: contractAddress,
    abi: abi,
    functionName: "acknowledgeAlert",
    args: [alertId],
  });

  console.log(`   Transaction: ${acknowledgeTxHash}`);
  await publicClient.waitForTransactionReceipt({ hash: acknowledgeTxHash });

  const acknowledgedAlert = await publicClient.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "alerts",
    args: [alertId],
  });

  console.log(`   ✅ Alert acknowledged - Status: ${Object.keys(AlertStatus)[acknowledgedAlert[3]]}`);
  console.log();

  // ============================================================================
  // EXAMPLE 7: Resolve Alert
  // ============================================================================
  console.log("✔️  Step 7: Resolving the alert...");

  const resolutionNote = "Issue resolved - improved logistics process";

  const resolveTxHash = await walletClient.writeContract({
    address: contractAddress,
    abi: abi,
    functionName: "resolveAlert",
    args: [alertId, resolutionNote],
  });

  console.log(`   Transaction: ${resolveTxHash}`);
  await publicClient.waitForTransactionReceipt({ hash: resolveTxHash });

  const resolvedAlert = await publicClient.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "alerts",
    args: [alertId],
  });

  console.log(`   ✅ Alert resolved - Status: ${Object.keys(AlertStatus)[resolvedAlert[3]]}`);
  console.log();

  // ============================================================================
  // EXAMPLE 8: Apply Novelty - Pause SLA
  // ============================================================================
  console.log("🔧 Step 8: Pausing SLA due to emergency situation...");

  const pauseReason = "Hurricane affecting logistics - temporary pause";

  const pauseTxHash = await walletClient.writeContract({
    address: contractAddress,
    abi: abi,
    functionName: "pauseSLA",
    args: [slaId, pauseReason],
  });

  console.log(`   Transaction: ${pauseTxHash}`);
  await publicClient.waitForTransactionReceipt({ hash: pauseTxHash });

  const pausedSLA = await publicClient.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "slas",
    args: [slaId],
  });

  console.log(`   ✅ SLA paused - Status: ${Object.keys(SLAStatus)[pausedSLA[5]]}`);
  console.log();

  // ============================================================================
  // EXAMPLE 9: Get Summary Data
  // ============================================================================
  console.log("📈 Step 9: Getting SLA summary...");

  const finalSLA = await publicClient.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "slas",
    args: [slaId],
  });

  console.log(`   SLA Summary:`, {
    name: finalSLA[2],
    consecutiveBreaches: Number(finalSLA[8]),
    totalBreaches: Number(finalSLA[9]),
    totalPass: Number(finalSLA[10]),
    status: Object.keys(SLAStatus)[finalSLA[5]],
  });

  const slaAlerts = await publicClient.readContract({
    address: contractAddress,
    abi: abi,
    functionName: "getSLAAlerts",
    args: [slaId],
  });

  console.log(`   Total Alerts: ${slaAlerts.length}`);
  console.log();

  console.log("🎉 Client example completed successfully!");
}

// Run the example
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

