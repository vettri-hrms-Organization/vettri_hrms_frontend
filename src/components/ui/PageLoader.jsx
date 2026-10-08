import { vettriMicrocopy } from '../../utils/vettriMicrocopy';

export default function PageLoader() {
  return (
    <div className="hz-page-loader">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">{vettriMicrocopy.loading.workspace}</span>
      </div>
    </div>
  );
}
