import { assessPin, isValidMnemonic, newMnemonic, normalizeMnemonic, type NetworkName } from '@brbit/wallet-core';
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Icon, type IconName } from '../icons';
import type { Nav } from '../nav';
import { award, levelFor, loadProgress } from '../progress';
import { createWallet, currentKeys } from '../session';
import { loadNetwork } from '../storage';
import { colors, fonts, glow, type } from '../theme';
import { Banner, Button, Card, CoinBadge, Field, H1, Header, Mono, P, PIN_LENGTH, PinPad, Pill, Screen } from '../ui';

/** Bloqueia capturas de tela e gravação enquanto dados secretos estão visíveis. */
function useSecureScreen() {
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync('secret').catch(() => undefined);
    return () => {
      ScreenCapture.allowScreenCaptureAsync('secret').catch(() => undefined);
    };
  }, []);
}

function useNetwork(): NetworkName {
  const [net, setNet] = useState<NetworkName>('testnet');
  useEffect(() => {
    loadNetwork().then(setNet);
  }, []);
  return net;
}

// ───────────────────────── 1 · Boas-vindas ─────────────────────────

function DecorChart() {
  return (
    <Svg width="100%" height={150} viewBox="0 0 342 150" preserveAspectRatio="none" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.green} stopOpacity="0" />
          <Stop offset="0.45" stopColor={colors.green} stopOpacity="0.9" />
          <Stop offset="1" stopColor={colors.green} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Path
        d="M0 120 L30 112 L60 118 L90 96 L120 102 L150 78 L180 86 L210 58 L240 66 L270 38 L300 46 L330 18"
        fill="none"
        stroke="url(#fade)"
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={330} cy={18} r={5} fill={colors.green} />
    </Svg>
  );
}

export function Welcome({ nav }: { nav: Nav }) {
  return (
    <Screen scroll={false} glowAt="bottom">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12 }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 15, color: colors.green }}>B</Text>
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.text, letterSpacing: 0.3 }}>BR Bit</Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
        <DecorChart />
        <Text style={{ fontFamily: fonts.display, fontSize: 42, lineHeight: 46, letterSpacing: -0.5, color: colors.text }}>
          Bitcoin sob{'\n'}
          <Text style={{ color: colors.green }}>o seu controle.</Text>
        </Text>
        <P style={{ maxWidth: 310 }}>Uma carteira de Bitcoin com mercado ao vivo. Suas chaves ficam apenas neste aparelho.</P>
      </View>

      <View style={{ gap: 12 }}>
        <Banner kind="warn">Versão de testes. Rede padrão: testnet. Não use com dinheiro real.</Banner>
        <Button testID="btn-create" title="Criar nova carteira" onPress={() => nav.go({ name: 'aviso' })} />
        <Button testID="btn-import" title="Importar carteira" variant="outline" onPress={() => nav.go({ name: 'import' })} />
      </View>
    </Screen>
  );
}

// ───────────────────────── 2 · Aviso da frase (1/4) ─────────────────────────

const RULES: Array<{ icon: IconName; text: string }> = [
  { icon: 'pencil', text: 'Anote em papel, na ordem exata' },
  { icon: 'noCamera', text: 'Nada de foto ou screenshot: o app bloqueia a captura' },
  { icon: 'shield', text: 'Nunca compartilhe, nem com o suporte' },
  { icon: 'lockClosed', text: 'Guarde em um local seguro e privado' },
];

