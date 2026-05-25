import forms from '@tailwindcss/forms';

export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary Colors
        'primary': '#001a0f',
        'on-primary': '#ffffff',
        'primary-container': '#003120',
        'on-primary-container': '#669c82',
        'primary-fixed': '#b5efd1',
        'primary-fixed-dim': '#9ad3b5',
        'on-primary-fixed': '#002114',
        'on-primary-fixed-variant': '#17503a',

        // Secondary Colors
        'secondary': '#426656',
        'on-secondary': '#ffffff',
        'secondary-container': '#c1e9d5',
        'on-secondary-container': '#466a5a',
        'secondary-fixed': '#c4ebd7',
        'secondary-fixed-dim': '#a9cfbc',
        'on-secondary-fixed': '#002115',
        'on-secondary-fixed-variant': '#2b4d3f',

        // Tertiary Colors
        'tertiary': '#001a0e',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#00311d',
        'on-tertiary-container': '#2ba471',
        'tertiary-fixed': '#88f8be',
        'tertiary-fixed-dim': '#6bdba4',
        'on-tertiary-fixed': '#002112',
        'on-tertiary-fixed-variant': '#005234',

        // Error Colors
        'error': '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',

        // Neutral Colors
        'background': '#f2fcf8',
        'on-background': '#141d1b',
        'surface': '#f2fcf8',
        'on-surface': '#141d1b',
        'surface-variant': '#dbe5e1',
        'on-surface-variant': '#414844',
        'surface-dim': '#d2dcd8',
        'surface-bright': '#f2fcf8',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#ecf6f2',
        'surface-container': '#e6f0ec',
        'surface-container-high': '#e0eae6',
        'surface-container-highest': '#dbe5e1',
        'surface-tint': '#326851',

        // Outline Colors
        'outline': '#717974',
        'outline-variant': '#c1c8c3',

        // Inverse Colors
        'inverse-surface': '#293230',
        'inverse-on-surface': '#e9f3ef',
        'inverse-primary': '#9ad3b5',
      },
      fontFamily: {
        'headline': ['Plus Jakarta Sans', 'sans-serif'],
        'display': ['Plus Jakarta Sans', 'sans-serif'],
        'body': ['Inter', 'sans-serif'],
        'label': ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'DEFAULT': '0.25rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
      },
      fontSize: {
        'label-md': ['0.75rem', { lineHeight: '1.25rem', fontWeight: '500' }],
        'label-lg': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
        'body-md': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        'body-lg': ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        'title-lg': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'title-md': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
      },
    },
  },
  plugins: [
    forms,
  ],
};
