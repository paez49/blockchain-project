# 🧪 Smart Contract Client Testing Guide

This guide shows you how to test your SLARegistry smart contract using different types of clients.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deploy the Contract](#deploy-the-contract)
3. [Testing Methods](#testing-methods)
   - [Unit Tests (Already Done)](#1-unit-tests)
   - [Node.js Client Script](#2-nodejs-client-script)
   - [Event Listener](#3-event-listener-backend-service)
   - [Web Frontend](#4-web-frontend-client)
4. [Integration with Your Microservices](#integration-with-your-microservices)

---

## Prerequisites

```bash
# Make sure you have all dependencies installed
npm install

# Your contract should be compiled
npx hardhat compile
```

---

## Deploy the Contract

First, start a local Hardhat node (in one terminal):

```bash
npx hardhat node
```

Then deploy your contract (in another terminal):

```bash
npx hardhat ignition deploy ignition/modules/SLARegistry.ts --network localhost
```

You'll get output like:
```
✔ Confirm deploy to network localhost (31337)? … yes
...
Deployed SLARegistryModule#SLARegistry at: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

**Save this contract address!** You'll need it for testing.

---

## Testing Methods

### 1. Unit Tests

You already have comprehensive unit tests in `test/SLARegistry.ts`. Run them with:

```bash
npm test
```

This tests all contract functionality programmatically.

---

### 2. Node.js Client Script

**File:** `scripts/client-example.ts`

This script demonstrates a complete workflow from a Node.js client (like your microservices would use).

#### Run it:

```bash
npx hardhat run scripts/client-example.ts --network localhost
```

#### What it does:

1. ✅ Registers a client
2. ✅ Creates a contract with IPFS document hash
3. ✅ Adds an SLA
4. ✅ Reports successful metrics
5. ✅ Reports failed metrics (creates alerts)
6. ✅ Acknowledges alerts
7. ✅ Resolves alerts
8. ✅ Pauses SLA (novelty operation)
9. ✅ Views summary data

#### Example Output:

```
🚀 SLA Registry Client Example

📄 Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3

📝 Step 1: Registering a new client...
   Transaction: 0x123...
   ✅ Client registered: { id: 1, name: 'Hospital Central', ... }

📜 Step 2: Creating a contract with IPFS document...
   Transaction: 0x456...
   ✅ Contract created: { id: 1, clientId: 1, ipfsCid: 'QmYwAPJzv...', ... }

⚠️  Step 5: Reporting failed metric (will create alert)...
   🚨 SLA Violation detected - Alert created!
   Alert details: { id: 1, slaId: 1, status: 'Open', reason: '...' }

...
```

---

### 3. Event Listener (Backend Service)

**File:** `scripts/event-listener.ts`

This script listens to blockchain events in real-time, similar to what your backend microservices should do.

#### Run it:

```bash
npx hardhat run scripts/event-listener.ts --network localhost
```

Keep it running in a terminal, then use the client script or web interface to trigger events.

#### What it monitors:

- 📜 **ContractCreated** - New contracts
- 📊 **SLACreated** - New SLAs
- ✅/❌ **SLAMetricReported** - Every metric report
- 🚨 **SLAViolated** - CRITICAL! SLA breaches (this is your main alert mechanism)
- 👀 **AlertAcknowledged** - When alerts are acknowledged
- ✔️ **AlertResolved** - When alerts are resolved
- 🔧 **NoveltyApplied** - When SLAs are modified
- 🔄 **SLAStatusChanged** - When SLA status changes

#### Example Output:

```
🔊 SLA Registry Event Listener
================================

📄 Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
⏳ Listening for events...

📊 NEW SLA CREATED
   SLA ID: 1
   Contract ID: 1
   Name: Delivery Time <= 24 hours
   Target: 24
   Comparator: LE (<=)
   Window: 86400 seconds
   Block: 12

✅ METRIC REPORTED
   SLA ID: 1
   Observed Value: 20
   Success: true
   Note: Order #1234 - Delivered in 20 hours
   Block: 13

🚨 ⚠️  ALERT: SLA VIOLATION DETECTED! ⚠️  🚨
   Alert ID: 1
   SLA ID: 1
   Reason: Order #1235 - Delivered in 36 hours (BREACH)
   Block: 14
   SLA Name: Delivery Time <= 24 hours
   Contract ID: 1
   Consecutive Breaches: 1
   Total Breaches: 1

   🔔 Actions to take:
      → Send email to operations team
      → Create alert in monitoring system
      → Post notification to Slack
      → Update dashboard with critical status
```

#### Key Use Case:

The **SLAViolated** event is your "webhook" trigger. When this event fires, your backend should:

- 📧 Send email notifications
- 💬 Post to Slack/Teams
- 📱 Send SMS alerts
- 🎫 Create tickets in Jira/ServiceNow
- 📊 Update dashboards
- 📝 Log to monitoring systems

---

### 4. Web Frontend Client

**File:** `scripts/web-client-example.html`

A beautiful, interactive web interface to test your contract from a browser.

#### How to use:

1. **Start a local web server** (simplest way):
   ```bash
   # Using Python
   cd scripts
   python -m http.server 8000
   
   # Or using Node.js
   npx http-server
   ```

2. **Open in browser:**
   ```
   http://localhost:8000/web-client-example.html
   ```

3. **Connect MetaMask:**
   - Click "Connect MetaMask"
   - Make sure MetaMask is connected to your local Hardhat network:
     - Network: Localhost 8545
     - RPC URL: http://127.0.0.1:8545
     - Chain ID: 31337

4. **Configure contract:**
   - Paste your deployed contract address
   - Click "Load Contract"

5. **Test operations:**
   - Register clients
   - Create contracts
   - Add SLAs
   - Report metrics
   - View SLA data
   - Listen to live events

#### Features:

- 🎨 Beautiful, modern UI
- 🔌 MetaMask integration
- 📡 Real-time event listening
- 📊 Interactive data viewing
- ⚠️ Alert status indicators

---

## Integration with Your Microservices

Based on your smart contract design, here's how your microservices should integrate:

### 1. **Contracts Microservice**

**Responsibilities:**
- Register clients: `registerClient()`
- Create contracts: `createContract()`
- Add SLAs: `addSLA()`
- Report metrics: `reportMetric()`

**Example (Node.js/TypeScript):**

```typescript
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

class ContractsService {
  private contract;

  constructor(contractAddress, abi) {
    const account = privateKeyToAccount(process.env.CONTRACT_MS_PRIVATE_KEY);
    const walletClient = createWalletClient({
      account,
      transport: http(process.env.RPC_URL)
    });
    
    this.contract = { address: contractAddress, abi, walletClient };
  }

  async registerClient(name: string, address: string) {
    const txHash = await this.contract.walletClient.writeContract({
      address: this.contract.address,
      abi: this.contract.abi,
      functionName: 'registerClient',
      args: [name, address],
    });
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    return receipt;
  }

  async reportMetric(slaId: bigint, observedValue: bigint, note: string) {
    // Called when you calculate KPIs (e.g., delivery time, success rate)
    const txHash = await this.contract.walletClient.writeContract({
      address: this.contract.address,
      abi: this.contract.abi,
      functionName: 'reportMetric',
      args: [slaId, observedValue, note],
    });
    
    return txHash;
  }
}
```

### 2. **Novelties Microservice**

**Responsibilities:**
- Pause SLAs: `pauseSLA()`
- Resume SLAs: `resumeSLA()`
- Update targets: `updateSLATarget()`
- Update parameters: `updateSLAParams()`

**Example:**

```typescript
class NoveltiesService {
  async pauseSLA(slaId: bigint, reason: string) {
    // Called when operational issues occur (storms, road blocks, etc.)
    await this.contract.write.pauseSLA([slaId, reason]);
  }

  async updateSLATarget(slaId: bigint, newTarget: bigint, reason: string) {
    // Called when circumstances require SLA adjustment
    await this.contract.write.updateSLATarget([slaId, newTarget, reason]);
  }
}
```

### 3. **Event Listener / Notification Service**

**Responsibilities:**
- Listen to **SLAViolated** events
- Send notifications (email, Slack, SMS)
- Create tickets
- Update dashboards

**Example:**

```typescript
import { createPublicClient, http } from 'viem';

class EventListenerService {
  async startListening() {
    const publicClient = createPublicClient({
      transport: http(process.env.RPC_URL)
    });

    // Listen for SLA violations
    publicClient.watchContractEvent({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      eventName: 'SLAViolated',
      onLogs: async (logs) => {
        for (const log of logs) {
          await this.handleSLAViolation({
            alertId: log.args.alertId,
            slaId: log.args.slaId,
            reason: log.args.reason,
          });
        }
      },
    });
  }

  async handleSLAViolation(data) {
    // 1. Send email to operations team
    await emailService.send({
      to: 'ops@medysupply.com',
      subject: `🚨 SLA Violation: ${data.reason}`,
      body: `Alert #${data.alertId} has been triggered...`
    });

    // 2. Post to Slack
    await slackService.postMessage({
      channel: '#alerts',
      text: `@channel SLA Violated: ${data.reason}`
    });

    // 3. Create Jira ticket
    await jiraService.createIssue({
      type: 'Incident',
      priority: 'High',
      summary: `SLA Breach - Alert #${data.alertId}`,
    });

    // 4. Update monitoring dashboard
    await dashboardService.updateMetric('sla_violations', 1);
  }
}
```

### 4. **Operations Microservice**

**Responsibilities:**
- Acknowledge alerts: `acknowledgeAlert()`
- Resolve alerts: `resolveAlert()`
- View SLA data

**Example:**

```typescript
class OperationsService {
  async acknowledgeAlert(alertId: bigint) {
    // Called when operator reviews the alert
    await this.contract.write.acknowledgeAlert([alertId]);
  }

  async resolveAlert(alertId: bigint, resolution: string) {
    // Called when issue is fixed
    await this.contract.write.resolveAlert([alertId, resolution]);
  }

  async getSLAStats(slaId: bigint) {
    const sla = await this.contract.read.slas([slaId]);
    return {
      totalBreaches: sla.totalBreaches,
      totalPass: sla.totalPass,
      consecutiveBreaches: sla.consecutiveBreaches,
      status: sla.status,
    };
  }
}
```

---

## 🔐 Security Best Practices

1. **Private Keys:**
   - Never hardcode private keys
   - Use environment variables: `process.env.PRIVATE_KEY`
   - Use key management services (AWS KMS, Azure Key Vault)

2. **Role Management:**
   - Grant roles carefully
   - Use different accounts for different microservices
   - Revoke roles when no longer needed

3. **Transaction Monitoring:**
   - Always wait for transaction confirmations
   - Implement retry logic for failed transactions
   - Monitor gas prices and optimize

4. **Error Handling:**
   - Catch and log all errors
   - Implement fallback mechanisms
   - Set up alerts for critical failures

---

## 🎯 Testing Workflow

### Complete Test Flow:

1. **Start local blockchain:**
   ```bash
   npx hardhat node
   ```

2. **Deploy contract:**
   ```bash
   npx hardhat ignition deploy ignition/modules/SLARegistry.ts --network localhost
   ```

3. **Start event listener (Terminal 2):**
   ```bash
   npx hardhat run scripts/event-listener.ts --network localhost
   ```

4. **Run client script (Terminal 3):**
   ```bash
   npx hardhat run scripts/client-example.ts --network localhost
   ```

5. **Watch events appear in Terminal 2** as actions are performed in Terminal 3

6. **Try the web interface:**
   - Open `scripts/web-client-example.html`
   - Connect MetaMask
   - Perform operations and watch events fire

---

## 📚 Additional Resources

- **Viem Documentation:** https://viem.sh/
- **Hardhat Documentation:** https://hardhat.org/docs
- **OpenZeppelin AccessControl:** https://docs.openzeppelin.com/contracts/access-control

---

## 🤔 Common Issues

### Issue: "Cannot connect to localhost:8545"

**Solution:** Make sure Hardhat node is running:
```bash
npx hardhat node
```

### Issue: "Transaction reverted"

**Solution:** Check that:
- You have the correct role for the operation
- The client/contract/SLA exists and is active
- You're using the correct parameters

### Issue: "MetaMask doesn't connect"

**Solution:**
1. Add Localhost network to MetaMask
2. Import a Hardhat account private key
3. Make sure Chain ID is 31337

---

## 🎉 Next Steps

1. **Test locally:** Run through all the examples above
2. **Deploy to testnet:** Use Sepolia or another testnet
3. **Integrate with your backend:** Adapt the examples to your microservices
4. **Set up monitoring:** Implement the event listener as a service
5. **Build your frontend:** Use the web example as a starting point

---

**Questions?** Check the code comments in each example file for detailed explanations!

