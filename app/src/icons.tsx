import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Ícones de traço do canvas de design (viewBox 24, traço arredondado). */
const PATHS = {
  back: ['M15 5l-7 7 7 7'],
  send: ['M7 17L17 7M8 7h9v9'],
  receive: ['M17 7L7 17M16 17H7V8'],
  swap: ['M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7'],
  plus: ['M12 5v14M5 12h14'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
  shieldCheck: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
  home: ['M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z'],
  chart: ['M4 19V5M4 19h16M8 15l3-4 3 2 5-7'],
  bolt: ['M13 3L5 14h6l-1 7 8-11h-6z'],
  list: ['M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'],
  bell: ['M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4'],
  qr: ['M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16'],
  check: ['M5 12.5l5 5 9-10.5'],
  warn: ['M12 4l9 16H3z', 'M12 10v4M12 17h.01'],
  backspace: ['M21 5H9l-6 7 6 7h12z', 'M13 9l4 6M17 9l-4 6'],
  pencil: ['M4 20l1-5L16 4l4 4L9 19z'],
  noCamera: ['M3 3l18 18M4 8h3l2-3h6l2 3h3v11H8M10 13a3 3 0 004 3'],
  lock: ['M8 11V8a4 4 0 018 0v3'],
  flame: ['M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 2 1 2 0-3-1-5 2-8z'],
  arrowUp: ['M12 4l9 15H3z'],
  chevron: ['M9 5l7 7-7 7'],
  refresh: ['M20 11a8 8 0 10-2.3 5.7M20 4v7h-7'],
} as const;

export type IconName = keyof typeof PATHS | 'copy' | 'sliders' | 'lockClosed' | 'wallet';

export function Icon({ name, size = 22, color = '#F2F4F3', stroke = 1.8 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const common = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {name === 'copy' ? (
        <>
          <Rect x={9} y={9} width={11} height={11} rx={2} {...common} />
          <Path d="M5 15V6a2 2 0 012-2h9" {...common} />
        </>
      ) : name === 'sliders' ? (
        <>
          <Path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...common} />
          <Circle cx={16} cy={7} r={2} {...common} />
          <Circle cx={8} cy={17} r={2} {...common} />
        </>
      ) : name === 'lockClosed' ? (
        <>
          <Rect x={5} y={11} width={14} height={10} rx={2} {...common} />
          <Path d="M8 11V8a4 4 0 018 0v3" {...common} />
        </>
      ) : name === 'wallet' ? (
        <>
          <Rect x={3} y={6} width={18} height={14} rx={3} {...common} />
          <Path d="M3 10h18M16 15h2" {...common} />
        </>
      ) : (
        PATHS[name].map((d, i) => <Path key={i} d={d} {...common} />)
      )}
    </Svg>
  );
}
