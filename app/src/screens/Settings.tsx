import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { Icon, type IconName } from '../icons';
import { formatDuration } from '../format';
import type { Nav } from '../nav';
import { XP_TABLE, award, levelFor, loadProgress, resetProgress, type Progress } from '../progress';
import { eraseWallet, lockWallet, revealMnemonic } from '../session';
import { loadNetwork, saveNetwork } from '../storage';
import { colors, fonts, type } from '../theme';
import { Banner, Button, H1, Header, P, PIN_LENGTH, PinPad, Screen } from '../ui';
import type { NetworkName } from '@brbit/wallet-core';

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[type.label, { marginLeft: 4 }]}>{label}</Text>
      <View style={{ borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16 }}>{children}</View>
    </View>
  );
}

function Item({ icon, label, value, onPress, first, testID, danger }: { icon: IconName; label: string; value?: string; onPress?: () => void; first?: boolean; testID?: string; danger?: boolean }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, borderTopWidth: first ? 0 : 1, borderTopColor: 'rgba(255,255,255,0.07)' }}
    >
      <Icon name={icon} size={20} color={danger ? colors.red : colors.green} />
      <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: danger ? colors.red : colors.text }}>{label}</Text>
      {value ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}>{value}</Text> : null}
      {onPress ? <Icon name="chevron" size={16} color={colors.dim} stroke={2} /> : null}
    </Pressable>
  );
}

export function Settings({ nav }: { nav: Nav }) {
  const [net, setNet] = useState<NetworkName>('testnet');
  const [prog, setProg] = useState<Progress | null>(null);
  useEffect(() => {
    loadNetwork().then(setNet);
    loadProgress().then(setProg);
  }, []);
  const lv = levelFor(prog?.xp ?? 0);

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
    Alert.alert('Apagar a carteira deste aparelho?', 'Sem a frase de recuperação anotada, você perde o acesso aos fundos para sempre.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await eraseWallet();
          await resetProgress();
          nav.go({ name: 'welcome' });
        },
      },
    ]);
  }

  return (
    <Screen tab={{ active: 'settings', nav }}>
      <Header title="Ajustes" />

      <View style={{ gap: 10, padding: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: colors.green }}>Nv{lv.level}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.text }}>Carteira Principal</Text>
            <Text style={type.monoSm}>BTC · {lv.name}</Text>
          </View>
        </View>
        <View accessibilityLabel={`Experiência: ${prog?.xp ?? 0} pontos`} style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <View style={{ width: `${lv.next ? Math.round((lv.into / lv.span) * 100) : 100}%`, height: 6, backgroundColor: colors.green }} />
        </View>
        <Text style={type.monoSm}>
          {prog?.xp ?? 0} XP{lv.next ? ` · faltam ${lv.toNext} para o nível ${lv.next.level} (${lv.next.name})` : ' · nível máximo'}
        </Text>
      </View>

      <Group label="CONQUISTAS">
        {Object.entries(XP_TABLE).map(([key, v], i) => {
          const done = prog?.done.includes(key) ?? false;
          return (
            <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(255,255,255,0.07)', opacity: done ? 1 : 0.55 }}>
              <Icon name={done ? 'check' : 'lock'} size={18} color={done ? colors.green : colors.muted} stroke={2} />
              <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text }}>{v.title}</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: done ? colors.green : colors.muted }}>+{v.xp} XP</Text>
            </View>
          );
        })}
      </Group>

      <Group label="SEGURANÇA">
        <Item first testID="btn-viewkey" icon="lockClosed" label="Ver frase de recuperação" onPress={() => nav.go({ name: 'viewkey' })} />
        <Item icon="shield" label="Bloqueio automático" value="30 s" />
        <Item icon="shieldCheck" label="PIN" value="6 dígitos" />
      </Group>

      <Group label="REDE E PREFERÊNCIAS">
        <Item first icon="wallet" label="Moeda" value="BRL · R$" />
        <Item icon="chart" label="Rede ativa" value={net === 'mainnet' ? 'Mainnet (dinheiro real)' : 'Testnet4 (sem valor)'} />
        {net === 'testnet' ? (
          <Item testID="btn-mainnet" icon="warn" label="Mudar para mainnet" onPress={askMainnet} />
        ) : (
          <Item testID="btn-testnet" icon="refresh" label="Voltar para a testnet" onPress={() => void switchNetwork('testnet')} />
        )}
      </Group>

      <Banner kind="warn">Versão de testes, sem auditoria externa.</Banner>
      <Button testID="btn-erase" title="Apagar carteira deste aparelho" variant="ghost" onPress={askErase} />
    </Screen>
  );
}

/** Ver a frase de recuperação: exige o PIN, bloqueia capturas de tela e some ao sair. */
export function ViewKey({ nav }: { nav: Nav }) {
  const [pin, setPin] = useState('');
  const [words, setWords] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync('secret').catch(() => undefined);
    return () => {
      ScreenCapture.allowScreenCaptureAsync('secret').catch(() => undefined);
    };
  }, []);

  async function onChange(v: string) {
    if (busy) return;
    setPin(v);
    setMsg(null);
    if (v.length < PIN_LENGTH) return;
    setBusy(true);
    const r = await revealMnemonic(v);
    setPin('');
    setBusy(false);
    if (r.ok) {
      setWords(r.mnemonic.split(' '));
      void award('viewedKey');
    } else if (r.reason === 'wrong') {
      setMsg(r.lockedMs > 0 ? `PIN incorreto. Bloqueado por ${formatDuration(r.lockedMs)}.` : `PIN incorreto (${r.failures} erro${r.failures > 1 ? 's' : ''}).`);
    } else if (r.reason === 'locked') setMsg(`Muitas tentativas. Aguarde ${formatDuration(r.remainingMs)}.`);
    else nav.go({ name: 'welcome' });
  }

  if (words) {
    return (
      <Screen>
        <Header title="Sua frase de recuperação" onBack={() => nav.go({ name: 'settings' })} />
        <Banner kind="warn" icon="warn">Quem vê estas palavras controla a carteira. Capturas de tela estão bloqueadas.</Banner>
        <View testID="seed-words" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {words.map((w, i) => (
            <View key={i} accessibilityLabel={`${i + 1} ${w}`} style={{ width: '48%', height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ width: 20, fontFamily: fonts.mono, fontSize: 12, color: colors.muted }}>{String(i + 1).padStart(2, '0')}</Text>
              <Text style={{ fontFamily: fonts.monoMed, fontSize: 16, color: colors.text }}>{w}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 'auto' }}>
          <Button
            testID="btn-hide-key"
            title="Ocultar e voltar"
            onPress={() => {
              setWords(null);
              nav.go({ name: 'settings' });
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Header onBack={() => nav.go({ name: 'settings' })} />
      <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <H1 style={{ fontSize: 30, textAlign: 'center' }}>Confirme seu PIN</H1>
          <P small style={{ textAlign: 'center' }}>{busy ? 'Abrindo o cofre…' : 'Para ver a frase de recuperação, digite o PIN.'}</P>
        </View>
        <PinPad value={pin} onChange={onChange} error={!!msg} />
        {msg ? <Banner kind="danger">{msg}</Banner> : null}
      </View>
    </Screen>
  );
}
