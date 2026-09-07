// TrucnksCISCO - Link Types Mapping for Cisco Packet Tracer
var allLinkTypes = {
  "ethernet-straight": 8100,
  "straight": 8100,
  "ethernet-cross": 8101,
  "cross": 8101,
  "roll": 8102,
  "fiber": 8103,
  "phone": 8104,
  "cable": 8105,
  "serial": 8106,
  "octal": 8107,
  "auto": 8100
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { allLinkTypes };
}
