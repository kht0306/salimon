import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(import.meta.dirname, "../.."),
  },
  transpilePackages: [
    "@salimon/api-client",
    "@salimon/domain",
    "@salimon/store",
    "@salimon/types",
    "@salimon/ui-tokens",
  ],
}

export default nextConfig
