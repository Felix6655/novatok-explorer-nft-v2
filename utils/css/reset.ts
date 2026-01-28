// utils/css/reset.ts
export const reset = {
  '*, *::before, *::after': { boxSizing: 'border-box' },
  'html, body': { padding: 0, margin: 0 },
  body: { lineHeight: 1.5 },
  'img, picture, video, canvas, svg': { display: 'block', maxWidth: '100%' },
  'input, button, textarea, select': { font: 'inherit' },
};
