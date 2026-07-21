import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Ban } from "lucide-react";
import {
  useMindmapIcons,
  getIconEntries,
  searchIconNames,
  humanizeIconName,
} from "@/lib/mindmap-icons";

const RESULT_LIMIT = 300;

const POPULAR = [
  "FaStar", "FaHeart", "FaHouse", "FaUser", "FaUsers", "FaGear", "FaBell",
  "FaCalendar", "FaClock", "FaCheck", "FaXmark", "FaPlus", "FaMinus",
  "FaMagnifyingGlass", "FaFolder", "FaFile", "FaEnvelope", "FaComment",
  "FaPhone", "FaLocationDot", "FaMap", "FaFlag", "FaBookmark", "FaFire",
  "FaBolt", "FaLightbulb", "FaBook", "FaBriefcase", "FaBuilding", "FaCloud",
  "FaDownload", "FaUpload", "FaLink", "FaEye", "FaFilter", "FaList", "FaTable",
  "FaPlay", "FaPause", "FaTrash", "FaPen", "FaImage", "FaVideo", "FaMusic",
  "FaCartShopping", "FaCreditCard", "FaMoneyBill", "FaGift", "FaThumbsUp",
  "FaTrophy", "FaRocket", "FaGlobe", "FaLock", "FaShield", "FaChartSimple",
  "FaCircleCheck", "FaTriangleExclamation", "FaCircleInfo", "FaTag",
  "FaClipboard", "FaChartLine",
];

interface IconGroup {
  id: string;
  label: string;
  keywords?: string[];
}

const GROUPS: IconGroup[] = [
  { id: "todos", label: "Todos" },
  { id: "populares", label: "Populares" },
  {
    id: "setas",
    label: "Setas",
    keywords: ["arrow", "chevron", "caret", "angle", "rotate", "retweet",
      "shuffle", "reply", "turn", "sort", "exchange", "repeat"],
  },
  {
    id: "comunicacao",
    label: "Comunicação",
    keywords: ["envelope", "comment", "message", "phone", "bell", "inbox",
      "paperplane", "address", "bullhorn", "rss", "signal", "at"],
  },
  {
    id: "midia",
    label: "Mídia",
    keywords: ["play", "pause", "stop", "music", "video", "film", "image",
      "camera", "photo", "volume", "microphone", "podcast", "headphones",
      "guitar", "drum", "clapperboard", "record"],
  },
  {
    id: "arquivos",
    label: "Arquivos",
    keywords: ["file", "folder", "clipboard", "copy", "paste", "floppy",
      "book", "note", "page", "archive", "print", "box"],
  },
  {
    id: "comercio",
    label: "Comércio",
    keywords: ["cart", "bag", "store", "shop", "credit", "money", "dollar",
      "coin", "coins", "tag", "receipt", "gift", "wallet", "basket", "cash",
      "sack", "barcode", "percent"],
  },
  {
    id: "dados",
    label: "Dados",
    keywords: ["chart", "graph", "table", "diagram", "database", "list",
      "sitemap", "bars", "gauge", "meter"],
  },
  {
    id: "pessoas",
    label: "Pessoas",
    keywords: ["user", "person", "people", "child", "baby", "face", "group",
      "id"],
  },
  {
    id: "tempo",
    label: "Tempo",
    keywords: ["clock", "calendar", "hourglass", "stopwatch", "watch",
      "timer", "history", "alarm"],
  },
  {
    id: "natureza",
    label: "Natureza",
    keywords: ["sun", "moon", "cloud", "snow", "wind", "tree", "leaf",
      "seedling", "fire", "water", "droplet", "mountain", "umbrella",
      "rainbow", "flower", "paw", "dog", "cat", "fish", "frog", "bug",
      "spider", "feather", "earth", "temperature", "tornado", "volcano"],
  },
  {
    id: "mapas",
    label: "Mapas",
    keywords: ["map", "location", "pin", "compass", "globe", "road", "signs",
      "flag", "route", "street", "city", "marker"],
  },
  {
    id: "tecnologia",
    label: "Tecnologia",
    keywords: ["mobile", "desktop", "laptop", "computer", "tablet", "keyboard",
      "mouse", "plug", "battery", "wifi", "server", "microchip", "code",
      "terminal", "robot", "drive", "memory", "network", "ethernet",
      "bluetooth", "usb", "gamepad", "sim"],
  },
  {
    id: "saude",
    label: "Saúde",
    keywords: ["heart", "pulse", "hospital", "kit", "pill", "pills", "capsule",
      "syringe", "stethoscope", "tooth", "brain", "virus", "bacteria",
      "bandage", "aid", "prescription", "dna", "wheelchair", "crutch",
      "medical", "lungs"],
  },
  {
    id: "comida",
    label: "Comida",
    keywords: ["utensils", "burger", "pizza", "mug", "coffee", "bowl", "bread",
      "apple", "carrot", "wine", "beer", "cake", "cheese", "egg", "drumstick",
      "hotdog", "cream", "candy", "cookie", "lemon", "pepper", "shrimp",
      "bacon", "bottle", "martini", "whiskey", "champagne"],
  },
  {
    id: "transporte",
    label: "Transporte",
    keywords: ["car", "bus", "truck", "plane", "train", "bicycle",
      "motorcycle", "ship", "taxi", "rocket", "tram", "subway", "van",
      "sleigh", "helicopter", "boat", "ferry", "gas", "traffic"],
  },
  {
    id: "marcas",
    label: "Marcas",
    keywords: ["youtube", "facebook", "instagram", "twitter", "tiktok",
      "linkedin", "github", "gitlab", "google", "apple", "microsoft",
      "windows", "android", "whatsapp", "telegram", "discord", "slack",
      "spotify", "amazon", "paypal", "stripe", "visa", "mastercard", "figma",
      "dribbble", "behance", "pinterest", "reddit", "snapchat", "twitch",
      "vimeo", "wordpress", "shopify", "npm", "node", "react", "vuejs",
      "angular", "python", "java", "php", "docker", "aws", "dropbox",
      "chrome", "firefox", "safari", "edge", "steam", "playstation", "xbox",
      "unity", "medium", "patreon", "meta", "threads", "mastodon", "ebay",
      "etsy"],
  },
  {
    id: "simbolos",
    label: "Símbolos",
    keywords: ["circle", "square", "star", "check", "xmark", "plus", "minus",
      "shapes", "triangle", "hexagon", "diamond", "asterisk", "hashtag",
      "question", "exclamation", "info", "ban", "certificate", "award",
      "medal", "ribbon", "crown", "gem", "bolt"],
  },
];

