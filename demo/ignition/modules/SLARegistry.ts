import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SLARegistryModule = buildModule("SLARegistryModule", (m) => {
  // Get the deployer account as the admin
  const admin = m.getAccount(0);

  // Deploy SLARegistry contract with admin address
  const slaRegistry = m.contract("SLARegistry", [admin]);

  return { slaRegistry };
});

export default SLARegistryModule;

