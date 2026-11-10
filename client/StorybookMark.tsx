export interface StorybookMarkProps {
  size?: number;
  className?: string;
}

/** Original Everfolk device: an open book beneath a small guiding star. */
export default function StorybookMark({ size = 32, className = "" }: StorybookMarkProps) {
  return <svg className={`storybook-mark ${className}`.trim()} width={size} height={size} viewBox="0 0 40 40" fill="none" color="#24464b" aria-hidden="true" focusable="false">
    <path d="M20 3 22.1 8.9 28 11l-5.9 2.1L20 19l-2.1-5.9L12 11l5.9-2.1L20 3Z" fill="#b58a49" />
    <path d="m8 9 1.6 1.6M32 9l-1.6 1.6M20 0v1" stroke="#b58a49" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M5 20c5-1.5 10-.3 15 3.2 5-3.5 10-4.7 15-3.2v14c-5-1.5-10-.3-15 3.2C15 33.7 10 32.5 5 34V20Z" fill="#fbf3df" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M20 23.2v14M9 24c2.8 0 5.2.8 7.5 2.1M9 28c2.8 0 5.2.8 7.5 2.1M31 24c-2.8 0-5.2.8-7.5 2.1M31 28c-2.8 0-5.2.8-7.5 2.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    <path d="M17.3 22v9.8l1.4-.8 1.3 2V23.2L17.3 22Z" fill="#98584b" />
  </svg>;
}