interface MindmapIconPickerProps {
  value: string | null;
  onChange: (name: string | null) => void;
}

export function MindmapIconPicker({ value, onChange }: MindmapIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("populares");
  const mod = useMindmapIcons(open || !!value);

  const entries = useMemo(() => (mod ? getIconEntries(mod) : []), [mod]);

  const { names, truncated } = useMemo(() => {
    if (!mod) return { names: [] as string[], truncated: false };
    const q = query.trim();
    if (q) {
      const matched = searchIconNames(mod, q, RESULT_LIMIT + 1);
      return {
        names: matched.slice(0, RESULT_LIMIT),
        truncated: matched.length > RESULT_LIMIT,
      };
    }
    if (group === "populares") {
      const list = POPULAR.filter((n) => typeof mod[n] === "function");
      return { names: list, truncated: false };
    }
    if (group === "todos") {
      return {
        names: entries.slice(0, RESULT_LIMIT).map((e) => e.name),
        truncated: entries.length > RESULT_LIMIT,
      };
    }
    const g = GROUPS.find((x) => x.id === group);
    const kws = g?.keywords ?? [];
    const matched = entries.filter((e) =>
      kws.some((k) => e.search.includes(k)),
    );
    return {
      names: matched.slice(0, RESULT_LIMIT).map((e) => e.name),
      truncated: matched.length > RESULT_LIMIT,
    };
  }, [mod, query, group, entries]);

  const Preview = value && mod ? mod[value] : null;

  const selectGroup = (id: string) => {
    setGroup(id);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-44 justify-start gap-2 font-normal"
        >
          {Preview ? (
            <Preview className="h-4 w-4 shrink-0" />
          ) : (
            <Ban className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">
            {value ? humanizeIconName(value) : "Escolher ícone"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ícone (ex: estrela, star)"
          className="mb-2 h-8"
        />
        <div className="custom-scrollbar mb-2 flex gap-1 overflow-x-auto pb-1">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => selectGroup(g.id)}
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                !query.trim() && group === g.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          className="mb-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          <Ban className="h-4 w-4" />
          Sem ícone
        </button>
        <div className="custom-scrollbar max-h-60 overflow-y-auto">
          {!mod ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              Carregando ícones...
            </div>
          ) : names.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              Nenhum ícone encontrado
            </div>
          ) : (
            <>
              <div className="grid grid-cols-6 gap-1">
                {names.map((name) => {
                  const Icon = mod[name];
                  if (typeof Icon !== "function") return null;
                  const selected = name === value;
                  return (
                    <button
                      key={name}
                      type="button"
                      title={humanizeIconName(name)}
                      aria-label={humanizeIconName(name)}
                      onClick={() => {
                        onChange(name);
                        setOpen(false);
                      }}
                      className={`flex h-9 items-center justify-center rounded-md hover:bg-muted ${
                        selected
                          ? "bg-primary/10 text-primary ring-1 ring-primary"
                          : ""
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
              {truncated && (
                <p className="px-2 pt-2 text-center text-xs text-muted-foreground">
                  Refine a busca ou escolha uma categoria para ver mais.
                </p>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
