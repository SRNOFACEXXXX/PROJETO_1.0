import { isValidMnemonic, newMnemonic, normalizeMnemonic, assessPin } from '@brbit/wallet-core';
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { Nav } from '../nav';
import { loadNetwork } from '../storage';
import { createWallet } from '../session';
import { colors, glow } from '../theme';
import { Banner, Body, Card, Field, NeonButton, PIN_LENGTH, PinPad, Screen, Title } from '../ui';

/** Bloqueia capturas de tela e gravação enquanto dados secretos estão visíveis. */
function useSecureScreen() {
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync('secret').catch(() => undefined);
    return () => {
      ScreenCapture.allowScreenCaptureAsync('secret').catch(() => undefined);
    };
  }, []);
}

export function Welcome({ nav }: { nav: Nav }) {
  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 20 }}>
        <Text style={{ color: colors.cyan, fontSize: 14, letterSpacing: 6, fontWeight: '800' }}>BR BIT</Text>
        <Text style={{ color: colors.text, fontSize: 44, fontWeight: '900', lineHeight: 50, ...glow(colors.cyan, 0.4) }}>
          Sua carteira.{'\n'}Suas chaves.
        </Text>
        <Body muted>
          Carteira Bitcoin de código aberto. A frase de recuperação nunca sai do seu aparelho.
        </Body>
        <Banner kind="warn">Versão de testes. Rede padrão: testnet. Não use com dinheiro real.</Banner>
      </View>
      <View style={{ gap: 12 }}>
        <NeonButton testID="btn-create" title="Criar carteira" onPress={() => nav.go({ name: 'create' })} />
        <NeonButton testID="btn-import" title="Já tenho uma frase" variant="ghost" onPress={() => nav.go({ name: 'import' })} />
      </View>
    </Screen>
  );
}

export function CreateSeed({ nav, initial }: { nav: Nav; initial?: string }) {
  useSecureScreen();
  const mnemonic = useMemo(() => initial ?? newMnemonic(128), [initial]);
  const [shown, setShown] = useState(false);
  const [saved, setSaved] = useState(false);
  const words = mnemonic.split(' ');
  return (
    <Screen>
      <Title>Frase de recuperação</Title>
      <Body muted>
        Anote as 12 palavras, em ordem, em papel. Quem tiver essas palavras controla seus bitcoins. Nunca tire foto nem
        guarde em nuvem.
      </Body>
      <Card accent={colors.magenta}>
        {shown ? (
          <View testID="seed-words" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {words.map((w, i) => (
              <View
                key={i}
                style={{ width: '31%', flexDirection: 'row', gap: 6, paddingVertical: 6 }}
                accessibilityLabel={`${i + 1} ${w}`}
              >
                <Text style={{ color: colors.muted, width: 22, fontSize: 12 }}>{i + 1}</Text>
                <Text style={{ color: colors.lime, fontSize: 15, fontWeight: '700' }}>{w}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ paddingVertical: 28, alignItems: 'center', gap: 12 }}>
            <Body muted>Verifique se ninguém está olhando a sua tela.</Body>
            <NeonButton testID="btn-reveal" title="Mostrar palavras" variant="secondary" onPress={() => setShown(true)} />
          </View>
        )}
      </Card>
      <NeonButton
        testID="btn-saved"
        title={saved ? '✓ Anotei as palavras' : 'Anotei as palavras'}
        variant="ghost"
        disabled={!shown}
        onPress={() => setSaved(true)}
      />
      <NeonButton
        testID="btn-next"
        title="Continuar"
        disabled={!saved}
        onPress={() => nav.go({ name: 'confirm', mnemonic })}
      />
    </Screen>
  );
}

function pickThree(): number[] {
  const set = new Set<number>();
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  for (const n of buf) {
    set.add(n % 12);
    if (set.size === 3) break;
  }
  while (set.size < 3) set.add(set.size * 4);
  return [...set].sort((a, b) => a - b);
}

export function ConfirmSeed({ nav, mnemonic }: { nav: Nav; mnemonic: string }) {
  useSecureScreen();
  const words = mnemonic.split(' ');
  const idx = useMemo(pickThree, []);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const ok = idx.every((w, k) => answers[k]?.trim().toLowerCase() === words[w]);
  return (
    <Screen>
      <Title>Confirme a frase</Title>
      <Body muted>Digite as palavras pedidas para provar que você anotou.</Body>
      {idx.map((w, k) => (
        <Field
          key={w}
          testID={`confirm-${k}`}
          label={`Palavra nº ${w + 1}`}
          value={answers[k]}
          onChangeText={(t) => setAnswers((a) => a.map((x, j) => (j === k ? t : x)))}
          placeholder="palavra"
        />
      ))}
      <NeonButton testID="btn-confirm" title="Confirmar" disabled={!ok} onPress={() => nav.go({ name: 'setpin', mnemonic })} />
      <NeonButton testID="btn-confirm-back" title="Voltar" variant="ghost" onPress={() => nav.go({ name: 'create', mnemonic })} />
    </Screen>
  );
}

export function SetPin({ nav, mnemonic }: { nav: Nav; mnemonic: string }) {
  useSecureScreen();
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(v: string) {
    setPin(v);
    setError(null);
    if (v.length < PIN_LENGTH) return;
    if (first === null) {
      const a = assessPin(v);
      if (!a.ok) {
        setError(a.reasons[0] ?? 'PIN fraco.');
        setPin('');
        return;
      }
      setFirst(v);
      setPin('');
      return;
    }
    if (v !== first) {
      setError('Os PINs não conferem. Comece de novo.');
      setFirst(null);
      setPin('');
      return;
    }
    setBusy(true);
    try {
      await createWallet(mnemonic, v, await loadNetwork());
      nav.go({ name: 'home' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao proteger a carteira.');
      setFirst(null);
      setPin('');
      setBusy(false);
    }
  }

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
        <View style={{ gap: 8, alignItems: 'center' }}>
          <Title>{first === null ? 'Crie seu PIN' : 'Repita o PIN'}</Title>
          <Body muted style={{ textAlign: 'center' }}>
            {busy ? 'Protegendo a carteira…' : `${PIN_LENGTH} dígitos. Ele protege sua frase neste aparelho.`}
          </Body>
        </View>
        <PinPad value={pin} onChange={busy ? () => undefined : onChange} error={!!error} />
        {error ? <Banner kind="danger">{error}</Banner> : null}
      </View>
    </Screen>
  );
}

export function ImportWallet({ nav }: { nav: Nav }) {
  useSecureScreen();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  function next() {
    if (!isValidMnemonic(text)) {
      setError('Frase inválida. Confira as palavras, a ordem e o número (12 ou 24).');
      return;
    }
    nav.go({ name: 'setpin', mnemonic: normalizeMnemonic(text) });
  }
  return (
    <Screen>
      <Title>Importar carteira</Title>
      <Body muted>Digite as 12 ou 24 palavras separadas por espaço.</Body>
      <Field
        testID="import-input"
        label="Frase de recuperação"
        multiline
        secureTextEntry={false}
        value={text}
        onChangeText={(t) => {
          setText(t);
          setError(null);
        }}
        placeholder="palavra1 palavra2 palavra3 …"
        autoComplete="off"
        importantForAutofill="no"
      />
      {error ? <Banner kind="danger">{error}</Banner> : null}
      <NeonButton testID="btn-import-next" title="Continuar" disabled={text.trim().length === 0} onPress={next} />
      <NeonButton title="Voltar" variant="ghost" onPress={() => nav.go({ name: 'welcome' })} />
    </Screen>
  );
}
