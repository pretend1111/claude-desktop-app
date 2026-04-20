declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.gif';
declare module '*.webp';
declare module '*.lottie';
declare module '*?raw' {
  const content: string;
  export default content;
}

// Injected by vite.config.ts define — value is package.json version at build time
declare const __APP_VERSION__: string;
