import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    // Removed unused src directory to speed up scanning
  ],
  // Performance: Only enable hover effects on devices that support hover
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#113A7A',
          pink: '#FFA6C3',
          yellow: '#FFDD57',
          navy: '#0F2E66',
        },
      },
      spacing: {
        15: '3.75rem',
        18: '4.5rem',
        22: '5.5rem',
      },
      fontFamily: {
        // Outfit for CTAs and headings (using CSS variable from next/font)
        outfit: ['var(--font-outfit)', 'Outfit', '"PingFang TC"', 'system-ui', 'sans-serif'],
        // Display font for hero sections
        display: ['var(--font-outfit)', 'Outfit', '"PingFang TC"', 'system-ui', 'sans-serif'],
        // Body text with Chinese font support
        body: ['"PingFang TC"', 'system-ui', 'sans-serif'],
        // Chinese font
        chinese: ['"PingFang TC"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        wider: '0.1em',
        widest: '0.15em',
      },
      transitionDuration: {
        '600': '600ms',
      },
    },
  },
  plugins: [],
}
export default config
