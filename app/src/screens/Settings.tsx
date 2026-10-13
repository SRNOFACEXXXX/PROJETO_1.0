import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import type { Nav } from '../nav';
import { eraseWallet, lockWallet } from '../session';
import { loadNetwork, saveNetwork } from '../storage';
import { colors } from '../theme';
import { Banner, Body, Card, NeonButton, Screen, Title } from '../ui';
import type { NetworkName } from '@brbit/wallet-core';

export function Settings({ nav }: { nav: Nav }) {
  const [net, setNet] = useState<NetworkName>('testnet');
  useEffect(() => {
    loadNetwork().then(setNet);
  }, []);

  async function switchNetwork(to: NetworkName) {
    await saveNetwork(to);
    setNet(to);
    // As chaves em memória pertencem à rede antiga: exige novo desbloqueio.
    lockWallet();
    nav.go({ name: 'lock' });
  }

  function askMainnet() {
    Alert.alert(
      'Usar a mainnet?',
      'A mainnet usa dinheiro real. Esta versão ainda não passou por auditoria externa. Use apenas valores que você aceita perder.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Entendo o risco', style: 'destructive', onPress: () => void switchNetwork('mainnet') },
      ],
    );
  }

  function askErase() {
    Alert.alert(
      'Apagar a carteira deste aparelho?',
      'Sem a frase de recuperação anotada, você perde o acesso aos fundos para sempre.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            await eraseWallet();
            nav.go({ name: 'welcome' });
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Title>Ajustes</Title>
      <Card>
        <Body muted>Rede</Body>
        <Body style={{ color: net === 'mainnet' ? colors.danger : colors.lime, fontWeight: '800' }}>
          {net === 'mainnet' ? 'Mainnet (dinheiro real)' : 'Testnet4 (sem valor)'}
        </Body>
        {net === 'testnet' ? (
          <NeonButton testID="btn-mainnet" title="Mudar para mainnet" variant="ghost" onPress={askMainnet} />
        ) : (
          <NeonButton title="Voltar para a testnet" onPress={() => void switchNetwork('testnet')} />
        )}
      </Card>
      <Card>
        <Body muted>Operação por agente (Claude)</Body>
        <Body>Desativada. Quando for ligada, o agente só poderá propor transações, com limites e aprovação sua.</Body>
      </Card>
      <Banner kind="warn">Versão de testes, sem auditoria externa.</Banner>
      <NeonButton testID="btn-erase" title="Apagar carteira" variant="danger" onPress={askErase} />
      <NeonButton title="Voltar" variant="ghost" onPress={() => nav.go({ name: 'home' })} />
    </Screen>
  );
}
