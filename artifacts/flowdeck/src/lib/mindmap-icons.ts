import { useEffect, useState } from "react";
import type { ComponentType } from "react";

export type IconComponent = ComponentType<{ className?: string }>;
export type IconModule = Record<string, IconComponent>;

let cache: IconModule | null = null;
let promise: Promise<IconModule> | null = null;

export function loadMindmapIcons(): Promise<IconModule> {
  if (cache) return Promise.resolve(cache);
  if (!promise) {
    promise = import("react-icons/fa6").then((mod) => {
      cache = mod as unknown as IconModule;
      return cache;
    });
  }
  return promise;
}

export function getLoadedIcon(
  name: string | null | undefined,
): IconComponent | null {
  if (!name || !cache) return null;
  const Icon = cache[name];
  return typeof Icon === "function" ? Icon : null;
}

export function useMindmapIcons(enabled: boolean): IconModule | null {
  const [mod, setMod] = useState<IconModule | null>(cache);
  useEffect(() => {
    if (!enabled || mod) return;
    let active = true;
    loadMindmapIcons().then((m) => {
      if (active) setMod(m);
    });
    return () => {
      active = false;
    };
  }, [enabled, mod]);
  return mod;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Portuguese search terms -> English keywords that appear in FontAwesome icon
// names. Keys are accent-stripped, lowercase. This powers best-effort PT search
// on top of the always-available English name matching.
const PT_SYNONYMS: Record<string, string[]> = {
  estrela: ["star"],
  favorito: ["star", "heart", "bookmark"],
  coracao: ["heart"],
  casa: ["house", "home"],
  inicio: ["house", "home"],
  usuario: ["user"],
  usuarios: ["users"],
  pessoa: ["user"],
  pessoas: ["users"],
  gente: ["users"],
  lixo: ["trash"],
  lixeira: ["trash", "trashcan"],
  excluir: ["trash"],
  apagar: ["trash", "eraser"],
  seta: ["arrow"],
  setas: ["arrow"],
  engrenagem: ["gear"],
  ajustes: ["gear", "sliders"],
  configuracao: ["gear"],
  configuracoes: ["gear", "sliders"],
  sino: ["bell"],
  notificacao: ["bell"],
  aviso: ["bell", "triangle"],
  calendario: ["calendar"],
  data: ["calendar"],
  relogio: ["clock"],
  hora: ["clock"],
  tempo: ["clock", "hourglass", "stopwatch"],
  cronometro: ["stopwatch"],
  grafico: ["chart", "graph"],
  graficos: ["chart"],
  pasta: ["folder"],
  arquivo: ["file"],
  arquivos: ["file"],
  documento: ["file", "fileLines"],
  lapis: ["pencil"],
  editar: ["pencil", "penToSquare"],
  caneta: ["pen"],
  camera: ["camera"],
  foto: ["camera", "image"],
  imagem: ["image"],
  imagens: ["images"],
  video: ["video", "film"],
  musica: ["music"],
  som: ["volume", "music"],
  telefone: ["phone"],
  celular: ["mobile"],
  email: ["envelope"],
  correio: ["envelope"],
  carta: ["envelope"],
  mensagem: ["message", "comment"],
  comentario: ["comment"],
  chat: ["comment", "message"],
  conversa: ["comments"],
  busca: ["magnifyingGlass", "search"],
  procurar: ["magnifyingGlass"],
  pesquisar: ["magnifyingGlass"],
  lupa: ["magnifyingGlass"],
  cadeado: ["lock"],
  bloqueado: ["lock"],
  seguranca: ["lock", "shield"],
  escudo: ["shield"],
  chave: ["key"],
  usuario_check: ["userCheck"],
  verificado: ["check", "circleCheck"],
  certo: ["check"],
  concluido: ["check", "circleCheck"],
  ok: ["check"],
  erro: ["xmark", "circleXmark"],
  fechar: ["xmark"],
  mais: ["plus"],
  adicionar: ["plus"],
  novo: ["plus"],
  menos: ["minus"],
  remover: ["minus", "trash"],
  coracaozinho: ["heart"],
  bandeira: ["flag"],
  marcador: ["bookmark", "locationDot"],
  local: ["locationDot", "mapPin"],
  localizacao: ["locationDot"],
  mapa: ["map"],
  lugar: ["locationDot"],
  dinheiro: ["moneyBill", "coins", "dollar"],
  pagamento: ["creditCard", "moneyBill"],
  cartao: ["creditCard"],
  compra: ["cartShopping", "bagShopping"],
  carrinho: ["cartShopping"],
  loja: ["store", "shop"],
  presente: ["gift"],
  fogo: ["fire"],
  raio: ["bolt"],
  energia: ["bolt", "plug"],
  luz: ["lightbulb"],
  ideia: ["lightbulb"],
  livro: ["book"],
  leitura: ["book", "bookOpen"],
  escola: ["school", "graduationCap"],
  formatura: ["graduationCap"],
  trabalho: ["briefcase"],
  maleta: ["briefcase"],
  empresa: ["building"],
  predio: ["building"],
  nuvem: ["cloud"],
  download: ["download"],
  baixar: ["download"],
  upload: ["upload"],
  enviar: ["upload", "paperPlane"],
  compartilhar: ["share", "shareNodes"],
  link: ["link"],
  corrente: ["link"],
  olho: ["eye"],
  ver: ["eye"],
  oculto: ["eyeSlash"],
  filtro: ["filter"],
  lista: ["list"],
  tabela: ["table"],
  grade: ["tableCells", "grid"],
  menu: ["bars"],
  play: ["play"],
  pausar: ["pause"],
  parar: ["stop"],
  carro: ["car"],
  aviao: ["plane"],
  onibus: ["bus"],
  bicicleta: ["bicycle"],
  cafe: ["mug", "coffee"],
  comida: ["utensils", "burger", "pizza"],
  restaurante: ["utensils"],
  bola: ["futbol", "basketball"],
  futebol: ["futbol"],
  jogo: ["gamepad", "dice"],
  troféu: ["trophy"],
  trofeu: ["trophy"],
  premio: ["trophy", "award", "medal"],
  medalha: ["medal"],
  polegar: ["thumbsUp"],
  curtir: ["thumbsUp"],
  gostei: ["thumbsUp"],
  robo: ["robot"],
  cerebro: ["brain"],
  saude: ["heartPulse", "kitMedical"],
  medico: ["userDoctor", "stethoscope"],
  planta: ["seedling", "leaf"],
  folha: ["leaf"],
  arvore: ["tree"],
  sol: ["sun"],
  lua: ["moon"],
  tema: ["sun", "moon"],
  bateria: ["battery"],
  wifi: ["wifi"],
  rede: ["networkWired", "wifi"],
  codigo: ["code"],
  terminal: ["terminal"],
  banco: ["database", "buildingColumns"],
  dados: ["database"],
  impressora: ["print"],
  imprimir: ["print"],
  copiar: ["copy"],
  colar: ["paste"],
  salvar: ["floppyDisk", "save"],
  disquete: ["floppyDisk"],
  candeeiro: ["lightbulb"],
};

interface IconEntry {
  name: string;
  search: string;
}

let indexCache: { mod: IconModule; entries: IconEntry[] } | null = null;

function buildIndex(mod: IconModule): IconEntry[] {
  if (indexCache && indexCache.mod === mod) return indexCache.entries;
  const entries: IconEntry[] = [];
  for (const name of Object.keys(mod)) {
    if (!name.startsWith("Fa")) continue;
    if (typeof mod[name] !== "function") continue;
    // "FaAddressBook" -> "addressbook"; drops the "Fa" prefix for matching.
    const search = name.slice(2).toLowerCase();
    entries.push({ name, search });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  indexCache = { mod, entries };
  return entries;
}

function candidateTerms(query: string): string[] {
  const qn = normalize(query);
  if (!qn) return [];
  const words = qn.split(/\s+/).filter(Boolean);
  const terms = new Set<string>();
  for (const word of words) {
    terms.add(word);
    const syn = PT_SYNONYMS[word];
    if (syn) for (const s of syn) terms.add(s.toLowerCase());
  }
  return [...terms];
}

export function getIconEntries(
  mod: IconModule,
): { name: string; search: string }[] {
  return buildIndex(mod);
}

export function searchIconNames(
  mod: IconModule,
  query: string,
  limit: number,
): string[] {
  const entries = buildIndex(mod);
  const terms = candidateTerms(query);
  if (terms.length === 0) {
    return entries.slice(0, limit).map((e) => e.name);
  }
  const results: string[] = [];
  for (const entry of entries) {
    if (terms.some((t) => entry.search.includes(t))) {
      results.push(entry.name);
      if (results.length >= limit) break;
    }
  }
  return results;
}

// Turn "FaAddressBook" into "Address Book" for tooltips.
export function humanizeIconName(name: string): string {
  return name
    .replace(/^Fa/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
}
