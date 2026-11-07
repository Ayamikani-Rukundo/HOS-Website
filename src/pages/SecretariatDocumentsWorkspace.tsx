import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Bold,
  CalendarDays,
  Check,
  Clock3,
  Download,
  Eye,
  FileText,
  FileUp,
  Italic,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Underline,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { deleteAdminRow, listAdminRows, saveAdminRow, type DataRow } from '../lib/admin-api';
import { getSupabaseClient } from '../lib/supabase';

type DocumentAttachment = { path: string; name: string; size: number; type: string };
type DocumentMode = 'documents' | 'uploads';
type DocumentBody = {
  kind?: string;
  html?: string;
  text?: string;
  description?: string;
  meeting_time?: string;
  attachments?: DocumentAttachment[];
};

const documentTypes = [
  { value: 'note', label: 'General document' },
  { value: 'meeting_minutes', label: 'Meeting minutes' },
  { value: 'memo', label: 'Memo' },
  { value: 'report', label: 'Report' },
];
const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'txt', 'rtf']);
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/rtf',
  'application/x-rtf',
  'text/rtf',
]);
const richTextTags = new Set(['b', 'blockquote', 'br', 'div', 'em', 'h2', 'h3', 'hr', 'i', 'li', 'ol', 'p', 'span', 'strong', 'u', 'ul']);
const discardedTags = new Set(['iframe', 'object', 'script', 'style', 'svg', 'template']);

function documentBody(row: DataRow): DocumentBody {
  const body = row.body;
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? body as DocumentBody : {};
}

function documentAttachments(row: DataRow): DocumentAttachment[] {
  const attachments = documentBody(row).attachments;
  if (!Array.isArray(attachments)) return [];
  return attachments.filter((item): item is DocumentAttachment =>
    typeof item === 'object' && item !== null &&
    typeof item.path === 'string' && typeof item.name === 'string',
  );
}

function isUploadedDocument(row: DataRow) {
  return documentBody(row).kind === 'upload' || documentAttachments(row).length > 0;
}

function localDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formattedDate(value: unknown) {
  if (typeof value !== 'string' || !value) return 'Date not set';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Date not set' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formattedCreatedDate(value: unknown) {
  if (typeof value !== 'string' || !value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function typeLabel(value: unknown) {
  return documentTypes.find((type) => type.value === value)?.label ?? 'General document';
}

function escapeHtml(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function safeColor(value: string | null) {
  if (!value) return null;
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => `${digit}${digit}`).join('') : hex[1];
    return `#${digits.toLowerCase()}`;
  }
  const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (!rgb) return null;
  const parts = rgb.slice(1).map(Number);
  if (parts.some((part) => part < 0 || part > 255)) return null;
  return `#${parts.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

function sanitizeDocumentHtml(input: string) {
  const parsed = new DOMParser().parseFromString(input, 'text/html');
  const cleanNode = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
    if (!(node instanceof Element)) return '';
    const tag = node.tagName.toLowerCase();
    if (discardedTags.has(tag)) return '';
    const children = Array.from(node.childNodes, cleanNode).join('');
    if (tag === 'font') {
      const color = safeColor(node.getAttribute('color'));
      return color ? `<span style="color:${color}">${children}</span>` : children;
    }
    if (!richTextTags.has(tag)) return children;
    if (tag === 'br' || tag === 'hr') return `<${tag}>`;
    if (tag === 'span') {
      const color = safeColor((node as HTMLElement).style.color);
      return color ? `<span style="color:${color}">${children}</span>` : children;
    }
    return `<${tag}>${children}</${tag}>`;
  };
  return Array.from(parsed.body.childNodes, cleanNode).join('');
}

function legacyTextHtml(text: string) {
  return text.split(/\r?\n/).map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`).join('');
}

function documentHtml(row: DataRow) {
  const body = documentBody(row);
  return sanitizeDocumentHtml(typeof body.html === 'string' ? body.html : typeof body.text === 'string' ? legacyTextHtml(body.text) : '');
}

function documentPlainText(html: string) {
  const parsed = new DOMParser().parseFromString(sanitizeDocumentHtml(html), 'text/html');
  return parsed.body.textContent?.trim() ?? '';
}

function isAllowedFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return allowedExtensions.has(extension) && (!file.type || allowedMimeTypes.has(file.type));
}

function dateValueForRow(row: DataRow) {
  return String(row.meeting_date ?? String(row.created_at ?? '').slice(0, 10));
}

function sortedByDate(rows: DataRow[]) {
  return [...rows].sort((a, b) => dateValueForRow(b).localeCompare(dateValueForRow(a)) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

export function SecretariatDocumentsWorkspace({ mode }: { mode: DocumentMode }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<'list' | 'editor' | 'upload'>('list');
  const [editing, setEditing] = useState<DataRow | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DataRow | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRows(await listAdminRows('secretariat_documents'));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Secretariat documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  useEffect(() => {
    if (!previewDocument) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewDocument(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewDocument]);

  const visibleRows = useMemo(() => sortedByDate(rows.filter((row) => mode === 'uploads' ? isUploadedDocument(row) : !isUploadedDocument(row))), [mode, rows]);

  const removeDocument = async (row: DataRow) => {
    const id = typeof row.id === 'string' ? row.id : '';
    if (!id) {
      setError('This document cannot be deleted because it has no database ID.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAdminRow('secretariat_documents', row);
      setRows((current) => current.filter((item) => item.id !== id));
      setConfirmingId(null);
      const attachments = documentAttachments(row);
      if (attachments.length) {
        const { error: storageError } = await getSupabaseClient().storage.from('secretariat-documents').remove(attachments.map((item) => item.path));
        if (storageError) setError(`The record was deleted, but some stored files could not be removed: ${storageError.message}`);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this document.');
    } finally {
      setBusy(false);
    }
  };

  const openAttachment = async (attachment: DocumentAttachment) => {
    setError(null);
    try {
      const { data, error: storageError } = await getSupabaseClient().storage
        .from('secretariat-documents')
        .createSignedUrl(attachment.path, 60, { download: attachment.name });
      if (storageError) throw new Error(storageError.message);
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = attachment.name;
      link.rel = 'noopener noreferrer';
      document.body.append(link);
      link.click();
      link.remove();
    } catch (openError) {
      setError(openError instanceof Error ? `Unable to open ${attachment.name}: ${openError.message}` : `Unable to open ${attachment.name}.`);
    }
  };

  const downloadPdf = (row: DataRow) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('The PDF window was blocked. Allow pop-ups for this site and try again.');
      return;
    }
    const body = documentBody(row);
    const title = String(row.title ?? 'Secretariat document');
    const metadata = [
      typeLabel(row.document_type),
      `Document date: ${formattedDate(dateValueForRow(row))}`,
      body.meeting_time ? `Time: ${body.meeting_time}` : null,
      `Created: ${formattedCreatedDate(row.created_at)}`,
    ].filter(Boolean).join(' · ');
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
      @page{size:auto;margin:22mm 20mm}
      *{box-sizing:border-box}
      body{max-width:760px;margin:36px auto;padding:0 24px;color:#24342d;font:15px/1.7 Cambria,Georgia,serif}
      h1{margin:0 0 10px;color:#173a36;font:700 28px/1.2 Cambria,Georgia,serif}
      .meta{margin:0 0 25px;padding-bottom:14px;border-bottom:1px solid #cbd6d0;color:#526960;font:12px/1.6 Arial,sans-serif}
      main{overflow-wrap:anywhere}p{margin:0 0 12px}h2,h3{margin:20px 0 8px;line-height:1.3}
      ul,ol{padding-left:24px}blockquote{margin:14px 0;padding-left:14px;border-left:3px solid #8a6b1b;color:#526960}
      hr{border:0;border-top:1px solid #cbd6d0}
      @media print{body{margin:0 auto;padding:0}h1,h2,h3{break-after:avoid}}
    </style></head><body><h1>${escapeHtml(title)}</h1><p class="meta">${escapeHtml(metadata)}</p><main>${documentHtml(row) || '<p>No document content.</p>'}</main></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  };

  const completeSave = async (message?: string) => {
    setLoading(true);
    await refresh();
    if (message) setError(message);
    setEditing(null);
    setPage('list');
  };

  if (page === 'editor') {
    return <DocumentEditor
      document={editing}
      userId={user?.id}
      onCancel={() => { setEditing(null); setPage('list'); }}
      onSaved={(message) => void completeSave(message)}
    />;
  }
  if (page === 'upload') {
    return <UploadedDocumentEditor
      document={editing}
      userId={user?.id}
      onCancel={() => { setEditing(null); setPage('list'); }}
      onSaved={(message) => void completeSave(message)}
    />;
  }

  const isUploadsPage = mode === 'uploads';
  return (
    <section className="secretariat-documents">
      <div className="secretariat-document-toolbar">
        <div><span className="eyebrow">{isUploadsPage ? 'Private document library' : 'Secretariat documents'}</span><p>{isUploadsPage ? 'Securely store completed records and supporting documents.' : 'Create, review, and maintain internal minutes, memos, and reports.'}</p></div>
        <button type="button" className="button button-primary" onClick={() => { setEditing(null); setPage(isUploadsPage ? 'upload' : 'editor'); }}><Plus size={15} />{isUploadsPage ? 'Upload documents' : 'New document'}</button>
      </div>
      {error && <div role="alert" className="form-message error">{error}</div>}
      {loading ? <div className="loading-inline"><LoaderCircle className="spin" size={16} /> Loading documents…</div>
        : visibleRows.length === 0 ? <div className="empty-state">{isUploadsPage ? 'No uploaded documents yet. Upload a completed record to get started.' : 'No documents yet. Create the first Secretariat document.'}</div>
          : <div className="secretariat-document-grid">{visibleRows.map((row) => {
            const id = String(row.id ?? '');
            const attachments = documentAttachments(row);
            return <article className="secretariat-document-card" key={id}>
              <button type="button" className="secretariat-document-open" aria-label={`Preview ${String(row.title ?? 'document')}`} onClick={() => { setError(null); setPreviewDocument(row); }}>
                <span className="secretariat-document-card-meta"><span className="pill pill-gold">{typeLabel(row.document_type)}</span><time dateTime={String(row.meeting_date ?? row.created_at ?? '')}>{formattedDate(dateValueForRow(row))}</time></span>
                <span className="secretariat-paper-preview">
                  {isUploadsPage
                    ? <span className="secretariat-file-preview"><FileText size={25} /><strong>{attachments[0]?.name ?? 'Uploaded record'}</strong><span>{attachments.length > 1 ? `+ ${attachments.length - 1} more file${attachments.length === 2 ? '' : 's'}` : 'Private file'}</span></span>
                    : <span className="secretariat-paper-content">{documentPlainText(documentHtml(row)) || 'Start writing your document…'}</span>}
                </span>
                <span className="secretariat-document-card-content"><strong>{String(row.title ?? 'Untitled document')}</strong><span>Created {formattedCreatedDate(row.created_at)}{documentBody(row).meeting_time ? ` · ${String(documentBody(row).meeting_time)}` : ''}</span></span>
                <span className="secretariat-document-open-hint"><Eye size={13} /> Click to preview</span>
              </button>
              {isUploadsPage && attachments.length > 0 && <div className="secretariat-attachment-actions">{attachments.map((attachment) => <button key={attachment.path} type="button" className="text-button" onClick={() => void openAttachment(attachment)}>{attachment.name}</button>)}</div>}
              <div className="secretariat-document-actions">
                <button type="button" className="button button-outline button-small" disabled={busy} onClick={() => { setEditing(row); setPage(isUploadsPage ? 'upload' : 'editor'); }}><Pencil size={13} /> Edit</button>
                <button type="button" className="button button-danger button-small" disabled={busy} onClick={() => setConfirmingId(confirmingId === id ? null : id)}><Trash2 size={13} /> Delete</button>
              </div>
              {confirmingId === id && <div className="secretariat-delete-confirm" role="group" aria-label={`Confirm delete ${String(row.title ?? 'document')}`}><span>Delete this document{attachments.length ? ' and its files' : ''} permanently?</span><button type="button" className="button button-danger button-small" disabled={busy} onClick={() => void removeDocument(row)}>{busy ? 'Deleting…' : 'Confirm delete'}</button><button type="button" className="button button-outline button-small" disabled={busy} onClick={() => setConfirmingId(null)}>Cancel</button></div>}
            </article>;
          })}</div>}
      {previewDocument && <div className="modal-backdrop secretariat-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewDocument(null); }}>
        <section className="modal secretariat-document-modal" role="dialog" aria-modal="true" aria-labelledby="secretariat-preview-title">
          <header className="modal-header secretariat-preview-header">
            <div className="secretariat-preview-heading"><span className="eyebrow">{typeLabel(previewDocument.document_type)}</span><h2 id="secretariat-preview-title">{String(previewDocument.title ?? 'Untitled document')}</h2><p>{formattedDate(dateValueForRow(previewDocument))}{documentBody(previewDocument).meeting_time ? ` · ${String(documentBody(previewDocument).meeting_time)}` : ''} · Created {formattedCreatedDate(previewDocument.created_at)}</p></div>
            <div className="secretariat-preview-actions">
              {!isUploadedDocument(previewDocument) && <button type="button" className="button button-primary button-small" onClick={() => downloadPdf(previewDocument)}><Download size={14} /> Download PDF</button>}
              <button type="button" className="icon-button" aria-label="Close document preview" onClick={() => setPreviewDocument(null)}><X size={17} /></button>
            </div>
          </header>
          <div className="secretariat-document-preview-body">
            {error && <div role="alert" className="form-message error">{error}</div>}
            {isUploadedDocument(previewDocument) ? <>
              {documentBody(previewDocument).description && <p className="secretariat-upload-description">{documentBody(previewDocument).description}</p>}
              <h3>Attached files</h3>
              <div className="secretariat-preview-attachments">{documentAttachments(previewDocument).map((attachment) => <button key={attachment.path} type="button" className="button button-outline" onClick={() => void openAttachment(attachment)}><FileText size={15} />{attachment.name}</button>)}</div>
            </> : <div className="secretariat-document-rich-content" dangerouslySetInnerHTML={{ __html: documentHtml(previewDocument) || '<p>No document content.</p>' }} />}
          </div>
        </section>
      </div>}
    </section>
  );
}

function DocumentEditor({ document: row, userId, onCancel, onSaved }: { document: DataRow | null; userId?: string; onCancel: () => void; onSaved: (message?: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const body = row ? documentBody(row) : {};
  const [today] = useState(() => localDateValue());
  const [title, setTitle] = useState(String(row?.title ?? ''));
  const [documentType, setDocumentType] = useState(String(row?.document_type ?? 'meeting_minutes'));
  const [date, setDate] = useState(() => String(row?.meeting_date ?? localDateValue()));
  const [time, setTime] = useState(String(body.meeting_time ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = documentHtml(row ?? {});
  }, [row]);

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
  };

  const formatSelection = (command: 'bold' | 'italic' | 'underline') => {
    editorRef.current?.focus();
    document.execCommand(command);
  };

  const applyColor = (color: string) => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    const savedRange = savedSelectionRef.current;
    if (selection && savedRange && editorRef.current?.contains(savedRange.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    document.execCommand('foreColor', false, color);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const html = sanitizeDocumentHtml(editorRef.current?.innerHTML ?? '');
    if (title.trim().length < 2) {
      setError('Enter a document title with at least two characters.');
      return;
    }
    if (!documentPlainText(html)) {
      setError('Write some content before saving the document.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const values: DataRow = {
        title: title.trim(),
        document_type: documentType,
        meeting_date: date || null,
        body: { kind: 'editor', html, meeting_time: time || null },
        status: 'final',
        ...(userId ? { [row ? 'updated_by' : 'created_by']: userId } : {}),
      };
      await saveAdminRow('secretariat_documents', values, typeof row?.id === 'string' ? row.id : undefined);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this document.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="secretariat-editor-page">
    <button type="button" className="workspace-back-link" onClick={onCancel}><ArrowLeft size={14} /> Back to documents</button>
    <div className="secretariat-editor-heading"><div><span className="eyebrow">{row ? 'Edit document' : 'New document'}</span><h2>{row ? 'Update your document' : 'Create a Secretariat document'}</h2><p>The creation date is saved automatically with this record.</p></div><div className="secretariat-generated-date"><CalendarDays size={15} /><span>{formattedDate(row?.created_at ?? today)}</span></div></div>
    <form className="secretariat-editor-form" onSubmit={(event) => void save(event)}>
      <div className="secretariat-editor-details">
        <label className="field"><span className="field-label">Document title *</span><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} maxLength={200} /></label>
        <label className="field"><span className="field-label">Document type</span><select className="select" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>{documentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label className="field"><span className="field-label">Document date</span><input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label className="field"><span className="field-label">Time</span><span className="secretariat-time-input"><Clock3 size={15} /><input className="input" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></span></label>
      </div>
      <div className="secretariat-rich-editor">
        <div className="secretariat-editor-toolbar" role="toolbar" aria-label="Document formatting">
          <button type="button" aria-label="Bold" title="Bold" onMouseDown={(event) => { event.preventDefault(); formatSelection('bold'); }}><Bold size={16} /></button>
          <button type="button" aria-label="Italic" title="Italic" onMouseDown={(event) => { event.preventDefault(); formatSelection('italic'); }}><Italic size={16} /></button>
          <button type="button" aria-label="Underline" title="Underline" onMouseDown={(event) => { event.preventDefault(); formatSelection('underline'); }}><Underline size={16} /></button>
          <label className="secretariat-color-control" title="Text color"><span>Text color</span><input type="color" aria-label="Text color" defaultValue="#805d00" onPointerDown={rememberSelection} onChange={(event) => applyColor(event.target.value)} /></label>
        </div>
        <div ref={editorRef} className="secretariat-rich-content" contentEditable role="textbox" aria-label="Document content" aria-multiline="true" data-placeholder="Write your meeting minutes, memo, report, or other document here…" onMouseUp={rememberSelection} onKeyUp={rememberSelection} />
      </div>
      {error && <div role="alert" className="form-message error">{error}</div>}
      <div className="secretariat-editor-actions"><button type="button" className="button button-outline" disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : row ? 'Save changes' : 'Save document'}<Check size={14} /></button></div>
    </form>
  </section>;
}

function UploadedDocumentEditor({ document: row, userId, onCancel, onSaved }: { document: DataRow | null; userId?: string; onCancel: () => void; onSaved: (message?: string) => void }) {
  const body = row ? documentBody(row) : {};
  const originalAttachments = row ? documentAttachments(row) : [];
  const [today] = useState(() => localDateValue());
  const [title, setTitle] = useState(String(row?.title ?? ''));
  const [documentType, setDocumentType] = useState(String(row?.document_type ?? 'report'));
  const [date, setDate] = useState(() => String(row?.meeting_date ?? localDateValue()));
  const [description, setDescription] = useState(String(body.description ?? body.text ?? ''));
  const [attachments] = useState(originalAttachments);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (title.trim().length < 2) {
      setError('Enter a document title with at least two characters.');
      return;
    }
    if (!attachments.length && !files.length) {
      setError('Choose at least one PDF, Word, text, or RTF file.');
      return;
    }
    setBusy(true);
    setError(null);
    const uploaded: DocumentAttachment[] = [];
    try {
      const client = getSupabaseClient();
      if (files.length && !userId) throw new Error('Your session expired. Sign in again before uploading files.');
      for (const file of files) {
        if (!isAllowedFile(file)) throw new Error(`${file.name} is not a supported file. Choose PDF, DOC/DOCX, TXT, or RTF.`);
        if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is larger than the 20 MB limit.`);
        const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;
        const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
        const inferredTypes: Record<string, string> = {
          pdf: 'application/pdf',
          doc: 'application/msword',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          txt: 'text/plain',
          rtf: 'application/rtf',
        };
        const { error: uploadError } = await client.storage.from('secretariat-documents').upload(path, file, {
          contentType: file.type || inferredTypes[extension],
          upsert: false,
        });
        if (uploadError) throw new Error(`Could not upload ${file.name}: ${uploadError.message}`);
        uploaded.push({ path, name: file.name, size: file.size, type: file.type });
      }
      const values: DataRow = {
        title: title.trim(),
        document_type: documentType,
        meeting_date: date || null,
        body: { kind: 'upload', description: description.trim(), attachments: [...attachments, ...uploaded] },
        status: 'final',
        ...(userId ? { [row ? 'updated_by' : 'created_by']: userId } : {}),
      };
      await saveAdminRow('secretariat_documents', values, typeof row?.id === 'string' ? row.id : undefined);
      let saveMessage: string | undefined;
      if (removedPaths.length) {
        const { error: removeError } = await client.storage.from('secretariat-documents').remove(removedPaths);
        if (removeError) saveMessage = `The record was saved, but some removed files could not be deleted: ${removeError.message}`;
      }
      onSaved(saveMessage);
    } catch (saveError) {
      let cleanupMessage = '';
      if (uploaded.length) {
        try {
          const { error: cleanupError } = await getSupabaseClient().storage.from('secretariat-documents').remove(uploaded.map((item) => item.path));
          if (cleanupError) cleanupMessage = ` Uploaded files could not be cleaned up: ${cleanupError.message}`;
        } catch (cleanupError) {
          cleanupMessage = ` Uploaded files could not be cleaned up: ${cleanupError instanceof Error ? cleanupError.message : 'storage cleanup failed.'}`;
        }
      }
      setError(`${saveError instanceof Error ? saveError.message : 'Unable to save this upload.'}${cleanupMessage}`);
    } finally {
      setBusy(false);
    }
  };

  return <section className="secretariat-editor-page">
    <button type="button" className="workspace-back-link" onClick={onCancel}><ArrowLeft size={14} /> Back to uploaded docs</button>
    <div className="secretariat-editor-heading"><div><span className="eyebrow">{row ? 'Edit uploaded documents' : 'Secure upload'}</span><h2>{row ? 'Update uploaded record' : 'Upload completed records'}</h2><p>Private files are limited to PDF, DOC/DOCX, TXT, or RTF; up to 20 MB each.</p></div><div className="secretariat-generated-date"><CalendarDays size={15} /><span>{formattedDate(row?.created_at ?? today)}</span></div></div>
    <form className="secretariat-upload-form" onSubmit={(event) => void save(event)}>
      <div className="secretariat-editor-details">
        <label className="field"><span className="field-label">Record title *</span><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} maxLength={200} /></label>
        <label className="field"><span className="field-label">Document type</span><select className="select" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>{documentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label className="field"><span className="field-label">Record date</span><input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label className="field field-span"><span className="field-label">Notes (optional)</span><textarea className="textarea" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      </div>
      <label className="image-upload-button"><FileUp size={16} />Choose files<input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf,application/x-rtf,text/rtf" multiple onChange={(event) => {
        const selected = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = '';
        const invalid = selected.find((file) => !isAllowedFile(file) || file.size > 20 * 1024 * 1024);
        if (invalid) {
          setError(!isAllowedFile(invalid) ? `${invalid.name} is not supported. Choose PDF, DOC/DOCX, TXT, or RTF.` : `${invalid.name} is larger than the 20 MB limit.`);
          return;
        }
        setError(null);
        setFiles((current) => [...current, ...selected]);
      }} /></label>
      <span className="field-hint">Allowed formats: PDF, Word (.doc/.docx), text (.txt), and rich text (.rtf). Maximum 20 MB per file.</span>
      {(attachments.length > 0 || files.length > 0) && <ul className="document-attachment-list">{attachments.filter((item) => !removedPaths.includes(item.path)).map((attachment) => <li key={attachment.path}><FileText size={14} /><span>{attachment.name}</span><button type="button" className="button button-outline button-small" onClick={() => setRemovedPaths((current) => [...current, attachment.path])}>Remove</button></li>)}{files.map((file, index) => <li key={`${file.name}-${index}`}><FileText size={14} /><span>{file.name} · ready to upload</span><button type="button" className="button button-outline button-small" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>Remove</button></li>)}</ul>}
      {error && <div role="alert" className="form-message error">{error}</div>}
      <div className="secretariat-editor-actions"><button type="button" className="button button-outline" disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : row ? 'Save changes' : 'Save uploaded docs'}<Check size={14} /></button></div>
    </form>
  </section>;
}
