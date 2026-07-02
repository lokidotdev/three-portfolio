const nextConfig = {
  webpack(config) {
    config.module.rules.push({
      test: /\.(glsl|vert|frag|vs|fs)$/,
      type: 'asset/source',        // built into webpack 5, replaces raw-loader
      use: ['glslify-loader'],     // ONLY if you use #pragma glslify imports
    })
    return config
  },
}
export default nextConfig
