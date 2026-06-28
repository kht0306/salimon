import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: [
    "@salimon/api-client",
    "@salimon/domain",
    "@salimon/store",
    "@salimon/types",
    "@salimon/ui-tokens",
  ],
}

export default nextConfig
