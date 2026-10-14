// Endurece o AndroidManifest (achados da revisão de segurança com o REA no APK):
//  - desliga o backup automático (o cofre da carteira não deve sair do aparelho por backup);
//  - remove o provedor de arquivos EXPORTADO do expo-clipboard (só usamos texto, nunca arquivos);
//  - tráfego sem criptografia só existe no manifest de DEBUG (Metro); o de release fica proibido.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withHardenedManifest(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application[0];
    app.$['android:allowBackup'] = 'false';
    app.$['android:usesCleartextTraffic'] = 'false';

    const providerName = 'expo.modules.clipboard.ClipboardFileProvider';
    app.provider = (app.provider ?? []).filter((p) => p.$['android:name'] !== providerName);
    app.provider.push({ $: { 'android:name': providerName, 'tools:node': 'remove' } });
    return c;
  });
};
