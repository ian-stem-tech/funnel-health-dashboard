import { formatDate } from '../lib/types';

export function LastUpdated({
  iso,
  workflowUrl,
}: {
  iso: string;
  workflowUrl?: string;
}) {
  return (
    <footer className="dash-footer">
      <span>Last updated {formatDate(iso)}</span>
      {workflowUrl && (
        <a className="refresh-link" href={workflowUrl} target="_blank" rel="noreferrer noopener">
          ⟳ Trigger refresh
        </a>
      )}
    </footer>
  );
}
