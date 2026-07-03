const nextConfig = {
  turbopack: {
    rules: {
      '*.{glsl,vert,frag,vs,fs}': {
        loaders: ['glslify-loader'], // resolves #include / #pragma glslify imports
        type: 'raw',                 // export the shader source as a string
      },
    },
  },
  webpack(config) {
    // Fallback for `next build --webpack` and other webpack-based tooling.
    config.module.rules.push({
      test: /\.(glsl|vert|frag|vs|fs)$/,
      type: 'asset/source',        // built into webpack 5, replaces raw-loader
      use: ['glslify-loader'],     // ONLY if you use #pragma glslify imports
    })
    return config
  },
}
export default nextConfig
