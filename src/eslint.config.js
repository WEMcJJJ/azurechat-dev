const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "build/**", "dist/**", "*.min.js"]
  },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // Disable some noisy rules for development
      "no-unused-vars": "warn",
      "prefer-const": "warn", 
      "no-console": "off", // Allow console.log in development
      "react/no-unescaped-entities": "error", // Keep this as an error
      "react-hooks/rules-of-hooks": "error", // Keep this as an error
    }
  }
];
