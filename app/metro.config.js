const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const walletCore = path.resolve(workspaceRoot, 'wallet-core');

const config = getDefaultConfig(__dirname);

// O núcleo da carteira vive fora da pasta do app.
config.watchFolders = [walletCore];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(walletCore, 'node_modules'),
];
// As bibliotecas @scure/@noble usam "exports" com subcaminhos (ex.: /utils.js).
config.resolver.unstable_enablePackageExports = true;
// O pacote do núcleo é resolvido pelo "main" do seu package.json (dist/index.js).
config.resolver.extraNodeModules = { '@brbit/wallet-core': walletCore };

module.exports = config;
