export type OwaspTop10Category =
  | "A01:2021-Broken Access Control"
  | "A02:2021-Cryptographic Failures"
  | "A03:2021-Injection"
  | "A04:2021-Insecure Design"
  | "A05:2021-Security Misconfiguration"
  | "A06:2021-Vulnerable and Outdated Components"
  | "A07:2021-Identification and Authentication Failures"
  | "A08:2021-Software and Data Integrity Failures"
  | "A09:2021-Security Logging and Monitoring Failures"
  | "A10:2021-Server-Side Request Forgery (SSRF)";

export const CWE_OWASP_MAP: Record<number, OwaspTop10Category> = {
  16: "A05:2021-Security Misconfiguration",
  22: "A01:2021-Broken Access Control",
  23: "A01:2021-Broken Access Control",
  35: "A01:2021-Broken Access Control",
  74: "A03:2021-Injection",
  77: "A03:2021-Injection",
  78: "A03:2021-Injection",
  79: "A03:2021-Injection",
  89: "A03:2021-Injection",
  90: "A03:2021-Injection",
  94: "A03:2021-Injection",
  117: "A09:2021-Security Logging and Monitoring Failures",
  200: "A01:2021-Broken Access Control",
  269: "A01:2021-Broken Access Control",
  284: "A01:2021-Broken Access Control",
  285: "A01:2021-Broken Access Control",
  287: "A07:2021-Identification and Authentication Failures",
  306: "A07:2021-Identification and Authentication Failures",
  307: "A07:2021-Identification and Authentication Failures",
  319: "A02:2021-Cryptographic Failures",
  321: "A02:2021-Cryptographic Failures",
  327: "A02:2021-Cryptographic Failures",
  328: "A02:2021-Cryptographic Failures",
  345: "A08:2021-Software and Data Integrity Failures",
  353: "A08:2021-Software and Data Integrity Failures",
  502: "A08:2021-Software and Data Integrity Failures",
  522: "A07:2021-Identification and Authentication Failures",
  532: "A09:2021-Security Logging and Monitoring Failures",
  611: "A05:2021-Security Misconfiguration",
  614: "A05:2021-Security Misconfiguration",
  639: "A01:2021-Broken Access Control",
  778: "A09:2021-Security Logging and Monitoring Failures",
  798: "A07:2021-Identification and Authentication Failures",
  829: "A08:2021-Software and Data Integrity Failures",
  862: "A01:2021-Broken Access Control",
  918: "A10:2021-Server-Side Request Forgery (SSRF)",
  1104: "A06:2021-Vulnerable and Outdated Components",
  1333: "A04:2021-Insecure Design",
};

const CWE_ID_RE = /^CWE-(\d+)$/i;
const CVE_ID_RE = /^CVE-\d{4}-\d{4,}$/i;

const normalizeToken = (value: string): string => value.trim().toUpperCase();

export const normalizeCweId = (value: string): string | null => {
  const normalized = normalizeToken(value);
  if (!normalized) return null;

  const cweMatch = normalized.match(CWE_ID_RE);
  if (cweMatch) {
    return `CWE-${Number(cweMatch[1])}`;
  }

  const rawNumeric = Number(normalized.replace(/^CWE[-_ ]?/, ""));
  if (Number.isInteger(rawNumeric) && rawNumeric > 0) {
    return `CWE-${rawNumeric}`;
  }

  return null;
};

export const normalizeCweIds = (values: string[] | undefined): string[] => {
  if (!values || values.length === 0) return [];

  const deduped = new Set<string>();
  for (const value of values) {
    const normalized = normalizeCweId(value);
    if (normalized) deduped.add(normalized);
  }
  return Array.from(deduped);
};

export const normalizeCveIds = (values: string[] | undefined): string[] => {
  if (!values || values.length === 0) return [];

  const deduped = new Set<string>();
  for (const raw of values) {
    const normalized = normalizeToken(raw);
    if (normalized && CVE_ID_RE.test(normalized)) {
      deduped.add(normalized);
    }
  }
  return Array.from(deduped);
};

export const deriveOwaspCategory = (
  cweIds: string[] | undefined,
): OwaspTop10Category | undefined => {
  if (!cweIds || cweIds.length === 0) return undefined;

  for (const cweId of cweIds) {
    const match = cweId.match(CWE_ID_RE);
    if (!match) continue;
    const cweNumber = Number(match[1]);
    const category = CWE_OWASP_MAP[cweNumber];
    if (category) {
      return category;
    }
  }

  return undefined;
};
