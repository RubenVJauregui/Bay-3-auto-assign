import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: isGitHubPages ? "/Bay-3-auto-assign" : undefined,
  assetPrefix: isGitHubPages ? "/Bay-3-auto-assign/" : undefined,
};

export default nextConfig;
