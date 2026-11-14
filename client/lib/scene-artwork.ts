import media from "../../assets/storage/scene-media-lock.json" with { type: "json" };
import { configuredArtworkBaseUrl, normalizeArtworkBaseUrl } from "./artwork-delivery.ts";

/** Scene exports have their own immutable release; other artwork keeps the app's pin. */
export function sceneArtworkBaseUrl(appBaseUrl = configuredArtworkBaseUrl()): string | undefined {
  try {
    return normalizeArtworkBaseUrl(appBaseUrl) ? media.baseUrl : undefined;
  } catch {
    return undefined;
  }
}
