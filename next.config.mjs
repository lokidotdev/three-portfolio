const nextConfig = {
  turbopack: {
    rules: {
      '*.{glsl,vert,frag,vs,fs}': {
        // Loaders run right-to-left: glslify-loader resolves #pragma glslify
        // includes and emits raw GLSL, then raw-loader wraps that string into
        // a JS module (`export default "<shader source>"`).
        loaders: ['raw-loader', 'glslify-loader'],
        as: '*.js',
      },
    },
  },
  webpack(config) {
    // Fallback for `next build --webpack` and other webpack-based tooling.
    config.module.rules.push({
      test: /\.(glsl|vert|frag|vs|fs)$/,
      use: ['raw-loader', 'glslify-loader'],
    })
    return config
  },
}
export default nextConfig
