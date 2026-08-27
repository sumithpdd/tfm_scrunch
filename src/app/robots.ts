import type { MetadataRoute } from "next";
import { STAND_DESK_PATH } from "@/lib/stand-desk";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [STAND_DESK_PATH, "/api/admin/"],
    },
  };
}
