import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { FileArchive, FileText, Search, ZoomIn, ZoomOut, X } from "lucide-react";
import type { ProjectDocument } from "../api/projects";

export type FilePreviewKind = "pdf" | "word" | "spreadsheet" | "text" | "image" | "svg" | "zip" | "unsupported";

export function filePreviewKind(fileName: string): FilePreviewKind {
  const extension = fileName.split(".").pop()?.toLocaleLowerCase() ?? "";
  if (extension === "pdf") return "pdf";
  if (["doc", "docx"].includes(extension)) return "word";
  if (["xls", "xlsx", "csv"].includes(extension)) return "spreadsheet";
  if (["txt", "md", "markdown"].includes(extension)) return "text";
  if (["jpg", "jpeg", "png", "tif", "tiff"].includes(extension)) return "image";
  if (extension === "svg") return "svg";
  if (extension === "zip") return "zip";
  return "unsupported";
}

type Props = { document: ProjectDocument; content: Blob };

export function ProjectFileViewer({ document, content }: Props) {
  const kind = filePreviewKind(document.fileName);
  if (kind === "pdf") return <ObjectPreview content={content} type="application/pdf" title={`PDF ${document.fileName}`} />;
  if (kind === "image") return /\.tiff?$/i.test(document.fileName) ? <TiffPreview content={content} title={document.fileName} /> : <ImagePreview content={content} title={document.fileName} />;
  if (kind === "svg") return <SvgPreview content={content} title={document.fileName} />;
  if (kind === "word") return <WordPreview content={content} legacy={/\.doc$/i.test(document.fileName)} />;
  if (kind === "spreadsheet") return <SpreadsheetPreview content={content} />;
  if (kind === "text") return <TextPreview content={content} markdown={/\.(md|markdown)$/i.test(document.fileName)} />;
  if (kind === "zip") return <ZipPreview content={content} />;
  return <ViewerMessage icon={<FileText size={52} />} title="Este formato não tem pré-visualização." detail="Pode transferir o ficheiro a partir da lista de documentos." />;
}

function useObjectUrl(content: Blob) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(content);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [content]);
  return url;
}

function ObjectPreview({ content, type, title }: { content: Blob; type: string; title: string }) {
  const typedContent = useMemo(() => content.type === type ? content : new Blob([content], { type }), [content, type]);
  const url = useObjectUrl(typedContent);
  return url ? <object className="project-file-viewer__object" data={url} type={type} aria-label={title}><ViewerMessage icon={<FileText size={48} />} title="O navegador não conseguiu apresentar este PDF." detail="Pode transferi-lo a partir da lista de documentos." /></object> : null;
}

function ImagePreview({ content, title }: { content: Blob; title: string }) {
  const url = useObjectUrl(content);
  const [zoom, setZoom] = useState(1);
  useEffect(() => setZoom(1), [content]);
  return <div className="project-file-viewer__image-stage">
    {url && <img src={url} alt={`Pré-visualização de ${title}`} style={{ transform: `scale(${zoom})` }} />}
    <ZoomControls zoom={zoom} onChange={setZoom} />
  </div>;
}

function TiffPreview({ content, title }: { content: Blob; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError(""); setZoom(1);
    content.arrayBuffer().then(async (buffer) => {
      const UTIF = (await import("utif")).default;
      const pages = UTIF.decode(buffer);
      if (!pages.length) throw new Error("O ficheiro TIFF não contém imagens.");
      if (pages[0].width <= 0 || pages[0].height <= 0 || pages[0].width * pages[0].height > 50_000_000)
        throw new Error("A imagem TIFF excede o limite de 50 megapíxeis para visualização segura.");
      UTIF.decodeImage(buffer, pages[0]);
      if (!active || !canvasRef.current) return;
      const rgba = UTIF.toRGBA8(pages[0]);
      const canvas = canvasRef.current;
      canvas.width = pages[0].width; canvas.height = pages[0].height;
      canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(rgba), pages[0].width, pages[0].height), 0, 0);
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Não foi possível ler a imagem TIFF."); });
    return () => { active = false; };
  }, [content]);
  if (error) return <ViewerMessage icon={<FileText size={48} />} title="Não foi possível apresentar esta imagem TIFF." detail={error} />;
  return <div className="project-file-viewer__image-stage"><canvas ref={canvasRef} aria-label={`Pré-visualização de ${title}`} style={{ transform: `scale(${zoom})` }} /><ZoomControls zoom={zoom} onChange={setZoom} /></div>;
}

