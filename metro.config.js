const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

// Obter configuração padrão do Expo
const config = getDefaultConfig(__dirname);

// Configuração de extensões suportadas (incluindo TypeScript)
// A ordem importa aqui, o primeiro que corresponder será usado
config.resolver.sourceExts = [
  'jsx',
  'js',
  'ts',
  'tsx',
  'json',
  'mjs',
  'cjs'
];

// Extensões de assets (binários, imagens, etc)
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'bin'
];

// Campos principais para resolver módulos (ajuda com diferentes padrões de exportação)
config.resolver.resolverMainFields = [
  'react-native',
  'browser',
  'module',
  'main'
];

// Polyfills necessários para compatibilidade com APIs de Node.js em ambiente React Native
config.resolver.extraNodeModules = {
  // Polyfills básicos
  'buffer': require.resolve('buffer/'),
  'process': require.resolve('process/browser'),
  'stream': require.resolve('stream-browserify'),
  'crypto': require.resolve('crypto-browserify'),
  'util': require.resolve('util/'),
  'assert': require.resolve('assert/'),
  'constants': require.resolve('constants-browserify'),
  'path': require.resolve('path-browserify'),
  // Arquivo vazio para APIs não usadas, mas potencialmente importadas
  'fs': path.resolve(__dirname, 'node_modules/react-native/Libraries/empty.js')
};

// Transformador do Metro
config.transformer = {
  ...config.transformer,
  // Garantir que os imports async/await e outros recursos sejam corretamente transformados
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

console.log('Metro configurado com sucesso para Node.js v22+');

module.exports = config; 