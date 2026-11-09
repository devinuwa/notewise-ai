import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ["", "/about", "/guide", "/privacy"].map((path) => ({
    url: `${SITE_URL}${path || "/"}`,
    lastModified,
    changeFrequency: path === "" || path === "/about" ? "weekly" : "monthly",
    priority: path === "" || path === "/about" ? 1 : 0.7,
  }));
}
