// TrucnksCISCO - Cisco Hardware Catalog & Specifications
const DeviceCatalog = {
  // Layer 2 Access Switches
  "2960-24TT": {
    model: "2960-24TT",
    type: 1,
    role: "access-switch",
    fastEthernetPorts: 24,
    gigabitPorts: 2,
    supportsDot1q: true,
    needsManualEncapsulationCommand: false,
    recommendedTrunkPorts: ["GigabitEthernet0/1", "GigabitEthernet0/2"],
  },
  "2950-24": {
    model: "2950-24",
    type: 1,
    role: "access-switch",
    fastEthernetPorts: 24,
    gigabitPorts: 0,
    supportsDot1q: true,
    needsManualEncapsulationCommand: false,
    recommendedTrunkPorts: ["FastEthernet0/23", "FastEthernet0/24"],
  },

  // Layer 3 Distribution / Multilayer Switches
  "3560-24PS": {
    model: "3560-24PS",
    type: 16,
    role: "distribution-switch",
    fastEthernetPorts: 24,
    gigabitPorts: 2,
    supportsDot1q: true,
    needsManualEncapsulationCommand: true, // Requires 'switchport trunk encapsulation dot1q'
    recommendedTrunkPorts: ["GigabitEthernet0/1", "GigabitEthernet0/2"],
  },
  "3650-24PS": {
    model: "3650-24PS",
    type: 16,
    role: "core-switch",
    fastEthernetPorts: 0,
    gigabitPorts: 24,
    supportsDot1q: true,
    needsManualEncapsulationCommand: false,
    recommendedTrunkPorts: ["GigabitEthernet1/0/23", "GigabitEthernet1/0/24"],
  },

  // Routers
  "2911": {
    model: "2911",
    type: 0,
    role: "router",
    gigabitPorts: 3,
    supportsSubinterfaces: true,
    recommendedRoasPort: "GigabitEthernet0/0",
  },
  "1941": {
    model: "1941",
    type: 0,
    role: "router",
    gigabitPorts: 2,
    supportsSubinterfaces: true,
    recommendedRoasPort: "GigabitEthernet0/0",
  },

  // End Devices
  "PC-PT": {
    model: "PC-PT",
    type: 8,
    role: "host",
    fastEthernetPorts: 1,
  },
  "Server-PT": {
    model: "Server-PT",
    type: 9,
    role: "server",
    fastEthernetPorts: 1,
  },
};

module.exports = { DeviceCatalog };
