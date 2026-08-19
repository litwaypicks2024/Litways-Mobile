// Hermes's AOT compiler (hermesc) cannot parse dynamic import() of a
// non-literal — @supabase/supabase-js ships `import(OTEL_PKG)` for optional
// OpenTelemetry tracing, which breaks Android/iOS release bundling. This
// plugin rewrites any such call to Promise.resolve(null); supabase's own
// null-guard then simply runs with tracing disabled (correct for RN).
const stripNonLiteralDynamicImports = ({ types: t }) => ({
  name: 'strip-non-literal-dynamic-imports',
  visitor: {
    CallExpression(path) {
      if (
        path.node.callee.type === 'Import' &&
        path.node.arguments[0]?.type !== 'StringLiteral'
      ) {
        path.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
            [t.nullLiteral()]
          )
        );
      }
    },
  },
});

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [stripNonLiteralDynamicImports],
  };
};
