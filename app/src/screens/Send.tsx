import {
  DEFAULT_POLICY,
  InsufficientFundsError,
  InvalidTransactionError,
  buildAndSign,
  evaluateSpend,
  formatBrlFixed,
  maxSendable,
  type FeeEstimates,
  type SignedTransaction,
} from '@brbit/wallet-core';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, TextInput, View } from 'react-native';
import { explorerFor } from '../explorer';
import { formatBtc, formatBtcShort, formatDuration, parseBtcToSats } from '../format';
import { Icon } from '../icons';
import { marketClient } from '../market';
import type { Nav } from '../nav';
import { award } from '../progress';
import { currentKeys, verifyPin } from '../session';
import { StatusBanner } from '../status';
import { colors, fonts, glow, type } from '../theme';
import { Banner, Button, Card, H1, Header, Label, Mono, P, PIN_LENGTH, PinPad, Screen } from '../ui';
import { useBack } from '../useBack';
import { useResource } from '../useResource';
import { useWallet } from '../useWallet';

type Step = 'form' | 'review' | 'pin' | 'done';
type Speed = 'slow' | 'normal' | 'fast';

const SPEEDS: Array<{ key: Speed; label: string; eta: string; pick: (f: FeeEstimates) => number }> = [
  { key: 'slow', label: 'Lenta', eta: '~60 min', pick: (f) => f.hour },
  { key: 'normal', label: 'Normal', eta: '~30 min', pick: (f) => f.halfHour },
  { key: 'fast', label: 'Rápida', eta: '~10 min', pick: (f) => f.fastest },
];

/** Segura por 1,2 s para confirmar: evita toque acidental em uma ação irreversível. */
function HoldToConfirm({ onDone }: { onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <Pressable
      testID="btn-hold-send"
      accessibilityRole="button"
      accessibilityLabel="Segure para enviar"
      accessibilityHint="Mantenha pressionado por um segundo para confirmar o envio"
      accessibilityActions={[{ name: 'activate', label: 'Confirmar envio' }]}
      onAccessibilityAction={() => onDone()}
      onPressIn={() => {
        setHolding(true);
        Animated.timing(progress, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
          if (finished) {
            setHolding(false);
            progress.setValue(0);
            onDone();
          }
        });
      }}
      onPressOut={() => {
        setHolding(false);
        progress.stopAnimation();
        progress.setValue(0);
      }}
      style={[
        { minHeight: 60, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
        glow(colors.green, holding ? 1 : 0.8),
      ]}
    >
      <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 16, color: colors.greenInk }}>{holding ? 'Continue segurando…' : 'Segure para enviar'}</Text>
      <Animated.View style={{ position: 'absolute', left: 0, bottom: 0, height: 5, width, backgroundColor: colors.greenInk, opacity: 0.55 }} />
    </Pressable>
  );
}

/** Endereço em grupos de 4, com o começo e o fim destacados (para conferir contra malware que troca o endereço). */
function AddressChips({ address }: { address: string }) {
  const groups = useMemo(() => address.match(/.{1,4}/g) ?? [address], [address]);
  return (
    <View testID="review-address" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {groups.map((g, i) => {
        const edge = i < 2 || i >= groups.length - 2;
        return (
          <Text
            key={i}
            style={{
              paddingVertical: 4,
              paddingHorizontal: 6,
              borderRadius: 6,
              overflow: 'hidden',
              fontFamily: edge ? fonts.monoMed : fonts.mono,
              fontSize: 15,
              color: edge ? colors.green : colors.text,
              backgroundColor: edge ? 'rgba(43,255,136,0.14)' : 'rgba(255,255,255,0.05)',
            }}
          >
            {g}
          </Text>
        );
      })}
    </View>
  );
}

