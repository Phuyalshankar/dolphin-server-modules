/**
 * jest-esm-strip-transform.cjs
 *
 * Jest transform जसले scripts/ मा रहेका .js files को
 * top-level  `export { ... };`  line strip गर्छ र
 * ts-jest लाई pass गर्छ।
 *
 * यसले client.cjs manually बनाउनु पर्दैन।
 */

const tsJestModule = require('ts-jest');

// Safe extraction of createTransformer from ts-jest
const createTransformer = tsJestModule.createTransformer || tsJestModule.default?.createTransformer;

const tsJest = createTransformer({ tsconfig: { allowJs: true, checkJs: false } });

module.exports = {
  process(sourceText, sourcePath, options) {
    // Strip bare ESM export lines, e.g.: export { Foo, Bar };
    const stripped = sourceText.replace(/export\s*\{[\s\S]*?\};?/g, '');
    return tsJest.process(stripped, sourcePath, options);
  },
};