function SvgPreview({ content, title }: { content: Blob; title: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let active = true;
    content.text().then((source) => {
      const clean = DOMPurify.sanitize(source, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ["script", "foreignObject"] });
      const parsed = new DOMParser().parseFromString(clean, "image/svg+xml");
      parsed.querySelectorAll("*").forEach((element) => {
        for (const attribute of ["href", "xlink:href"]) {
          const value = element.getAttribute(attribute)?.trim();
          if (value && !value.startsWith("#")) element.removeAttribute(attribute);
        }
        if (/url\s*\(/i.test(element.getAttribute("style") ?? "")) element.removeAttribute("style");
      });
      if (active) setSvg(new XMLSerializer().serializeToString(parsed.documentElement));
    });
    return () => { active = false; };
  }, [content]);
  return <div className="project-file-viewer__svg" role="img" aria-label={`Pré-visualização de ${title}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function WordPreview({ content, legacy }: { content: Blob; legacy: boolean }) {
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setHtml(""); setText(""); setError("");
    content.arrayBuffer().then(async (arrayBuffer) => {
      if (legacy) {
        const extracted = extractLegacyWordText(arrayBuffer);
        if (!extracted) throw new Error("Não foi possível extrair texto deste documento DOC antigo.");
        if (active) setText(extracted);
        return;
      }
      await assertSafeOfficePackage(arrayBuffer);
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml({ arrayBuffer });
      if (active) setHtml(DOMPurify.sanitize(result.value));
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Não foi possível ler o documento Word."); });
    return () => { active = false; };
  }, [content, legacy]);
  if (error) return <ViewerMessage icon={<FileText size={48} />} title="Não foi possível apresentar este documento Word." detail={error} />;
  return <div className="project-file-viewer__scroll project-file-viewer__paper">{html ? <div className="project-file-viewer__document" dangerouslySetInnerHTML={{ __html: html }} /> : <SearchableText text={text} />}</div>;
}

function extractLegacyWordText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const candidates = [new TextDecoder("windows-1252").decode(bytes), new TextDecoder("utf-16le").decode(bytes)];
  const runs = candidates.flatMap((value) => value.match(/[\p{L}\p{N}][\p{L}\p{N}\p{P}\p{Zs}\t]{5,}/gu) ?? [])
    .map((value) => value.replace(/[\u0000-\u001f]+/g, " ").trim()).filter((value) => value.length >= 6);
  return [...new Set(runs)].join("\n");
}

function SpreadsheetPreview({ content }: { content: Blob }) {
  const [sheets, setSheets] = useState<Array<{ name: string; rows: string[][] }>>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setSheets([]); setActiveSheet(0); setError("");
    content.arrayBuffer().then(async (buffer) => {
      if (isZipPackage(buffer)) return assertSafeOfficePackage(buffer).then(() => buffer);
      return buffer;
    }).then(async (buffer) => {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true, dense: true, sheetRows: 10000 });
      const parsed = workbook.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], { header: 1, defval: "", raw: false }).map((row) => row.slice(0, 200).map(String)) }));
      if (active) setSheets(parsed);
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Não foi possível ler a folha de cálculo."); });
    return () => { active = false; };
  }, [content]);
  if (error) return <ViewerMessage icon={<FileText size={48} />} title="Não foi possível apresentar esta folha de cálculo." detail={error} />;
  const sheet = sheets[activeSheet];
  return <div className="project-file-viewer__spreadsheet">
    <div className="project-file-viewer__tabs" role="tablist" aria-label="Folhas">{sheets.map((item, index) => <button key={item.name} type="button" role="tab" aria-selected={index === activeSheet} onClick={() => setActiveSheet(index)}>{item.name}</button>)}</div>
    <div className="project-file-viewer__table-wrap">{sheet && <table><tbody>{sheet.rows.map((row, rowIndex) => <tr key={rowIndex}><th scope="row">{rowIndex + 1}</th>{row.map((cell, columnIndex) => <td key={columnIndex}>{cell}</td>)}</tr>)}</tbody></table>}</div>
  </div>;
}

function TextPreview({ content, markdown }: { content: Blob; markdown: boolean }) {
  const [text, setText] = useState("");
  useEffect(() => { let active = true; content.text().then((value) => { if (active) setText(value); }); return () => { active = false; }; }, [content]);
  const html = useMemo(() => markdown ? DOMPurify.sanitize(marked.parse(text, { async: false }) as string) : "", [markdown, text]);
  return <div className="project-file-viewer__scroll project-file-viewer__paper">{markdown ? <div className="project-file-viewer__document" dangerouslySetInnerHTML={{ __html: html }} /> : <SearchableText text={text} />}</div>;
}

type ZipItem = { name: string; directory: boolean; compressed: number; uncompressed: number; unsafe: boolean };
function ZipPreview({ content }: { content: Blob }) {
  const [items, setItems] = useState<ZipItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setItems([]); setError("");
    content.arrayBuffer().then(async (buffer) => {
      const { default: JSZip } = await import("jszip");
      return JSZip.loadAsync(buffer, { createFolders: true });
    }).then((archive) => {
      const entries = Object.values(archive.files);
      if (entries.length > 10000) throw new Error("O arquivo contém demasiadas entradas para inspeção segura.");
      const mapped = entries.map((entry) => {
        const data = (entry as unknown as { _data?: { compressedSize?: number; uncompressedSize?: number } })._data;
        return { name: entry.name, directory: entry.dir, compressed: data?.compressedSize ?? 0, uncompressed: data?.uncompressedSize ?? 0, unsafe: entry.unsafeOriginalName !== undefined && entry.unsafeOriginalName !== entry.name };
      });
      if (active) setItems(mapped);
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Não foi possível inspecionar o arquivo ZIP."); });
    return () => { active = false; };
  }, [content]);
  if (error) return <ViewerMessage icon={<FileArchive size={48} />} title="Não foi possível inspecionar este ZIP." detail={error} />;
  const normalized = query.trim().toLocaleLowerCase();
  const visible = normalized ? items.filter((item) => item.name.toLocaleLowerCase().includes(normalized)) : items;
  const total = items.reduce((sum, item) => sum + item.uncompressed, 0);
  return <div className="project-file-viewer__archive">
    <SearchBox value={query} onChange={setQuery} result={`${visible.length} de ${items.length} entradas`} />
    <p className="project-file-viewer__archive-summary">Inspeção segura: nomes e tamanhos apenas · {formatBytes(total)} descomprimidos</p>
    <div className="project-file-viewer__archive-list">{visible.map((item, index) => <div key={`${item.name}-${index}`}><FileArchive size={16} /><span title={item.name}>{item.name}</span><small>{item.directory ? "Pasta" : formatBytes(item.uncompressed)}{item.unsafe ? " · caminho normalizado" : ""}</small></div>)}</div>
  </div>;
}

function SearchableText({ text }: { text: string }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => query ? text.toLocaleLowerCase().split(query.toLocaleLowerCase()).length - 1 : 0, [query, text]);
  return <><SearchBox value={query} onChange={setQuery} result={query ? `${matches} ocorrências` : ""} /><pre>{query ? highlight(text, query) : text}</pre></>;
}

function SearchBox({ value, onChange, result }: { value: string; onChange: (value: string) => void; result: string }) {
  return <div className="project-file-viewer__search"><label><Search size={16} /><span className="sr-only">Pesquisar no documento</span><input type="search" value={value} placeholder="Pesquisar" onChange={(event) => onChange(event.target.value)} />{value && <button type="button" aria-label="Limpar pesquisa" onClick={() => onChange("")}><X size={14} /></button>}</label><small aria-live="polite">{result}</small></div>;
}

function highlight(text: string, query: string) {
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
  return parts.map((part, index) => part.toLocaleLowerCase() === query.toLocaleLowerCase() ? <mark key={index}>{part}</mark> : part);
}

function ZoomControls({ zoom, onChange }: { zoom: number; onChange: (value: number) => void }) {
  return <div className="project-document-viewer__controls" aria-label="Controlos de zoom"><button type="button" aria-label="Aumentar zoom" onClick={() => onChange(Math.min(zoom * 1.2, 5))}><ZoomIn size={18} /></button><button type="button" aria-label="Diminuir zoom" onClick={() => onChange(Math.max(zoom / 1.2, .2))}><ZoomOut size={18} /></button></div>;
}

function ViewerMessage({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="project-document-viewer__state">{icon}<strong>{title}</strong><span>{detail}</span></div>;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

const isZipPackage = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4));
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
};

async function assertSafeOfficePackage(buffer: ArrayBuffer) {
  const { default: JSZip } = await import("jszip");
  const archive = await JSZip.loadAsync(buffer);
  const entries = Object.values(archive.files);
  if (entries.length > 5000) throw new Error("O documento contém demasiados recursos internos para visualização segura.");
  let expanded = 0;
  for (const entry of entries) {
    const data = (entry as unknown as { _data?: { compressedSize?: number; uncompressedSize?: number } })._data;
    const compressed = data?.compressedSize ?? 0;
    const uncompressed = data?.uncompressedSize ?? 0;
    expanded += uncompressed;
    if (uncompressed > 25 * 1024 * 1024 || (compressed > 0 && uncompressed / compressed > 200))
      throw new Error("O documento contém um recurso interno demasiado grande para visualização segura.");
  }
  if (expanded > 100 * 1024 * 1024) throw new Error("O documento é demasiado grande depois de descomprimido.");
}
