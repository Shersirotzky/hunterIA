"use client";
import { useRef, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { importedContact, readableJson, readableAnswersJson } from "@/convex/profileDomain";
import { ResumeImport, type ResumeImportResult } from "@/components/profile/ResumeImport";
import { saveProfile } from "./actions";
import { Submit } from "./submit";
import styles from "./forms.module.css";

type JsonField = "workHistoryJson" | "educationJson" | "skillsJson" | "languagesJson" | "targetRolesJson" | "locationsJson" | "workModesJson" | "salaryJson" | "preferredIndustriesJson" | "excludedIndustriesJson" | "standardAnswersJson";
export function Editor({ profile }: { profile: Doc<"professionalProfiles"> | null }) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [imported, setImported] = useState("");
  const [replacement, setReplacement] = useState<ResumeImportResult | null>(null);
  const [resumeText, setResumeText] = useState(profile?.resumeText ?? "");
  const [resumeName, setResumeName] = useState(profile?.resumeName ?? "");
  const [documentId, setDocumentId] = useState(profile?.resumeDocumentId ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  function applyResume(result: ResumeImportResult) {
    setResumeText(result.text); setResumeName(result.fileName); setDocumentId(result.documentId); setSaved(false);
    const email = formRef.current?.elements.namedItem("email") as HTMLInputElement | null;
    if (email && !email.value) email.value = importedContact(result.text).email;
    setImported("Currículo revisado carregado no editor. Confira os dados e salve o perfil.");
  }
  const field = (key: JsonField, label: string, help?: string, required = false) => <label>{label}<textarea name={key} defaultValue={key === "standardAnswersJson" ? readableAnswersJson(profile?.standardAnswersJson ?? "{}") : readableJson(profile?.[key] ?? "[]")} rows={key === "workHistoryJson" ? 6 : 3} required={required} maxLength={50000} /><small>{help}</small></label>;
  return <form ref={formRef} className={styles.form} action={async form => {
    setError(""); setSaved(false);
    try { await saveProfile(form); setSaved(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar"); }
  }}>
    <fieldset><legend>Contato e apresentação</legend><div className="form-grid">
      <label>Nome completo<input name="fullName" defaultValue={profile?.fullName} autoComplete="name" required maxLength={200} /></label>
      <label>E-mail de contato<input name="email" type="email" defaultValue={profile?.email} autoComplete="email" maxLength={254} /><small>Opcional no perfil. Será solicitado na revisão da candidatura.</small></label>
      <label>Cidade e estado<input name="location" defaultValue={profile?.location} autoComplete="address-level2" maxLength={200} /></label>
      <label>Título profissional<input name="headline" defaultValue={profile?.headline} placeholder="Ex.: Analista de QA" maxLength={300} /></label>
    </div><label>Resumo profissional<textarea name="summary" defaultValue={profile?.summary} rows={5} maxLength={10000} /></label></fieldset>
    <fieldset><legend>Experiência e formação</legend>
      <div className="form-grid"><label>Senioridade desejada<select name="seniority" defaultValue={profile?.seniority ?? ""}><option value="">Não informado</option>{["Júnior", "Pleno", "Sênior", "Liderança", "Gerência", "Diretoria"].map(level => <option key={level}>{level}</option>)}</select></label><label>Anos de experiência profissional<input name="yearsExperience" type="number" min="0" max="80" step="0.5" defaultValue={profile?.yearsExperience} /><small>Informe seu total revisado, sem somar períodos sobrepostos.</small></label></div>
      {field("workHistoryJson", "Experiência profissional", "Descreva cargos, empresas, períodos e resultados. Dados importados que você não editar serão preservados.")}
      {field("educationJson", "Formação acadêmica")}
      <div className="form-grid">{field("skillsJson", "Habilidades", "Uma por linha ou separadas por vírgula.")}{field("languagesJson", "Idiomas e nível", "Um por linha. Ex.: Inglês: avançado; Português: nativo.")}</div>
    </fieldset>
    <fieldset><legend>Preferências de vagas</legend><div className="form-grid">
      {field("targetRolesJson", "Cargos desejados", "Um por linha ou separados por vírgula.", true)}
      {field("locationsJson", "Locais de interesse", "Uma cidade ou região por linha.")}
      {field("workModesJson", "Modalidades de trabalho", "Ex.: Remoto, Híbrido, Presencial.")}
      {field("salaryJson", "Pretensão salarial", "Informe valor, moeda e periodicidade quando conhecidos.")}
      {field("preferredIndustriesJson", "Setores de interesse")}{field("excludedIndustriesJson", "Setores que deseja evitar")}
    </div><label>Autorização de trabalho<input name="workAuthorization" defaultValue={profile?.workAuthorization} placeholder="Ex.: Autorizado a trabalhar no Brasil" maxLength={1000} /></label>
    {field("standardAnswersJson", "Respostas frequentes", "Uma por linha no formato Pergunta da empresa: sua resposta. Ex.: Disponibilidade para início: 30 dias. Sugestões são reutilizadas somente em perguntas de mesmo texto; dados sensíveis exigem resposta manual.")}</fieldset>
    <fieldset><legend>Currículo para candidaturas</legend>
      <p>Cole o texto do currículo ou importe PDF, DOCX ou TXT de até 5 MB. A extração não substitui os demais campos do perfil. PDFs digitalizados podem exigir preenchimento manual.</p>
      <input type="hidden" name="resumeDocumentId" value={documentId} />
      <ResumeImport disabled={!profile} onReviewed={result => {
        if (resumeText.trim()) { setReplacement(result); return; }
        applyResume(result);
      }} />
      {replacement && <div role="group" aria-label="Confirmar substituição do currículo"><p>Já existe um currículo no editor. Deseja substituir o texto e o original selecionado por {replacement.fileName}?</p><button type="button" className="button secondary" onClick={() => { applyResume(replacement); setReplacement(null); }}>Substituir currículo atual</button><button type="button" className="button secondary" onClick={() => setReplacement(null)}>Manter currículo atual</button></div>}
      {!profile && <small>Salve seu perfil primeiro para habilitar a importação de arquivos. Você já pode colar o texto abaixo.</small>}
      {documentId && <a href={`/api/resume/download?id=${encodeURIComponent(documentId)}`}>Baixar original importado</a>}
      <label>Nome deste currículo<input name="resumeName" value={resumeName} onChange={event => setResumeName(event.target.value)} placeholder="Ex.: Currículo QA em português" maxLength={200} /></label>
      <label>Texto do currículo<textarea name="resumeText" value={resumeText} onChange={event => setResumeText(event.target.value)} rows={10} maxLength={100000} /></label>
      {imported && <p role="status">{imported}</p>}
    </fieldset>
    <p className="muted">Salvar devolve o perfil para revisão. Revise os dados antes de aprovar e buscar vagas.</p>
    <Submit>Salvar perfil</Submit>{error && <p role="alert">{error}</p>}{saved && <p role="status">Perfil salvo. Revise e aprove abaixo.</p>}
  </form>;
}
