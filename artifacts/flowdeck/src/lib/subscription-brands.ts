import type { IconType } from "react-icons";
import {
  SiNetflix,
  SiSpotify,
  SiYoutube,
  SiYoutubemusic,
  SiAppletv,
  SiApplemusic,
  SiHbo,
  SiParamountplus,
  SiCrunchyroll,
  SiTidal,
  SiTwitch,
  SiDiscord,
  SiSteam,
  SiPlaystation,
  SiGoogle,
  SiGoogledrive,
  SiIcloud,
  SiApple,
  SiNotion,
  SiFigma,
  SiGithub,
  SiOpenai,
  SiClaude,
  SiPerplexity,
  SiCanva,
  SiDropbox,
  SiMailchimp,
  SiDashlane,
  SiLastpass,
  SiWordpress,
  SiVivo,
  SiCloudflare,
  SiDigitalocean,
  SiHostinger,
  SiVercel,
  SiHeroku,
  SiRender,
  SiRailway,
  SiSupabase,
  SiPlanetscale,
  SiMongodb,
  SiRedis,
  SiOvh,
  SiGodaddy,
  SiNamecheap,
} from "react-icons/si";
export type SubscriptionCategory =
  | "streaming"
  | "technology"
  | "telecom"
  | "hosting"
  | "domain"
  | "other";

export interface BrandDef {
  slug: string;
  name: string;
  category: SubscriptionCategory;
  color: string;
  icon?: IconType;
}

export const SUBSCRIPTION_BRANDS: BrandDef[] = [
  // Streaming
  { slug: "netflix", name: "Netflix", category: "streaming", color: "#E50914", icon: SiNetflix },
  { slug: "spotify", name: "Spotify", category: "streaming", color: "#1DB954", icon: SiSpotify },
  { slug: "youtube-premium", name: "YouTube Premium", category: "streaming", color: "#FF0000", icon: SiYoutube },
  { slug: "youtube-music", name: "YouTube Music", category: "streaming", color: "#FF0000", icon: SiYoutubemusic },
  { slug: "apple-tv", name: "Apple TV+", category: "streaming", color: "#000000", icon: SiAppletv },
  { slug: "apple-music", name: "Apple Music", category: "streaming", color: "#FA243C", icon: SiApplemusic },
  { slug: "disney-plus", name: "Disney+", category: "streaming", color: "#113CCF" },
  { slug: "prime-video", name: "Prime Video", category: "streaming", color: "#00A8E1" },
  { slug: "hbo-max", name: "Max (HBO)", category: "streaming", color: "#7B2BF9", icon: SiHbo },
  { slug: "paramount-plus", name: "Paramount+", category: "streaming", color: "#0064FF", icon: SiParamountplus },
  { slug: "crunchyroll", name: "Crunchyroll", category: "streaming", color: "#F47521", icon: SiCrunchyroll },
  { slug: "tidal", name: "Tidal", category: "streaming", color: "#000000", icon: SiTidal },
  { slug: "deezer", name: "Deezer", category: "streaming", color: "#A238FF" },
  { slug: "twitch", name: "Twitch", category: "streaming", color: "#9146FF", icon: SiTwitch },
  { slug: "discord-nitro", name: "Discord Nitro", category: "streaming", color: "#5865F2", icon: SiDiscord },
  { slug: "playstation-plus", name: "PlayStation Plus", category: "streaming", color: "#0070D1", icon: SiPlaystation },
  { slug: "steam", name: "Steam", category: "streaming", color: "#1B2838", icon: SiSteam },

  // Tecnologia
  { slug: "google-one", name: "Google One", category: "technology", color: "#4285F4", icon: SiGoogle },
  { slug: "google-workspace", name: "Google Workspace", category: "technology", color: "#4285F4", icon: SiGoogledrive },
  { slug: "icloud", name: "iCloud+", category: "technology", color: "#3693F3", icon: SiIcloud },
  { slug: "apple-one", name: "Apple One", category: "technology", color: "#000000", icon: SiApple },
  { slug: "microsoft-365", name: "Microsoft 365", category: "technology", color: "#D83B01" },
  { slug: "adobe-cc", name: "Adobe Creative Cloud", category: "technology", color: "#FF0000" },
  { slug: "notion", name: "Notion", category: "technology", color: "#000000", icon: SiNotion },
  { slug: "figma", name: "Figma", category: "technology", color: "#F24E1E", icon: SiFigma },
  { slug: "github", name: "GitHub", category: "technology", color: "#181717", icon: SiGithub },
  { slug: "openai", name: "ChatGPT (OpenAI)", category: "technology", color: "#000000", icon: SiOpenai },
  { slug: "anthropic", name: "Claude (Anthropic)", category: "technology", color: "#D97757", icon: SiClaude },
  { slug: "perplexity", name: "Perplexity", category: "technology", color: "#1FB8CD", icon: SiPerplexity },
  { slug: "canva", name: "Canva", category: "technology", color: "#00C4CC", icon: SiCanva },
  { slug: "dropbox", name: "Dropbox", category: "technology", color: "#0061FF", icon: SiDropbox },
  { slug: "mailchimp", name: "Mailchimp", category: "technology", color: "#FFB800", icon: SiMailchimp },
  { slug: "dashlane", name: "Dashlane", category: "technology", color: "#0E353D", icon: SiDashlane },
  { slug: "lastpass", name: "LastPass", category: "technology", color: "#D32D27", icon: SiLastpass },
  { slug: "wordpress", name: "WordPress", category: "technology", color: "#21759B", icon: SiWordpress },

  // Telecom
  { slug: "vivo", name: "Vivo", category: "telecom", color: "#660099", icon: SiVivo },
  { slug: "claro", name: "Claro", category: "telecom", color: "#DA291C" },
  { slug: "tim", name: "TIM", category: "telecom", color: "#004691" },
  { slug: "oi", name: "Oi", category: "telecom", color: "#5A2D81" },

  // Hospedagem / VPS
  { slug: "cloudflare", name: "Cloudflare", category: "hosting", color: "#F38020", icon: SiCloudflare },
  { slug: "digitalocean", name: "DigitalOcean", category: "hosting", color: "#0080FF", icon: SiDigitalocean },
  { slug: "hostinger", name: "Hostinger", category: "hosting", color: "#673DE6", icon: SiHostinger },
  { slug: "vercel", name: "Vercel", category: "hosting", color: "#000000", icon: SiVercel },
  { slug: "aws", name: "Amazon Web Services", category: "hosting", color: "#FF9900" },
  { slug: "heroku", name: "Heroku", category: "hosting", color: "#430098", icon: SiHeroku },
  { slug: "render", name: "Render", category: "hosting", color: "#000000", icon: SiRender },
  { slug: "railway", name: "Railway", category: "hosting", color: "#0B0D0E", icon: SiRailway },
  { slug: "supabase", name: "Supabase", category: "hosting", color: "#3FCF8E", icon: SiSupabase },
  { slug: "planetscale", name: "PlanetScale", category: "hosting", color: "#000000", icon: SiPlanetscale },
  { slug: "mongodb", name: "MongoDB Atlas", category: "hosting", color: "#47A248", icon: SiMongodb },
  { slug: "redis", name: "Redis Cloud", category: "hosting", color: "#FF4438", icon: SiRedis },
  { slug: "ovh", name: "OVHcloud", category: "hosting", color: "#123F6D", icon: SiOvh },

  // Domínios
  { slug: "godaddy", name: "GoDaddy", category: "domain", color: "#1BDBDB", icon: SiGodaddy },
  { slug: "namecheap", name: "Namecheap", category: "domain", color: "#DE3723", icon: SiNamecheap },
];

