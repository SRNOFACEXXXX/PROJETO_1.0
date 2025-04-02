/**
 * Script de post-install para configuração do ambiente
 * Executa após npm install
 */
const fs = require('fs');
const path = require('path');

// Função para garantir que diretório existe
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Diretório criado: ${dirPath}`);
  }
}

// Função para verificar e criar o arquivo de polyfills se não existir
function ensurePolyfillsExist() {
  const utilsDir = path.join(__dirname, '../src/utils');
  const polyfillsPath = path.join(utilsDir, 'polyfills.ts');
  
  ensureDirectoryExists(utilsDir);
  
  // Se o arquivo de polyfills já existir, não sobrescrever
  if (fs.existsSync(polyfillsPath)) {
    console.log('Arquivo de polyfills já existe');
    return;
  }
  
  // Conteúdo do arquivo de polyfills
  const polyfillsContent = `/**
 * Polyfills para compatibilidade com APIs do Node.js em ambiente React Native
 * Otimizado para Node.js v22+ e React Native moderno
 */

// Importações necessárias
import { Buffer } from 'buffer';
import 'react-native-get-random-values'; // Necessário para operações criptográficas

// ======= Buffer global =======
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// ======= Process polyfill =======
const processPolyfill = {
  env: {
    NODE_ENV: process?.env?.NODE_ENV || 'development',
    NODE_DEBUG: process?.env?.NODE_DEBUG || '',
  },
  browser: true,
  platform: 'react-native',
  versions: {
    node: '22.14.0', // Simular a versão atual do Node.js
  },
  nextTick: (cb: Function, ...args: any[]) => 
    setTimeout(() => cb(...args), 0),
  cwd: () => '/',
  exit: (code?: number) => {
    console.warn(\`Process exit com código \${code} simulado\`);
    return undefined as any;
  },
  getuid: () => -1, // Evitar erros em bibliotecas que usam getuid
};

// Aplicar o polyfill process
if (typeof global.process === 'undefined') {
  // @ts-ignore
  global.process = processPolyfill;
} else {
  // Garantir que todas as propriedades essenciais existam
  Object.keys(processPolyfill).forEach(key => {
    if (!(key in global.process)) {
      // @ts-ignore
      global.process[key] = processPolyfill[key];
    }
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

console.debug('🛠️ Polyfills carregados com sucesso');`;

  try {
    fs.writeFileSync(polyfillsPath, polyfillsContent);
    console.log('Arquivo de polyfills criado com sucesso');
  } catch (error) {
    console.error('Erro ao criar arquivo de polyfills:', error);
  }
}

// Função para garantir que as dependências necessárias estejam instaladas
function checkForRequiredDependencies() {
  const packageJsonPath = path.join(__dirname, '../package.json');
  
  try {
    const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = { 
      ...packageData.dependencies || {}, 
      ...packageData.devDependencies || {} 
    };
    
    const requiredPackages = [
      'buffer',
      'crypto-browserify',
      'process',
      'react-native-get-random-values',
      'stream-browserify',
      'path-browserify'
    ];
    
    const missingPackages = requiredPackages.filter(pkg => !dependencies[pkg]);
    
    if (missingPackages.length > 0) {
      console.warn(`Aviso: Dependências recomendadas ausentes: ${missingPackages.join(', ')}`);
      console.warn('Execute: npm install --save ' + missingPackages.join(' '));
    }
  } catch (error) {
    console.error('Erro ao verificar package.json:', error);
  }
}

// Função para garantir que o App.tsx importa os polyfills
function ensureAppImportsPolyfills() {
  const appPath = path.join(__dirname, '../App.tsx');
  
  if (!fs.existsSync(appPath)) {
    console.warn('App.tsx não encontrado');
    return;
  }
  
  try {
    let appContent = fs.readFileSync(appPath, 'utf8');
    
    // Verificar se já importa polyfills
    if (!appContent.includes('./src/utils/polyfills')) {
      // Adicionar import no topo do arquivo
      appContent = `import './src/utils/polyfills';\n${appContent}`;
      fs.writeFileSync(appPath, appContent);
      console.log('Import de polyfills adicionado ao App.tsx');
    } else {
      console.log('App.tsx já importa polyfills');
    }
  } catch (error) {
    console.error('Erro ao atualizar App.tsx:', error);
  }
}

// Executar funções
try {
  console.log('Iniciando script de post-install...');
  ensurePolyfillsExist();
  checkForRequiredDependencies();
  ensureAppImportsPolyfills();
  console.log('Script de post-install concluído com sucesso');
} catch (error) {
  console.error('Erro no script de post-install:', error);
} 