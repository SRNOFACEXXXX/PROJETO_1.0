import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Icon, type IconName } from './icons';
import type { Nav } from './nav';
import { colors, fonts, glow, radius, space, type } from './theme';

// ───────────────────────── Estrutura ─────────────────────────

/** Brilho verde difuso (gradiente radial), como nas telas de boas-vindas e "carteira criada". */
function GlowBackdrop({ at }: { at: 'top' | 'bottom' }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="g" cx="50%" cy={at === 'top' ? '0%' : '100%'} rx="70%" ry="38%">
            <Stop offset="0" stopColor={colors.green} stopOpacity="0.13" />
            <Stop offset="1" stopColor={colors.green} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g)" />
      </Svg>
    </View>
  );
}

export type TabKey = 'home' | 'market' | 'activity' | 'settings';

const TABS: Array<{ key: TabKey; label: string; icon: IconName; route: 'home' | 'markets' | 'activity' | 'settings' }> = [
  { key: 'home', label: 'Início', icon: 'home', route: 'home' },
  { key: 'market', label: 'Mercado', icon: 'chart', route: 'markets' },
  { key: 'activity', label: 'Atividade', icon: 'list', route: 'activity' },
  { key: 'settings', label: 'Ajustes', icon: 'sliders', route: 'settings' },
];

