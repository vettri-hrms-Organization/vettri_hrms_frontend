import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eraser, PenLine, Upload } from 'lucide-react';
import { esignApi, errorText } from '../../api/endpoints/workflows';
import Button from '../../components/ui/Button';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

/** The caller's saved signature picture as an object URL (null when none is saved). */
export function useMySignature() {
  const info = useQuery({ queryKey: ['my-signature'], queryFn: esignApi.mySignatureInfo });
  const image = useQuery({
    queryKey: ['my-signature-image', info.data?.updatedAt],
    queryFn: esignApi.mySignature,
    enabled: !!info.data?.saved,
  });
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!image.data) { setUrl(null); return undefined; }
    const u = URL.createObjectURL(image.data);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [image.data]);
  return { saved: !!info.data?.saved, url, loading: info.isLoading || (info.data?.saved && image.isLoading) };
}

/**
 * Shows the saved signature, or lets the employee add one: upload a photo of it signed on white paper, or draw it
 * with a finger or mouse. The server removes the paper background and crops it before saving.
 */
export default function SignaturePad({ compact = false }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { saved, url, loading } = useMySignature();
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState('draw');
  const save = useMutation({
    mutationFn: ({ blob, source }) => esignApi.saveMySignature(blob, source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-signature'] });
      queryClient.invalidateQueries({ queryKey: ['my-signature-image'] });
      setEditing(false);
      toast.success('Signature saved. It will be added to every document you sign.');
    },
    onError: (e) => toast.error(errorText(e, 'Could not save your signature.')),
  });

  if (loading) return <SkeletonText lines={2} />;

  if (saved && url && !editing) {
    return (
      <div className="d-flex flex-wrap align-items-center gap-3">
        <div className="esign-sig-preview"><img src={url} alt="Your saved signature" /></div>
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Change signature</Button>
      </div>
    );
  }

  return (
    <div className="d-grid gap-2">
      {!compact && !saved && <p className="mb-0" style={{ fontSize: 13 }}>Add your signature once. Vettri keeps it and adds it to every document you sign.</p>}
      <div className="btn-group" role="group" aria-label="How to add your signature">
        <button type="button" className={`btn btn-sm ${mode === 'draw' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setMode('draw')}><PenLine size={14} /> Draw it</button>
        <button type="button" className={`btn btn-sm ${mode === 'upload' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setMode('upload')}><Upload size={14} /> Upload a photo</button>
      </div>
      {mode === 'draw'
        ? <DrawPad busy={save.isPending} onSave={(blob) => save.mutate({ blob, source: 'DRAWN' })} />
        : <UploadPicker busy={save.isPending} onSave={(file) => save.mutate({ blob: file, source: 'UPLOAD' })} />}
      {saved && <div><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Keep my current signature</Button></div>}
    </div>
  );
}

function UploadPicker({ busy, onSave }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="d-grid gap-2">
      <label className="form-label mb-0" htmlFor="esign-sig-file" style={{ fontSize: 13 }}>
        Sign on white paper with a dark pen, then take a clear photo of it. PNG or JPG, up to 3 MB.
      </label>
      <input id="esign-sig-file" type="file" accept="image/png,image/jpeg" className="form-control form-control-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      {preview && <div className="esign-sig-preview"><img src={preview} alt="The photo you picked" /></div>}
      <div><Button size="sm" disabled={!file} loading={busy} onClick={() => onSave(file)}>Save signature</Button></div>
    </div>
  );
}

function DrawPad({ busy, onSave }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#14205a';
  }, []);

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const start = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const p = point(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  };
  const end = () => { drawing.current = false; };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  };
  const save = () => {
    // The server reads ink as dark-on-light, so export on a white ground.
    const src = canvasRef.current;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    out.toBlob((blob) => blob && onSave(new File([blob], 'signature.png', { type: 'image/png' })), 'image/png');
  };

  return (
    <div className="d-grid gap-2">
      <canvas
        ref={canvasRef}
        className="esign-sig-canvas"
        aria-label="Draw your signature here"
        role="img"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
      />
      <div className="d-flex gap-2">
        <Button size="sm" disabled={empty} loading={busy} onClick={save}>Save signature</Button>
        <Button size="sm" variant="secondary" icon={Eraser} disabled={empty} onClick={clear}>Clear</Button>
      </div>
    </div>
  );
}
