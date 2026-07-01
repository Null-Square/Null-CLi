export type CvssMetricAttackVector = "N" | "A" | "L" | "P";
export type CvssMetricAttackComplexity = "L" | "H";
export type CvssMetricPrivilegesRequired = "N" | "L" | "H";
export type CvssMetricUserInteraction = "N" | "R";
export type CvssMetricScope = "U" | "C";
export type CvssMetricImpact = "N" | "L" | "H";

export type CvssSeverity = "none" | "low" | "medium" | "high" | "critical";

export interface CvssMetrics {
  attackVector: CvssMetricAttackVector;
  attackComplexity: CvssMetricAttackComplexity;
  privilegesRequired: CvssMetricPrivilegesRequired;
  userInteraction: CvssMetricUserInteraction;
  scope: CvssMetricScope;
  confidentiality: CvssMetricImpact;
  integrity: CvssMetricImpact;
  availability: CvssMetricImpact;
}

export interface CalculatedCvss {
  score: number;
  severity: CvssSeverity;
  vector: string;
}

const ATTACK_VECTOR_WEIGHT: Record<CvssMetricAttackVector, number> = {
  N: 0.85,
  A: 0.62,
  L: 0.55,
  P: 0.2,
};

const ATTACK_COMPLEXITY_WEIGHT: Record<CvssMetricAttackComplexity, number> = {
  L: 0.77,
  H: 0.44,
};

const USER_INTERACTION_WEIGHT: Record<CvssMetricUserInteraction, number> = {
  N: 0.85,
  R: 0.62,
};

const IMPACT_WEIGHT: Record<CvssMetricImpact, number> = {
  N: 0,
  L: 0.22,
  H: 0.56,
};

const PRIVILEGES_REQUIRED_WEIGHT: Record<CvssMetricScope, Record<CvssMetricPrivilegesRequired, number>> = {
  U: {
    N: 0.85,
    L: 0.62,
    H: 0.27,
  },
  C: {
    N: 0.85,
    L: 0.68,
    H: 0.5,
  },
};

const roundUpOneDecimal = (value: number): number => {
  const scaled = Math.round(value * 100000);
  if (scaled % 10000 === 0) {
    return scaled / 100000;
  }
  return (Math.floor(scaled / 10000) + 1) / 10;
};

const calculateSeverity = (score: number): CvssSeverity => {
  if (score === 0) return "none";
  if (score <= 3.9) return "low";
  if (score <= 6.9) return "medium";
  if (score <= 8.9) return "high";
  return "critical";
};

export const buildCvssVector = (metrics: CvssMetrics): string =>
  `CVSS:3.1/AV:${metrics.attackVector}/AC:${metrics.attackComplexity}/PR:${metrics.privilegesRequired}/UI:${metrics.userInteraction}/S:${metrics.scope}/C:${metrics.confidentiality}/I:${metrics.integrity}/A:${metrics.availability}`;

export const calculateCvss = (metrics: CvssMetrics): CalculatedCvss => {
  const av = ATTACK_VECTOR_WEIGHT[metrics.attackVector];
  const ac = ATTACK_COMPLEXITY_WEIGHT[metrics.attackComplexity];
  const pr = PRIVILEGES_REQUIRED_WEIGHT[metrics.scope][metrics.privilegesRequired];
  const ui = USER_INTERACTION_WEIGHT[metrics.userInteraction];
  const c = IMPACT_WEIGHT[metrics.confidentiality];
  const i = IMPACT_WEIGHT[metrics.integrity];
  const a = IMPACT_WEIGHT[metrics.availability];

  const impactSubScore = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact =
    metrics.scope === "U"
      ? 6.42 * impactSubScore
      : 7.52 * (impactSubScore - 0.029) - 3.25 * Math.pow(impactSubScore - 0.02, 15);
  const exploitability = 8.22 * av * ac * pr * ui;

  let baseScore = 0;
  if (impact > 0) {
    const score = metrics.scope === "U" ? impact + exploitability : 1.08 * (impact + exploitability);
    baseScore = roundUpOneDecimal(Math.min(score, 10));
  }

  return {
    score: baseScore,
    severity: calculateSeverity(baseScore),
    vector: buildCvssVector(metrics),
  };
};
