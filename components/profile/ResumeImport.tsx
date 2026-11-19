"use client";

import { useId, useState } from "react";

export type ResumeImportResult = {
  text: string;
  fileName: string;
  documentId: string;
  downloadUrl: string;
  mediaType: string;
  size: number;
  sha256: string;
  warnings: string[];
};
export type ResumeImportProps = {
  /** Called only after the user explicitly confirms the reviewed text. Parent decides how to save it. */
  onReviewed: (result: ResumeImportResult) => void | Promise<void>;
  disabled?: boolean;
};

export function ResumeImport({ onReviewed, disabled = false }: ResumeImportProps) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResumeImportResult | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function upload() {
    if (!file || busy || disabled) return;
    setError(""); setStatus("");
    if (!file.size || file.size > 5 * 1024 * 1024) { setError("Selecione um arquivo não vazio de até 5 MB."); return; }
    setBusy(true); setResult(null); setText("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/resume", { method: "POST", body: form, credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível importar.");
      setResult(data); setText(data.text);
      setStatus("Original guardado de forma privada. Revise e complemente o texto abaixo.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao importar."); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!result || busy || disabled || !text.trim()) return;
    setBusy(true); setError(""); setStatus("");
    try { await onReviewed({ ...result, text: text.trim() }); setStatus("Texto revisado enviado ao editor. Salve o perfil para confirmar as alterações."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível transferir ao editor."); }
    finally { setBusy(false); }
  }
  return <fieldset disabled={disabled || busy}>
    <legend>Importar currículo privado</legend>
    <p>PDF, DOCX ou TXT UTF-8, até 5 MB. A extração não preenche nem aprova seu perfil automaticamente.</p>
    <label htmlFor={`${id}-file`}>Arquivo do currículo</label>
    <input id={`${id}-file`} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={event => { setFile(event.target.files?.[0] ?? null); setError(""); }} />
    <button type="button" disabled={!file || disabled || busy} onClick={upload}>{busy ? "Processando…" : "Importar e extrair texto"}</button>
    {result && <>
      <p><a href={result.downloadUrl} download>Baixar original: {result.fileName}</a> ({Math.ceil(result.size / 1024)} KB)</p>
      {result.warnings.map(warning => <p key={warning}>{warning}</p>)}
      <label htmlFor={`${id}-text`}>Texto extraído — revise e complemente manualmente</label>
      <textarea id={`${id}-text`} value={text} maxLength={100000} rows={14} onChange={event => setText(event.target.value)} />
      <small>{text.length.toLocaleString("pt-BR")} / 100.000 caracteres. Sem interpretação por IA. PDFs digitalizados podem não conter texto.</small>
      <button type="button" disabled={!text.trim() || disabled || busy} onClick={confirm}>Usar texto revisado no editor</button>
    </>}
    {error && <p role="alert">{error}</p>}
    <p role="status" aria-live="polite">{status}</p>
  </fieldset>;
}
export default ResumeImport;