export function SeedNotice({ nav }: { nav: Nav }) {
  const net = useNetwork();
  return (
    <Screen
      footer={
        <>
          <Text style={{ textAlign: 'center', fontFamily: fonts.bodyReg, fontSize: 13, color: colors.muted }}>
            Missão de backup · <Text style={{ fontFamily: fonts.bodyBold, color: colors.green }}>+100 XP</Text>
          </Text>
          <Button testID="btn-notice-ok" title="Entendi, continuar" onPress={() => nav.go({ name: 'create' })} />
        </>
      }
    >
      <Header step={{ n: 1, total: 4 }} onBack={() => nav.go({ name: 'welcome' })} />
      <View style={{ gap: 14, paddingTop: 8 }}>
        <Pill tone={net === 'mainnet' ? 'red' : 'green'} dot>
          {net === 'mainnet' ? 'MAINNET · BITCOIN REAL' : 'TESTNET · SEM VALOR'}
        </Pill>
        <H1>Suas 12 palavras são a única chave.</H1>
        <P>Quem tiver as palavras controla seus fundos. Quem perder, perde o acesso para sempre.</P>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        {RULES.map((r) => (
          <View key={r.text} style={{ flexDirection: 'row', gap: 16, alignItems: 'center', minHeight: 64, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Icon name={r.icon} color={colors.green} stroke={1.7} />
            <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 20, color: colors.text }}>{r.text}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

// ───────────────────────── 3 · Suas 12 palavras (2/4) ─────────────────────────

export function CreateSeed({ nav, initial }: { nav: Nav; initial?: string }) {
  useSecureScreen();
  const mnemonic = useMemo(() => initial ?? newMnemonic(128), [initial]);
  const [shown, setShown] = useState(false);
  const words = mnemonic.split(' ');
  return (
    <Screen
      footer={
        <>
          {!shown ? <Button testID="btn-reveal" title="Mostrar palavras" variant="outline" icon="lockClosed" onPress={() => setShown(true)} /> : null}
          <Button testID="btn-saved" title="Já anotei as palavras" disabled={!shown} onPress={() => nav.go({ name: 'confirm', mnemonic })} />
        </>
      }
    >
      <Header step={{ n: 2, total: 4 }} onBack={() => nav.go({ name: 'aviso' })} />
      <View style={{ gap: 10 }}>
        <H1 style={{ fontSize: 34, lineHeight: 37 }}>Anote suas 12 palavras</H1>
        <P small>Na ordem exata, em papel. Quem vê estas palavras controla a carteira.</P>
      </View>
      <Banner kind="info">Captura e gravação de tela bloqueadas aqui</Banner>
      <View testID="seed-words" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {words.map((w, i) => (
          <View
            key={i}
            accessibilityLabel={shown ? `${i + 1} ${w}` : `palavra ${i + 1} oculta`}
            style={{
              width: '48%',
              height: 52,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              borderRadius: 14,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ width: 20, fontFamily: fonts.mono, fontSize: 12, color: colors.muted }}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={{ fontFamily: fonts.monoMed, fontSize: 16, color: shown ? colors.text : colors.dim }}>{shown ? w : '••••••'}</Text>
          </View>
        ))}
      </View>
      <Text style={{ textAlign: 'center', fontFamily: fonts.bodyReg, fontSize: 12, lineHeight: 18, color: colors.muted }}>
        Sem botão de copiar de propósito: outros apps podem ler a área de transferência.
      </Text>
    </Screen>
  );
}

// ───────────────────────── 4 · Missão: confirmar a frase (3/4) ─────────────────────────

const QUESTIONS = 3;

function randomInts(count: number, max: number): number[] {
  const buf = new Uint32Array(count * 8);
  crypto.getRandomValues(buf);
  const out: number[] = [];
  for (const n of buf) {
    const v = n % max;
    if (!out.includes(v)) out.push(v);
    if (out.length === count) break;
  }
  for (let i = 0; out.length < count; i++) if (!out.includes(i)) out.push(i);
  return out;
}

interface Question {
  /** Posição pedida, 1..12. */
  number: number;
  correct: string;
  options: string[];
}

function buildQuestions(words: string[]): Question[] {
  return randomInts(QUESTIONS, words.length)
    .sort((a, b) => a - b)
    .map((idx) => {
      const correct = words[idx]!;
      const decoys: string[] = [];
      const order = randomInts(words.length, words.length);
      for (const j of order) {
        const w = words[j]!;
        if (w !== correct && !decoys.includes(w)) decoys.push(w);
        if (decoys.length === 3) break;
      }
      const options = [correct, ...decoys];
      const shuffle = randomInts(options.length, options.length);
      return { number: idx + 1, correct, options: shuffle.map((k) => options[k]!) };
    });
}

export function ConfirmSeed({ nav, mnemonic }: { nav: Nav; mnemonic: string }) {
  useSecureScreen();
  const words = mnemonic.split(' ');
  const questions = useMemo(() => buildQuestions(words), [mnemonic]);
  const [q, setQ] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const cur = questions[q]!;
  const ok = pick === cur.correct;
  const last = q === QUESTIONS - 1;

  async function next() {
    if (!last) {
      setQ(q + 1);
      setPick(null);
      return;
    }
    await award('backup');
    nav.go({ name: 'setpin', mnemonic, isNew: true });
  }

  return (
    <Screen
      footer={
        <Button
          testID="btn-quiz-next"
          title={ok ? (last ? 'Continuar · +100 XP' : 'Próxima pergunta') : 'Escolha uma palavra'}
          disabled={!ok}
          onPress={() => void next()}
        />
      }
    >
      <Header step={{ n: 3, total: 4 }} onBack={() => nav.go({ name: 'create', mnemonic })} />
      <View style={{ gap: 10 }}>
        <H1 style={{ fontSize: 34, lineHeight: 37 }}>Confirme o backup</H1>
        <P small>
          Sem olhar o papel, escolha a palavra certa. <Text testID="quiz-progress">Pergunta {q + 1} de {QUESTIONS}.</Text>
        </P>
      </View>

      <View style={{ alignItems: 'center', gap: 4, paddingVertical: 28, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.4, color: colors.muted }}>QUAL É A PALAVRA Nº</Text>
        <Text
          testID="quiz-number"
          accessibilityLabel={`Palavra número ${cur.number}`}
          style={{ fontFamily: fonts.display, fontSize: 80, lineHeight: 88, color: colors.green, textShadowColor: 'rgba(43,255,136,0.5)', textShadowRadius: 22 }}
        >
          {cur.number}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {cur.options.map((w) => {
          const sel = pick === w;
          const good = sel && w === cur.correct;
          const bad = sel && w !== cur.correct;
          return (
            <Pressable
              key={w}
              testID={`opt-${w}`}
              accessibilityRole="button"
              accessibilityLabel={w}
              onPress={() => setPick(w)}
              style={{
                width: '48%',
                minHeight: 60,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: good ? colors.green : bad ? colors.red : colors.borderMid,
                backgroundColor: good ? 'rgba(43,255,136,0.08)' : bad ? colors.redFaint : colors.surface,
              }}
            >
              <Text style={{ fontFamily: fonts.monoMed, fontSize: 17, color: colors.text }}>{w}</Text>
            </Pressable>
          );
        })}
      </View>

      {pick && !ok ? <Text style={{ textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 14, color: colors.redSoft }}>Não é essa. Confira o papel e tente de novo.</Text> : null}
      {ok ? <Text style={{ textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 14, color: colors.green }}>{last ? 'Correto. Backup validado.' : 'Correto.'}</Text> : null}

    </Screen>
  );
}

// ───────────────────────── 5 · Criar PIN (4/4) ─────────────────────────

export function SetPin({ nav, mnemonic, isNew }: { nav: Nav; mnemonic: string; isNew: boolean }) {
  useSecureScreen();
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const full = pin.length === PIN_LENGTH;

  async function proceed() {
    setError(null);
    if (first === null) {
      const a = assessPin(pin);
      if (!a.ok) {
        setError(a.reasons[0] ?? 'PIN fraco.');
        setPin('');
        return;
      }
      setFirst(pin);
      setPin('');
      return;
    }
    if (pin !== first) {
      setError('Os PINs não conferem. Comece de novo.');
      setFirst(null);
      setPin('');
      return;
    }
    setBusy(true);
    try {
      await createWallet(mnemonic, pin, await loadNetwork(), isNew);
      await award('pin');
      nav.go({ name: 'ready', isNew });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao proteger a carteira.');
      setFirst(null);
      setPin('');
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <Button
          testID="btn-pin-next"
          title={!full ? 'Digite os 6 dígitos' : first === null ? 'Continuar' : 'Criar minha carteira'}
          disabled={!full}
          loading={busy}
          onPress={() => void proceed()}
        />
      }
    >
      <Header step={{ n: 4, total: 4 }} onBack={busy ? undefined : () => nav.go(isNew ? { name: 'confirm', mnemonic } : { name: 'import' })} />
      <View style={{ alignItems: 'center', gap: 10, paddingTop: 4 }}>
        <H1 style={{ fontSize: 32, textAlign: 'center' }}>{first === null ? 'Crie seu PIN' : 'Repita o PIN'}</H1>
        <P small style={{ textAlign: 'center', maxWidth: 290 }}>
          {busy ? 'Protegendo a carteira…' : `${PIN_LENGTH} dígitos para abrir o app neste aparelho. A recuperação continua sendo a frase.`}
        </P>
      </View>
      <PinPad value={pin} onChange={busy ? () => undefined : setPin} error={!!error} />
      {error ? <Banner kind="danger">{error}</Banner> : null}
    </Screen>
  );
}

// ───────────────────────── 6 · Carteira criada ─────────────────────────

export function Ready({ nav, isNew }: { nav: Nav; isNew: boolean }) {
  const keys = currentKeys();
  const address = keys?.addressAt(0, 0);
  const [lv, setLv] = useState(levelFor(0));
  const [xp, setXp] = useState(0);
  useEffect(() => {
    loadProgress().then((p) => {
      setXp(p.xp);
      setLv(levelFor(p.xp));
    });
  }, []);
  const net = keys?.network.name ?? 'testnet';
  return (
    <Screen glowAt="top" footer={<Button testID="btn-enter" title="Acessar carteira" onPress={() => nav.go({ name: 'home' })} />}>
      <View style={{ alignItems: 'center', gap: 14, paddingTop: 36 }}>
        <View style={[{ width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' }, glow(colors.green, 1)]}>
          <Icon name="check" size={34} color={colors.green} stroke={2.2} />
        </View>
        <H1 style={{ fontSize: 34, textAlign: 'center' }}>{isNew ? 'Carteira criada' : 'Carteira importada'}</H1>
        <P small style={{ textAlign: 'center', maxWidth: 290 }}>
          {net === 'mainnet' ? 'Rede principal: fundos reais.' : 'Rede de testes: sem valor real.'} Seu endereço de Bitcoin está pronto.
        </P>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CoinBadge letter="B" bg={colors.btc} ink={colors.btcInk} size={28} />
          <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text }}>Bitcoin</Text>
          <Text style={type.monoSm}>Native SegWit</Text>
        </View>
        <Mono>{address?.address ?? '—'}</Mono>
        <Text style={type.monoSm}>{address?.path ?? ''}</Text>
      </Card>

      <Card style={{ opacity: 0.6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CoinBadge letter="S" bg={colors.sol} ink="#fff" size={28} />
          <Text style={{ flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text }}>Solana</Text>
          <Text style={type.monoSm}>em breve</Text>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(43,255,136,0.3)' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.displayBold, color: colors.green }}>{lv.level}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }}>
            Nível {lv.level} · {lv.name}
          </Text>
          <Text style={{ fontFamily: fonts.bodyReg, fontSize: 12, color: colors.muted }}>{isNew ? 'Backup feito e PIN criado' : 'PIN criado'}</Text>
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.green }}>+{xp} XP</Text>
      </View>

    </Screen>
  );
}

// ───────────────────────── 7 · Importar carteira ─────────────────────────

export function ImportWallet({ nav }: { nav: Nav }) {
  useSecureScreen();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const count = text.trim() ? text.trim().split(/\s+/).length : 0;
  const target = count > 12 ? 24 : 12;

  function next() {
    if (!isValidMnemonic(text)) {
      setError('Frase inválida. Confira as palavras, a ordem e o número (12 ou 24). As palavras vêm do dicionário BIP39 em inglês.');
      return;
    }
    nav.go({ name: 'setpin', mnemonic: normalizeMnemonic(text), isNew: false });
  }

  return (
    <Screen footer={<Button testID="btn-import-next" title="Importar e criar PIN" disabled={count === 0} onPress={next} />}>
      <Header title="Importar carteira" onBack={() => nav.go({ name: 'welcome' })} />
      <Field
        testID="import-input"
        label="FRASE DE RECUPERAÇÃO · 12 OU 24 PALAVRAS"
        multiline
        accent
        value={text}
        onChangeText={(t) => {
          setText(t);
          setError(null);
        }}
        placeholder="Digite ou cole as palavras separadas por espaço"
        autoComplete="off"
        importantForAutofill="no"
        spellCheck={false}
        style={{ fontSize: 15, lineHeight: 24 }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bodyReg, fontSize: 12, color: colors.muted }}>Sem histórico nem sugestões do teclado</Text>
        <Text testID="import-count" style={type.monoSm}>
          {count}/{target}
        </Text>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
          <CoinBadge letter="B" bg={colors.btc} ink={colors.btcInk} size={30} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }}>Bitcoin</Text>
            <Text style={type.monoSm}>Native SegWit · m/84'/0'/0'</Text>
          </View>
        </View>
      </Card>

      <Banner kind="warn" icon="warn">
        Importe só em aparelho de confiança. Nunca digite suas palavras em sites nem envie a quem se diga "suporte".
      </Banner>
      {error ? <Banner kind="danger">{error}</Banner> : null}
    </Screen>
  );
}
