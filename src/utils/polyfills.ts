/**
 * Polyfills para compatibilidade com APIs do Node.js em ambiente React Native
 * Otimizado para Node.js v22+ e React Native moderno
 */

// Importações necessárias
import 'react-native-get-random-values'; // Necessário para operações criptográficas
import { Buffer } from 'buffer';

// ======= Buffer global =======
// @ts-ignore
global.Buffer = global.Buffer || Buffer;

// ======= Process polyfill =======
// @ts-ignore
global.process = global.process || {};

// Garantir que process.env exista
// @ts-ignore
global.process.env = global.process.env || {};

// Usando Object.defineProperty para evitar erros de propriedades somente leitura
if (!global.process.version) {
  Object.defineProperty(global.process, 'version', {
    value: '',
    writable: false,
    configurable: true
  });
}

if (!global.process.versions) {
  Object.defineProperty(global.process, 'versions', {
    value: { node: '' },
    writable: false,
    configurable: true
  });
}

// ======= setImmediate e clearImmediate =======
if (typeof global.setImmediate === 'undefined') {
  // @ts-ignore
  global.setImmediate = (callback: Function, ...args: any[]) => 
    setTimeout(callback, 0, ...args);
}

if (typeof global.clearImmediate === 'undefined') {
  // @ts-ignore
  global.clearImmediate = (id: number) => clearTimeout(id);
}

// ======= Suporte a CommonJS em ambiente ESM =======
if (!(global as any).exports) {
  (global as any).exports = {};
}

// ======= TextEncoder/TextDecoder (caso não exista) =======
if (typeof global.TextEncoder === 'undefined') {
  // @ts-ignore
  global.TextEncoder = require('text-encoding').TextEncoder;
  // @ts-ignore
  global.TextDecoder = require('text-encoding').TextDecoder;
}

console.log('Polyfills carregados com sucesso');

export { Buffer }; 