const theme = {
  colors: {
    background: { primary: '#FFFDF8', secondary: '#FFF8EE', surface: '#FFFFFF', surfaceWarm: '#FFF9F1' },
    text: { primary: '#171717', secondary: '#5F6368', muted: '#8A8F98', inverse: '#FFFFFF' },
    spectrum: { red: '#E53935', coral: '#FF6B5A', orange: '#FF8A00', amber: '#FFB300', yellow: '#FFD84D', lime: '#B7D94C', green: '#36B37E', teal: '#19B5A5', cyan: '#31B7D7', blue: '#4A90E2', indigo: '#5967D9', purple: '#8E63CE', violet: '#A855F7', pink: '#E95A9B', magenta: '#D9468C' },
    line: '#E9E4DA', overlay: 'rgba(255, 253, 248, 0.94)', focus: 'rgba(255, 107, 90, 0.18)', dangerSoft: '#FFF0EE', successSoft: '#EAF8F1', warningSoft: '#FFF5D9', violetSoft: '#F3ECFC', blueSoft: '#EAF5FC'
  },
  gradients: { sunset: 'linear-gradient(135deg, #FF6B5A 0%, #FFB300 100%)', creative: 'linear-gradient(135deg, #E95A9B 0%, #8E63CE 100%)', ocean: 'linear-gradient(135deg, #31B7D7 0%, #5967D9 100%)', fresh: 'linear-gradient(135deg, #B7D94C 0%, #36B37E 100%)', spectrum: 'linear-gradient(135deg, #FF6B5A 0%, #FFB300 25%, #36B37E 50%, #31B7D7 75%, #8E63CE 100%)' },
  fonts: { primary: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif" },
  fontSizes: { xs: '0.72rem', sm: '0.84rem', md: '1rem', lg: '1.12rem', xl: '1.35rem', xxl: '2.25rem', display: 'clamp(3.5rem, 8vw, 7.7rem)' },
  fontWeights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeights: { tight: 0.95, snug: 1.15, normal: 1.5, relaxed: 1.72 },
  borderRadius: { small: '10px', medium: '14px', large: '20px', xl: '28px', pill: '999px' },
  shadows: { paper: '0 4px 12px rgba(25,25,25,.06)', card: '0 8px 24px rgba(25,25,25,.08)', elevated: '0 14px 40px rgba(25,25,25,.10)', floating: '0 20px 50px rgba(25,25,25,.12)', accent: '0 6px 0 rgba(209,67,48,.16)' },
  paperEffects: { fold: 'linear-gradient(135deg, rgba(255,255,255,.78) 0 50%, rgba(255,255,255,0) 51%)', grain: 'radial-gradient(rgba(23,23,23,.035) .65px, transparent .7px)', grainSize: '5px 5px', imageFrame: 'inset 0 0 0 6px rgba(255,255,255,.6)' },
  spacing: { xxs: '4px', xs: '8px', sm: '12px', md: '16px', lg: '24px', xl: '32px', xxl: '48px', section: '96px' },
  transitions: { fast: '150ms ease', normal: '240ms ease', slow: '450ms cubic-bezier(.2,.8,.2,1)' },
  buttonStyles: { radius: '14px', padding: '14px 20px', lift: '-3px' },
  cardStyles: { radius: '20px', padding: '18px', border: '1px solid rgba(23,23,23,.055)' },
  inputStyles: { radius: '14px', padding: '14px 16px', border: '1px solid #E4DFD5' },
  badgeStyles: { radius: '999px', padding: '7px 12px', letterSpacing: '.07em' }
}

const flatten = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) => {
  const name = prefix ? `${prefix}-${key}` : key
  return value && typeof value === 'object' ? flatten(value, name) : [[name.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`), value], [name, value]]
})

export function applyTheme(root = document.documentElement) {
  flatten(theme).forEach(([name, value]) => root.style.setProperty(`--${name}`, value))
}

export default theme
