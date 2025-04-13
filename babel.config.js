module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Para suporte a recursos como async/await
      ["@babel/plugin-transform-runtime", {
        helpers: true,
        regenerator: true
      }],
      // Para resolver aliases de importação
      ["module-resolver", {
        root: ['./src'],
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        alias: {
          '@': './src',
          '@components': './src/components',
          '@screens': './src/screens',
          '@services': './src/services',
          '@utils': './src/utils',
          '@navigation': './src/navigation'
        }
      }]
    ],
    // Otimizações para produção
    env: {
      production: {
        plugins: ['transform-remove-console']
      }
    }
  };
}; 