export function TabBar({ active, nav }: { active: TabKey; nav: Nav }) {
  return (
    <View accessibilityRole="tablist" style={s.tabbar}>
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            testID={`tab-${t.key}`}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: on }}
            onPress={() => nav.go({ name: t.route } as never)}
            style={s.tab}
          >
            <View style={on ? glow(colors.green, 0.5) : undefined}>
              <Icon name={t.icon} size={24} color={on ? colors.green : colors.muted} />
            </View>
            <Text style={[s.tabLabel, { color: on ? colors.green : colors.muted }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Screen({
  children,
  scroll = true,
  glowAt,
  tab,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  glowAt?: 'top' | 'bottom';
  tab?: { active: TabKey; nav: Nav };
  /** Ações principais, fixas no rodapé (sempre à vista, mesmo em telas pequenas). */
  footer?: ReactNode;
}) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[s.scroll, tab && { paddingBottom: 24 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[s.scroll, { flex: 1 }]}>{children}</View>
  );
  return (
    <View style={s.root}>
      {glowAt ? <GlowBackdrop at={glowAt} /> : null}
      <SafeAreaView style={s.flex} edges={['top', 'left', 'right', ...(tab ? [] : (['bottom'] as const))]}>
        {body}
        {footer ? <View style={s.footer}>{footer}</View> : null}
        {tab ? <TabBar active={tab.active} nav={tab.nav} /> : null}
      </SafeAreaView>
    </View>
  );
}

/** Cabeçalho: botão de voltar redondo + (opcional) título ou barras de etapa "n/total". */
export function Header({
  onBack,
  title,
  step,
  right,
}: {
  onBack?: () => void;
  title?: string;
  step?: { n: number; total: number };
  right?: ReactNode;
}) {
  return (
    <View style={s.header}>
      {onBack ? (
        <Pressable testID="btn-back" accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={s.back}>
          <Icon name="back" />
        </Pressable>
      ) : null}
      {step ? (
        <>
          <View style={s.steps}>
            {Array.from({ length: step.total }, (_, i) => (
              <View key={i} style={[s.stepBar, { backgroundColor: i < step.n ? colors.green : 'rgba(255,255,255,0.12)' }]} />
            ))}
          </View>
          <Text style={[type.monoSm, { fontSize: 12 }]}>
            {step.n}/{step.total}
          </Text>
        </>
      ) : title ? (
        <Text style={[type.h3, { flex: 1 }]} accessibilityRole="header">
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right}
    </View>
  );
}

// ───────────────────────── Texto ─────────────────────────

export function H1({ children, color, style }: { children: ReactNode; color?: string; style?: TextStyle }) {
  return (
    <Text accessibilityRole="header" style={[type.h1, color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

export function H2({ children, color, style }: { children: ReactNode; color?: string; style?: TextStyle }) {
  return (
    <Text accessibilityRole="header" style={[type.h2, color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

export function P({ children, style, small }: { children: ReactNode; style?: TextStyle; small?: boolean }) {
  return <Text style={[small ? type.bodySm : type.body, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[type.label, style]}>{children}</Text>;
}

export function Mono({ children, color = colors.text, size = 14, style }: { children: ReactNode; color?: string; size?: number; style?: TextStyle }) {
  return (
    <Text selectable style={[{ fontFamily: fonts.mono, color, fontSize: size, letterSpacing: 0.2, lineHeight: size * 1.55 }, style]}>
      {children}
    </Text>
  );
}

// ───────────────────────── Superfícies e botões ─────────────────────────

export function Card({ children, tone, style }: { children: ReactNode; tone?: 'green' | 'amber'; style?: ViewStyle }) {
  const border = tone === 'green' ? 'rgba(43,255,136,0.3)' : tone === 'amber' ? colors.amberLine : colors.border;
  return <View style={[s.card, { borderColor: border }, style]}>{children}</View>;
}

export function Pill({ children, tone = 'green', dot }: { children: ReactNode; tone?: 'green' | 'red' | 'muted'; dot?: boolean }) {
  const c = tone === 'green' ? colors.green : tone === 'red' ? colors.red : colors.muted;
  return (
    <View style={[s.pill, { borderColor: tone === 'muted' ? colors.borderMid : `${c}66` }]}>
      {dot ? <View style={[s.dot, { backgroundColor: c }, glow(c, 0.6)]} /> : null}
      <Text style={[s.pillText, { color: c }]}>{children}</Text>
    </View>
  );
}

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  const off = disabled || loading;
  const fill = variant === 'primary' ? colors.green : variant === 'danger' ? colors.red : 'transparent';
  const ink = variant === 'primary' ? colors.greenInk : variant === 'danger' ? '#1A0008' : variant === 'ghost' ? colors.muted : colors.text;
  const border = variant === 'outline' ? colors.borderStrong : variant === 'ghost' ? 'transparent' : 'transparent';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: off && (variant === 'primary' || variant === 'danger') ? colors.surface2 : fill, borderColor: border },
        variant === 'primary' && !off ? glow(colors.green, pressed ? 0.4 : 0.8) : null,
        pressed && !off ? { opacity: 0.88 } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <View style={s.btnRow}>
          {icon ? <Icon name={icon} size={20} color={off ? colors.muted : ink} /> : null}
          <Text style={[s.btnText, { color: off && (variant === 'primary' || variant === 'danger') ? colors.muted : ink }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Banner({ kind, children, icon }: { kind: 'info' | 'warn' | 'danger'; children: ReactNode; icon?: IconName }) {
  const c = kind === 'danger' ? colors.red : kind === 'warn' ? colors.amber : colors.green;
  const ink = kind === 'danger' ? colors.redSoft : kind === 'warn' ? colors.amberSoft : colors.greenMint;
  const line = kind === 'danger' ? 'rgba(255,84,112,0.35)' : kind === 'warn' ? colors.amberLine : 'rgba(43,255,136,0.3)';
  return (
    <View accessibilityRole="alert" style={[s.banner, { borderColor: line }]}>
      <Icon name={icon ?? (kind === 'info' ? 'shieldCheck' : 'warn')} size={20} color={c} />
      <Text style={[s.bannerText, { color: ink }]}>{children}</Text>
    </View>
  );
}

export function Field(props: TextInputProps & { label?: string; right?: ReactNode; accent?: boolean }) {
  const { label, right, accent, ...rest } = props;
  return (
    <View style={{ gap: space.sm }}>
      {label ? <Label>{label}</Label> : null}
      <View style={[s.field, accent ? { borderColor: 'rgba(43,255,136,0.55)' } : null]}>
        <TextInput
          placeholderTextColor={colors.dim}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={colors.green}
          {...rest}
          style={[s.input, rest.multiline && { minHeight: 110, textAlignVertical: 'top' }, rest.style]}
        />
        {right}
      </View>
    </View>
  );
}

/** Controle segmentado em pílula (ex.: Seed / Chave privada). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ key: T; label: string }>;
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <View style={s.segmented}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            testID={`seg-${o.key}`}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[s.segment, on && { backgroundColor: colors.green }]}
          >
            <Text style={[s.segmentText, { color: on ? colors.greenInk : colors.muted, fontFamily: on ? fonts.bodyBold : fonts.bodySemi }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Moeda em círculo colorido (B laranja, S roxo...). */
export function CoinBadge({ letter, bg, ink = '#000', size = 40 }: { letter: string; bg: string; ink?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: size * 0.45, color: ink }}>{letter}</Text>
    </View>
  );
}

// ───────────────────────── PIN ─────────────────────────

export const PIN_LENGTH = 6;

export function PinDots({ length, error }: { length: number; error?: boolean }) {
  return (
    <View style={s.dots} accessibilityLabel={`${length} de ${PIN_LENGTH} dígitos`}>
      {Array.from({ length: PIN_LENGTH }, (_, i) => {
        const on = i < length;
        const c = error ? colors.red : colors.green;
        return <View key={i} style={[s.pinDot, on ? { backgroundColor: c, borderColor: c, ...glow(c, 0.8) } : { borderColor: 'rgba(255,255,255,0.3)' }]} />;
      })}
    </View>
  );
}

/** Teclado numérico próprio: sem teclado do sistema, sem autofill, sem histórico. */
export function PinPad({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: boolean }) {
  const press = (d: string) => value.length < PIN_LENGTH && onChange(value + d);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <View style={{ alignItems: 'center', gap: space.xl }}>
      <PinDots length={value.length} error={error} />
      <View style={s.pad}>
        {keys.map((k, i) =>
          k === '' ? (
            <View key={i} style={s.key} />
          ) : (
            <Pressable
              key={i}
              testID={k === '⌫' ? 'pin-back' : `pin-${k}`}
              accessibilityLabel={k === '⌫' ? 'apagar' : k}
              accessibilityRole="button"
              onPress={() => (k === '⌫' ? onChange(value.slice(0, -1)) : press(k))}
              style={({ pressed }) => [s.key, s.keyBtn, pressed && { backgroundColor: colors.greenFaint, borderColor: colors.greenLine }]}
            >
              {k === '⌫' ? <Icon name="backspace" size={26} color={colors.muted} stroke={1.7} /> : <Text style={s.keyText}>{k}</Text>}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

// ───────────────────────── Estilos ─────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, gap: 18 },
  footer: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 14, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 44 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: { flex: 1, flexDirection: 'row', gap: 6 },
  stepBar: { flex: 1, height: 3, borderRadius: 2 },
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, padding: 18, gap: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 30, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  btn: { minHeight: 56, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1 },
  bannerText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMid,
  },
  input: { flex: 1, color: colors.text, fontFamily: fonts.mono, fontSize: 15, paddingVertical: 12 },
  segmented: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segment: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 13 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 18, paddingVertical: 10 },
  pinDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  pad: { width: 276, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  key: { width: 76, height: 76 },
  keyBtn: { borderRadius: 38, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: fonts.displayMed, fontSize: 28, color: colors.text },
  tabbar: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabLabel: { fontFamily: fonts.bodySemi, fontSize: 11 },
});
