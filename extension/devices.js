// TrucnksCISCO - Device Types Catalog for Cisco Packet Tracer
var allDeviceTypes = {
  // Routers (Type 0)
  "1841": 0,
  "1941": 0,
  "2620XM": 0,
  "2621XM": 0,
  "2811": 0,
  "2901": 0,
  "2911": 0,
  "ISR4321": 0,
  "ISR4331": 0,
  "Router-PT": 0,
  "Router-PT-Empty": 0,

  // Standard Layer 2 Switches (Type 1)
  "2950-24": 1,
  "2950T-24": 1,
  "2960-24TT": 1,
  "2960-48TT": 1,
  "Switch-PT": 1,
  "Switch-PT-Empty": 1,

  // Multilayer / Layer 3 Switches (Type 16)
  "3560-24PS": 16,
  "3650-24PS": 16,
  "IE-2000": 16,

  // End Devices
  "PC-PT": 8,
  "Server-PT": 9,
  "Printer-PT": 10,
  "Laptop-PT": 18
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { allDeviceTypes };
}