export function Send({ nav }: { nav: Nav }) {
  const keys = currentKeys();
  const wallet = useWallet();
  const state = wallet.state;
  const loading = wallet.status === 'loading';
  const [step, setStep] = useState<Step>('form');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [speed, setSpeed] = useState<Speed>('normal');
  const [fees, setFees] = useState<FeeEstimates | null>(null);
  const [feeError, setFeeError] = useState(false);
  const [preview, setPreview] = useState<SignedTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [txid, setTxid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isMain = keys?.network.name === 'mainnet';
  const ticker = useResource('ticker:BTCBRL', async () => (await marketClient.getTickers(['BTCBRL']))[0]!, 30_000);

  useEffect(() => {
    if (!keys) return;
    let alive = true;
    setFeeError(false);
    explorerFor(keys)
      .getFees()
      .then((f) => alive && setFees(f))
      .catch(() => alive && setFeeError(true));
    return () => {
      alive = false;
    };
  }, [keys]);

  // Voltar do Android: desfaz um passo do envio antes de sair da tela.
  useBack(() => {
    if (busy) return true; // assinando/enviando: não interromper
    if (step === 'pin') return setStep('review'), true;
    if (step === 'review') return setStep('form'), true;
    if (step === 'done') return nav.go({ name: 'home' }), true;
    return false;
  });

  if (!keys) return null;
  const unit = isMain ? 'BTC' : 'tBTC';
  const tier = SPEEDS.find((s) => s.key === speed)!;
  const feeRate = fees ? Math.max(1, tier.pick(fees)) : 0;
  const sats = parseBtcToSats(amount);
  const approx = isMain && sats !== null && ticker.data ? (Number(sats) / 1e8) * ticker.data.last : null;

  function useMax() {
    if (!state || !fees) return;
    const max = maxSendable(state.utxos, feeRate);
    if (max <= 0n) {
      setError('Saldo insuficiente para cobrir a taxa.');
      return;
    }
    setError(null);
    setAmount(formatBtc(max));
  }

  /** Monta a transação (sem enviar) para mostrar os valores reais na revisão. */
  function build(): SignedTransaction | null {
    if (!keys || !state) return null;
    if (sats === null) {
      setError('Valor inválido. Use até 8 casas decimais.');
      return null;
    }
    if (!fees) {
      setError('Taxas indisponíveis.');
      return null;
    }
    const decision = evaluateSpend(DEFAULT_POLICY, { origin: 'user', to, amountSats: sats, feeRate }, [], Date.now());
    if (decision.decision === 'deny') {
      setError(decision.reasons.join(' '));
      return null;
    }
    try {
      return buildAndSign({ keys, utxos: state.utxos, to: to.trim(), amountSats: sats, feeRate, changeAddress: state.nextChange });
    } catch (e) {
      if (e instanceof InsufficientFundsError) {
        setError(`Saldo insuficiente. Precisa de ${formatBtc(e.needed)} ${unit} (valor + taxa).`);
      } else if (e instanceof InvalidTransactionError) {
        setError(e.message);
      } else {
        setError('Não foi possível montar a transação.');
      }
      return null;
    }
  }

  function review() {
    setError(null);
    const t = build();
    if (t) {
      setPreview(t);
      setStep('review');
    }
  }

  async function onPin(v: string) {
    if (busy) return;
    setPin(v);
    setError(null);
    if (v.length < PIN_LENGTH) return;
    setBusy(true);
    try {
      const r = await verifyPin(v);
      if (!r.ok) {
        setPin('');
        setError(
          r.reason === 'wrong'
            ? r.lockedMs > 0
              ? `PIN incorreto. Bloqueado por ${formatDuration(r.lockedMs)}.`
              : 'PIN incorreto.'
            : r.reason === 'locked'
              ? `Muitas tentativas. Aguarde ${formatDuration(r.remainingMs)}.`
              : 'Carteira apagada.',
        );
        if (r.reason === 'wiped') nav.go({ name: 'welcome' });
        return;
      }
      // Reconstrói a transação no momento do envio, com o estado atual.
      const t = build();
      if (!t) return setStep('form');
      const id = await explorerFor(keys!).broadcast(t.hex);
      setTxid(id);
      setStep('done');
      void award('firstSend');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao enviar.');
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'pin') {
    return (
      <Screen scroll={false}>
        <Header onBack={busy ? undefined : () => setStep('review')} />
        <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <H1 style={{ fontSize: 30, textAlign: 'center' }}>Autorizar envio</H1>
            <P small style={{ textAlign: 'center' }}>{busy ? 'Assinando e enviando…' : 'Digite seu PIN para assinar.'}</P>
          </View>
          <PinPad value={pin} onChange={onPin} error={!!error} />
          {error ? <Banner kind="danger">{error}</Banner> : null}
        </View>
      </Screen>
    );
  }

  if (step === 'done') {
    return (
      <Screen glowAt="top" footer={<Button testID="btn-done" title="Concluir" onPress={() => nav.go({ name: 'home' })} />}>
        <View style={{ alignItems: 'center', gap: 14, paddingTop: 36 }}>
          <View style={[{ width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' }, glow(colors.green, 1)]}>
            <Icon name="check" size={34} color={colors.green} stroke={2.2} />
          </View>
          <H1 style={{ fontSize: 32, textAlign: 'center' }}>Enviado</H1>
          <P small style={{ textAlign: 'center', maxWidth: 290 }}>A transação foi transmitida à rede. Ela aparece como pendente até ser confirmada.</P>
        </View>
        <Card tone="green">
          <Label>ID DA TRANSAÇÃO</Label>
          <Mono size={12}>{txid}</Mono>
        </Card>
      </Screen>
    );
  }

  if (step === 'review' && preview) {
    const total = preview.amountSats + preview.feeSats;
    return (
      <Screen
        footer={
          <>
            <HoldToConfirm
              onDone={() => {
                setPin('');
                setError(null);
                setStep('pin');
              }}
            />
            <Button testID="btn-cancel-send" title="Cancelar" variant="ghost" onPress={() => setStep('form')} />
          </>
        }
      >
        <Header title="Revisar envio" onBack={() => setStep('form')} />
        <View style={{ alignItems: 'center', gap: 6, paddingTop: 12 }}>
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.muted }}>Você envia</Text>
          <Text testID="review-amount" style={{ fontFamily: fonts.display, fontSize: 40, letterSpacing: -1, color: colors.text }}>
            {formatBtcShort(preview.amountSats)} <Text style={{ fontSize: 26, color: colors.btc }}>{unit}</Text>
          </Text>
          {isMain && ticker.data ? <Text style={type.mono}>≈ {formatBrlFixed((Number(preview.amountSats) / 1e8) * ticker.data.last)}</Text> : null}
        </View>

        <Card>
          <Label>ENDEREÇO DE DESTINO</Label>
          <AddressChips address={preview.to} />
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="warn" size={16} color={colors.amber} stroke={2} />
            <Text style={{ flex: 1, fontFamily: fonts.bodyReg, fontSize: 12, lineHeight: 18, color: colors.soft }}>
              Confira o começo e o fim do endereço. Malwares trocam o endereço copiado.
            </Text>
          </View>
        </Card>

        <View style={{ paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          {[
            ['Rede', isMain ? 'Bitcoin · mainnet' : 'Bitcoin · testnet'],
            [`Taxa (${feeRate} sat/vB)`, `${formatBtc(preview.feeSats)} ${unit}`],
            ['Tempo estimado', tier.eta],
          ].map(([k, v], i) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
              <Text style={{ fontFamily: fonts.bodyReg, fontSize: 14, color: colors.muted }}>{k}</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.text }}>{v}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ fontFamily: fonts.bodyReg, fontSize: 14, color: colors.muted }}>Total</Text>
            <Text testID="review-total" style={{ fontFamily: fonts.monoMed, fontSize: 14, color: colors.green }}>
              {formatBtc(total)} {unit}
            </Text>
          </View>
        </View>

        {isMain ? <Banner kind="danger">MAINNET: dinheiro real e envio irreversível. Confira o endereço.</Banner> : null}
      </Screen>
    );
  }

  return (
    <Screen footer={<Button testID="btn-review" title="Revisar envio" disabled={!state || !fees || !to || !amount} onPress={review} />}>
      <Header title="Enviar" onBack={() => nav.go({ name: 'home' })} />

      <View style={{ gap: 8 }}>
        <Label>PARA</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 56, paddingLeft: 16, paddingRight: 6, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMid }}>
          <TextInput
            testID="send-to"
            value={to}
            onChangeText={(t) => {
              setTo(t);
              setError(null);
            }}
            placeholder={isMain ? 'Endereço bc1q…' : 'Endereço tb1q…'}
            placeholderTextColor={colors.dim}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            selectionColor={colors.green}
            style={{ flex: 1, color: colors.text, fontFamily: fonts.mono, fontSize: 14, paddingVertical: 12 }}
          />
          <Pressable
            testID="btn-paste"
            accessibilityRole="button"
            accessibilityLabel="Colar endereço"
            onPress={async () => {
              const t = (await Clipboard.getStringAsync()).trim();
              if (t) {
                setTo(t);
                setError(null);
              }
            }}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="copy" size={20} color={colors.green} />
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>VALOR</Label>
          <Pressable
            testID="btn-max"
            accessibilityRole="button"
            accessibilityLabel="Usar o valor máximo"
            onPress={useMax}
            style={{ minHeight: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(43,255,136,0.45)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.green }}>MAX</Text>
          </Pressable>
        </View>
        <View style={{ padding: 18, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <TextInput
              testID="send-amount"
              value={amount}
              onChangeText={(t) => {
                setAmount(t);
                setError(null);
              }}
              placeholder="0,00000000"
              placeholderTextColor={colors.dim}
              keyboardType="decimal-pad"
              selectionColor={colors.green}
              style={{ flex: 1, color: colors.text, fontFamily: fonts.display, fontSize: 34, padding: 0 }}
            />
            <Text style={{ fontFamily: fonts.bodyBold, color: colors.muted }}>{unit}</Text>
          </View>
          <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.muted }}>
            {approx !== null ? `≈ ${formatBrlFixed(approx)} · ` : ''}saldo {state ? formatBtcShort(state.confirmedSats) : loading ? '…' : '—'} {unit}
          </Text>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Label>TAXA DE REDE</Label>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SPEEDS.map((s) => {
            const on = s.key === speed;
            const rate = fees ? Math.max(1, s.pick(fees)) : null;
            return (
              <Pressable
                key={s.key}
                testID={`fee-${s.key}`}
                accessibilityRole="button"
                accessibilityLabel={`Taxa ${s.label}`}
                accessibilityState={{ selected: on }}
                onPress={() => setSpeed(s.key)}
                style={{
                  flex: 1,
                  minHeight: 68,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  backgroundColor: on ? 'rgba(43,255,136,0.06)' : colors.surface,
                  borderWidth: 1,
                  borderColor: on ? colors.green : colors.border,
                }}
              >
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14, color: on ? colors.green : colors.text }}>{s.label}</Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.muted }}>{rate !== null ? `${rate} sat/vB` : '…'}</Text>
                <Text style={{ fontFamily: fonts.bodyReg, fontSize: 12, color: colors.muted }}>{s.eta}</Text>
              </Pressable>
            );
          })}
        </View>
        {feeError ? <Text style={{ fontFamily: fonts.bodyReg, fontSize: 12, color: colors.amberSoft }}>Não foi possível obter as taxas agora.</Text> : null}
      </View>

      {!state && !loading ? (
        <>
          <Banner kind="warn">Sem resposta do servidor: não dá para enviar agora, porque o app precisa conferir seus saldos na rede.</Banner>
          <StatusBanner status={wallet.status} error={wallet.error} retryIn={wallet.retryIn} />
          <Button testID="btn-send-retry" title="Tentar agora" variant="ghost" onPress={wallet.refresh} />
        </>
      ) : null}
      {error ? <Banner kind="danger">{error}</Banner> : null}
    </Screen>
  );
}
