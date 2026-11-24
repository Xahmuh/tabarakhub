import { useState } from 'react';
import { saveAs } from 'file-saver';
import { BackToModulesButton } from '../shared/BackToModulesButton';
import { squeezeLmraFile, type CompressedPage } from '../lib/lmraImageCompression';

export function SqueezeLmraFiles({ onBack }: { onBack: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [failures, setFailures] = useState<string[]>([]);
  const [pages, setPages] = useState<CompressedPage[]>([]);
  const [archive, setArchive] = useState<Blob>();
  const [downloadError, setDownloadError] = useState(false);

  async function download(results: CompressedPage[]) {
    if (results.length === 1) {
      saveAs(results[0].blob, results[0].name);
      return;
    }
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    for (const result of results) zip.file(result.name, result.blob);
    const blob = await zip.generateAsync({ type: 'blob' });
    setArchive(blob);
    saveAs(blob, 'LMRA-files.zip');
  }

  async function squeezeAll() {
    if (busy || !files.length) return;
    setBusy(true);
    setPages([]);
    setArchive(undefined);
    setFailures([]);
    setDownloadError(false);
    const results: CompressedPage[] = [];
    const errors: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Processing file ${index + 1} of ${files.length}: ${file.name}`);
        try {
          await squeezeLmraFile(file, files.length > 1 ? `${index + 1}-` : '', page => results.push(page));
        } catch (error) {
          errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Could not convert this file.'}`);
        }
      }
      setFailures(errors);
      setPages(results);
      if (results.length) {
        setProgress('Preparing download…');
        await download(results);
      }
    } catch {
      setDownloadError(true);
    } finally {
      setProgress('');
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-4 px-3 py-5 sm:px-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-950">SQUEEZE LMRA FILES</h1>
        <BackToModulesButton onClick={onBack} />
      </header>
      <div className="operational-panel space-y-4 p-4 sm:p-6">
        <p className="text-sm text-slate-700">Convert images and PDF pages into separate JPG files, each no larger than 150 KB.</p>
        <label className="block space-y-2 text-sm font-semibold">
          <span>PDFs and images</span>
          <input type="file" multiple accept="application/pdf,.pdf,image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.svg,.tif,.tiff,.heic,.heif"
            disabled={busy} className="block min-h-11 w-full"
            onChange={event => {
              setFiles(Array.from(event.target.files ?? []));
              setPages([]);
              setArchive(undefined);
              setFailures([]);
              setDownloadError(false);
            }} />
        </label>
        <button type="button" className="btn-primary min-h-11 px-4" disabled={busy || files.length === 0}
          onClick={() => void squeezeAll()}>Squeeze all</button>
        {progress && <p role="status" className="break-words text-sm text-slate-700">{progress}</p>}
        {failures.length > 0 && (
          <ul role="alert" className="list-disc space-y-1 break-words pl-5 text-sm text-red-700">
            {failures.map((failure, index) => <li key={index}>{failure}</li>)}
          </ul>
        )}
        {downloadError && <p role="alert" className="text-sm text-red-700">Could not package the download. You can download each JPG below.</p>}
        {pages.length > 0 && (
          <div className="space-y-2">
            <p role="status" className="text-sm font-semibold text-slate-700">{pages.length} JPG files ready</p>
            {archive && <button type="button" className="btn-secondary min-h-10 px-3" onClick={() => saveAs(archive, 'LMRA-files.zip')}>Download ZIP</button>}
            <ul className="divide-y divide-slate-200">
              {pages.map(page => (
                <li key={page.name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="break-all">{page.name} · {(page.blob.size / 1000).toFixed(1)} KB</span>
                  <button type="button" className="btn-secondary min-h-10 px-3" onClick={() => saveAs(page.blob, page.name)}>Download JPG</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
