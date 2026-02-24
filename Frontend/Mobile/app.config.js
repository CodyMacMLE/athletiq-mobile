const { withEntitlementsPlist } = require("@expo/config-plugins");

/**
 * Force com.apple.developer.nfc.readersession.formats to ["TAG"] only.
 * react-native-nfc-manager injects ["NDEF", "TAG"] which fails Apple SDK 26
 * validation when minOS is 15.1. This modifier runs last and strips NDEF.
 */
function withNFCTagOnly(config) {
  return withEntitlementsPlist(config, (c) => {
    c.modResults["com.apple.developer.nfc.readersession.formats"] = ["TAG"];
    return c;
  });
}

module.exports = ({ config }) => {
  return withNFCTagOnly(config);
};
