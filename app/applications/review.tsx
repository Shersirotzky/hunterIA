"use client";
import { useRef, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { ResumeImport, type ResumeImportResult } from "@/components/profile/ResumeImport";
import { missingFields, readSnapshot, readQuestions, readResponses } from "@/convex/jobDomain";
import { updateApplication } from "../jobs/actions";
import { Submit } from "../profile/submit";
import styles from "../profile/forms.module.css";
export function ApplicationReview({ row }: { row: Doc<"applications"> & { job: Doc<"jobs"> | null } }) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [opening, setOpening] = useState(false);
  const [blockedPopup, setBlockedPopup] = useState(false);
  const openingRef = useRef(false);
  const snapshot = readSnapshot(row.reviewedSnapshotJson ?? row.snapshotJson);
  const missing = missingFields(snapshot);
  const [resumeText, setResumeText] = useState(snapshot.resumeText);
  const [resumeName, setResumeName] = useState(snapshot.resumeName);
  const [resumeDocumentId, setResumeDocumentId] = useState(snapshot.resumeDocumentId);
  const [replacement, setReplacement] = useState<ResumeImportResult | null>(null);
  const questions = readQuestions(snapshot.questionsJson), responses = readResponses(snapshot.responsesJson);
  function applyResume(result: ResumeImportResult) { setResumeText(result.text); setResumeName(result.fileName); setResumeDocumentId(result.documentId); }
  function multiDefault(raw: string) { try { const value = JSON.parse(raw); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
  const original = readSnapshot(row.snapshotJson);
  const stateLabel: Record<string, string> = { preparing: "Em preparação", ready: "Preparada", confirmed: "Enviada — confirmação do candidato", unknown: "Envio a confirmar", failed: "Falha", blocked: "Bloqueada", cancelled: "Cancelada" };
  const editable = ["preparing", "ready"].includes(row.status);
  async function save(form: FormData) {
    setError(""); setSaved(false);
    try { await updateApplication(form); setSaved(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a candidatura"); }
  }
  async function continueExternal() {
    if (!row.job || openingRef.current) return;
    openingRef.current = true; setOpening(true); setError("");
    // Reserve a blank tab in the user gesture; navigate only after the internal POST succeeds.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      const form = new FormData(); form.set("id",row._id); form.set("event","forward");
      await updateApplication(form);
      if (popup) popup.location.replace(row.job.canonicalUrl); else setBlockedPopup(true);
    } catch (cause) { popup?.close(); setError(cause instanceof Error ? cause.message : "Não foi possível registrar o encaminhamento"); }
    finally { openingRef.current = false; setOpening(false); }
  }
  return <article id={row._id} data-testid="application-card" data-application-id={row._id} className={`panel ${styles.form}`}>
    <h2>{row.job?.title ?? "Vaga indisponível"}</h2><p data-testid="application-status" data-status={row.status}>Estado: {stateLabel[row.status] ?? row.status}{row.status === "ready" && row.forwardedAt ? " · Aguardando conclusão externa" : ""}</p>
    {row.job && <section aria-label="Dados da vaga"><p>{row.job.company} · {row.job.location || "Local não informado"} · {row.job.workMode || "Modalidade não informada"}</p><p>Fonte: {row.job.source}. Publicação: data não informada.</p><details><summary>Descrição da vaga</summary><pre>{row.job.description || "Descrição não fornecida pela fonte."}</pre></details></section>}
    <p>Cópia do perfil em {original.capturedAt ? new Date(original.capturedAt).toISOString() : "data não registrada (candidatura anterior)"}. Alterações posteriores no perfil não substituem esta cópia.</p>
    {missing.length > 0 && <p data-testid="missing-fields">Obrigatórios ausentes na cópia: {missing.join(", ")}. Preencha abaixo para aprovar.</p>}
    {snapshot.questionsStatus !== "available" && <p className="notice">Perguntas da empresa: desconhecidas ou indisponíveis na fonte pública. Confira o formulário externo; isso não significa que seus requisitos estejam atendidos.</p>}
    <p>Os campos obrigatórios desta revisão são nome, e-mail válido, currículo e rascunho. {snapshot.questionsStatus === "available" ? "As perguntas públicas da empresa estão abaixo. Outros requisitos podem existir no formulário externo." : "As perguntas específicas da empresa não foram disponibilizadas nesta cópia e devem ser verificadas no formulário externo."}</p>
    {editable ? <form action={save} className={styles.form}>
      <input type="hidden" name="id" value={row._id} /><input type="hidden" name="event" value="review" />
      <fieldset><legend>Contato da candidatura</legend><div className="form-grid">
        <label>Nome completo<input name="fullName" defaultValue={snapshot.fullName} required autoComplete="name" maxLength={200} /></label>
        <label>E-mail de contato<input type="email" name="email" defaultValue={snapshot.email} required autoComplete="email" maxLength={254} /></label>
        <label>Cidade e estado<input name="location" defaultValue={snapshot.location} maxLength={200} /></label>
      </div></fieldset>
      <fieldset><legend>Experiência e respostas</legend>
        <label>Experiência profissional<textarea name="experience" defaultValue={snapshot.experience} rows={5} maxLength={50000} /></label>
        <label>Habilidades<textarea name="skills" defaultValue={snapshot.skills} rows={3} maxLength={10000} /></label>
        <label>Respostas frequentes<textarea name="answers" defaultValue={snapshot.answers} rows={4} maxLength={20000} /></label>
      </fieldset>
      <fieldset><legend>Currículo escolhido</legend>
        <label>Escolha do currículo<select defaultValue="prepared" onChange={event => {
          if (event.target.value === "prepared") { setResumeText(original.resumeText); setResumeName(original.resumeName); setResumeDocumentId(original.resumeDocumentId); }
          else if (event.target.value === "custom") { setResumeDocumentId(""); }
          else { setResumeText(""); setResumeName(""); setResumeDocumentId(""); }
        }}><option value="prepared">Currículo copiado do perfil na preparação</option><option value="custom">Personalizar texto para esta vaga</option><option value="new">Preencher outro currículo</option></select></label>
        <input type="hidden" name="resumeDocumentId" value={resumeDocumentId} />
        <ResumeImport onReviewed={result => { if (resumeText.trim()) setReplacement(result); else applyResume(result); }} />
        {replacement && <div role="group" aria-label="Confirmar substituição do currículo"><p>Substituir o currículo atual por {replacement.fileName}?</p><button type="button" className="button secondary" onClick={() => { applyResume(replacement); setReplacement(null); }}>Substituir currículo atual</button><button type="button" className="button secondary" onClick={() => setReplacement(null)}>Manter currículo atual</button></div>}
        <label>Nome do currículo<input name="resumeName" value={resumeName} onChange={event => setResumeName(event.target.value)} maxLength={200} /></label>
        <label>Texto do currículo<textarea name="resumeText" value={resumeText} onChange={event => setResumeText(event.target.value)} required rows={8} maxLength={100000} /></label>
        <small>Este texto acompanha a cópia revisada. Confira no site externo se a empresa exige arquivo PDF/DOCX e faça o upload lá.</small>
      </fieldset>
      <fieldset><legend>Perguntas publicadas pela empresa</legend>
        <p>Preenchimento sugerido usa somente dados do perfil aprovado. Perguntas sensíveis exigem resposta manual. Revise todas as sugestões.</p>
        {!questions.length && <p>Nenhuma pergunta foi disponibilizada nesta cópia. Verifique os obrigatórios no site da empresa.</p>}
        {questions.map(q => <div key={q.key}>{q.type === "resume" ? <p>{q.label}{q.required ? " (obrigatório)" : ""}: usa o currículo escolhido acima.{q.fileOnly ? " O original importado é necessário; anexe-o também no site da empresa." : ""}</p> : q.type === "attachment" ? <p>{q.label}{q.required ? " (obrigatório)" : ""}: anexo específico não preparado. Requer revisão no site externo.</p> : <label>{q.label}{q.required ? " (obrigatório)" : ""}
          {q.type === "select" || q.type === "multi" ? <><input type="hidden" name={`multi:${q.key}`} value={q.type === "multi" ? "true" : "false"} /><select name={`question:${q.key}`} required={q.required} multiple={q.type === "multi"} defaultValue={q.type === "multi" ? multiDefault(responses[q.key] ?? "") : responses[q.key] ?? ""}>{q.type === "select" && <option value="">Selecione uma resposta</option>}{q.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></> : q.type === "email" ? <input type="email" name={`question:${q.key}`} defaultValue={responses[q.key] ?? ""} required={q.required} maxLength={254} /> : <textarea name={`question:${q.key}`} defaultValue={responses[q.key] ?? ""} required={q.required} rows={3} maxLength={20000} />}
          {q.sensitive && <small>Dado sensível ou consentimento: nenhuma resposta foi inferida.</small>}
        </label>}</div>)}
      </fieldset>
      <label>Rascunho<textarea name="draft" defaultValue={row.draft} rows={10} required maxLength={100000} /></label>
      <p>Ao salvar, confirmo que revisei os dados e o currículo desta candidatura.</p><Submit>Salvar e aprovar rascunho</Submit>
    </form> : <details><summary>Ver dados revisados e currículo</summary><p>{snapshot.fullName} · {snapshot.email} · {snapshot.location}</p><h3>Experiência</h3><pre>{snapshot.experience}</pre><h3>Habilidades</h3><pre>{snapshot.skills}</pre><h3>Respostas</h3><pre>{snapshot.answers}</pre><h3>{snapshot.resumeName}</h3><pre>{snapshot.resumeText}</pre><h3>Rascunho</h3><pre>{row.draft}</pre></details>}
    {resumeDocumentId && <a href={`/api/resume/download?id=${encodeURIComponent(resumeDocumentId)}`}>Baixar currículo original escolhido</a>}
    {row.job && <a href={row.job.canonicalUrl} target="_blank" rel="noopener noreferrer">Consultar requisitos na publicação original</a>}
    {row.forwardedAt && row.status === "ready" && <p data-testid="application-forwarded">Aguardando conclusão externa. Encaminhamento registrado; envio depende da sua confirmação.</p>}
    {row.status === "ready" && row.reviewedAt && row.job && <>
      <button type="button" className="button primary" disabled={opening} aria-busy={opening} onClick={continueExternal}>{opening ? "Registrando encaminhamento…" : "Continuar no site da empresa"}</button>
      {blockedPopup && <p>Encaminhamento registrado. Seu navegador bloqueou a nova aba. <a href={row.job.canonicalUrl} target="_blank" rel="noopener noreferrer">Abrir site externo</a></p>}
      <p>Abrir este link não confirma envio.</p>
      <form action={save} className={styles.form}><input type="hidden" name="id" value={row._id} />
        <label>Evidência do envio (protocolo ou mensagem de confirmação)<textarea name="evidence" minLength={10} maxLength={10000} required /></label>
        <Submit name="event" value="confirm">Confirmo que enviei a candidatura</Submit>
      </form>
    </>}
    {row.confirmationEvidence && <p>Confirmação informada por você: {row.confirmationEvidence}</p>}
    {error && <p role="alert">{error}</p>}{saved && <p role="status">Candidatura atualizada.</p>}
  </article>;
}
