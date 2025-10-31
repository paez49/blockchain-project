import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SLARegistryModule = buildModule("SLARegistryModule", (m) => {
  // Get the admin address from parameters, or use the default account
  const admin = m.getParameter("admin", m.getAccount(0));

  // Deploy the SLARegistry contract
  const slaRegistry = m.contract("SLARegistry", [admin]);

  return { slaRegistry };
});

export default SLARegistryModule;

