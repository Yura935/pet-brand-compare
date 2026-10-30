export type Site = "petslike" | "pethouse";

export type CardStatus = "inStock" | "outOfStock" | "discontinued";

export type Level = "INFO" | "WARN" | "ERROR";

export type Issue = {
  level: "warn" | "error";
  status: string;
  url: string;
  detail: string;
  message: string;
};

export type JobPhase = "brands" | "lists" | "cards" | "file";

export type JobStatus = "idle" | "running" | "paused" | "done" | "error";

export type SiteCounts = {
  onSite: boolean;
  inStock: number;
  outOfStock: number;
  discontinued: number;
};

export type BrandRow = {
  key: string;
  title: string;
  petslikeName: string | null;
  pethouseName: string | null;
  petslike: SiteCounts;
  pethouse: SiteCounts;
};

export type AliasGroup = {
  names: string[];
  title: string;
};

export type Catalog = Record<Site, string[]>;

export type CardResult = {
  brand: string;
  status: CardStatus;
};

export type ReadText = (url: string) => Promise<string>;

export type Job = {
  status: JobStatus;
  phase: JobPhase;
  error: string | null;
  warning: string | null;
  percent: number;
  statusLine: string;
  skipped: number;
  processed: number;
  total: number;
  site: Site | null;
  rows: BrandRow[];
  urls: Record<Site, string[]> | null;
  next: Record<Site, number>;
  xlsxPath: string | null;
};

export type PublicSite = {
  inStock: number | "Null";
  outOfStock: number | "Null";
  discontinued: number | "Null";
};

export type PublicRow = {
  title: string;
  petslike: PublicSite;
  pethouse: PublicSite;
};

export type PublicJob = {
  status: JobStatus;
  percent: number;
  statusLine: string;
  error: string | null;
  warning: string | null;
  downloadEnabled: boolean;
  analyzeEnabled: boolean;
  continueMode: boolean;
  stopping: boolean;
  resetting: boolean;
  rows: PublicRow[];
  issues: Issue[];
};
