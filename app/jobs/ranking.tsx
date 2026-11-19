import type { Criterion } from "@/convex/jobDomain";
const stateLabels = { matched: "Correspondência nos dados", not_matched: "Sem correspondência nos dados", unknown: "Desconhecido" };
export function Ranking({ match }: { match: { score: number; knownWeight: number; criteria: Criterion[] } }) {
  return <section aria-label="Evidências do ranking"><p><strong>{match.score}/100</strong> pontos de 100 possíveis · Ranking determinístico v2 · Cobertura dos dados: {match.knownWeight}%</p><ul>{match.criteria.map(criterion => <li key={criterion.label}><strong>{criterion.label}</strong>: {stateLabels[criterion.state]} — {criterion.evidence}</li>)}</ul><p className="muted">Sem correspondência nos dados não comprova inelegibilidade. Dados desconhecidos não são tratados como requisitos não atendidos. Critérios desconhecidos valem zero pontos, sem indicar requisito não atendido. Confira os requisitos na fonte.</p></section>;
}