export const BRAND_BY_SLUG: Record<string, BrandDef> = Object.fromEntries(
  SUBSCRIPTION_BRANDS.map((b) => [b.slug, b]),
);

export const CATEGORY_LABELS: Record<SubscriptionCategory, string> = {
  streaming: "Streaming",
  technology: "Tecnologia",
  telecom: "Telecom",
  hosting: "Hospedagem/VPS",
  domain: "Domínios",
  other: "Outros",
};

export const CATEGORY_ORDER: SubscriptionCategory[] = [
  "streaming",
  "technology",
  "telecom",
  "hosting",
  "domain",
  "other",
];

export const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: "Mensal",
  yearly: "Anual",
  weekly: "Semanal",
  quarterly: "Trimestral",
  custom: "Personalizado",
};

const DEFAULT_CUSTOM_COLOR = "#6366F1";

export interface BrandDisplay {
  name: string;
  color: string;
  icon?: IconType;
}

export function brandDisplay(sub: {
  companySlug?: string | null;
  customName?: string | null;
  customColor?: string | null;
}): BrandDisplay {
  if (sub.companySlug && BRAND_BY_SLUG[sub.companySlug]) {
    const b = BRAND_BY_SLUG[sub.companySlug];
    return { name: b.name, color: b.color, icon: b.icon };
  }
  return {
    name: sub.customName || sub.companySlug || "Assinatura",
    color: sub.customColor || DEFAULT_CUSTOM_COLOR,
    icon: undefined,
  };
}
