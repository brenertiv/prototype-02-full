/**
 * Files (MOD-BI-09, 50): every property, equipment and accolade file in scope, and a page per
 * file with what it is attached to and its activity.
 */
import { Link } from 'react-router-dom';
import { useApi, useData, useLookup } from '../data/store';
import type { ActivityItem, FileRec } from '../data/types';
import { useNav } from '../nav/route';
import { Icon } from '../shell/Icon';
import { DataTable, RecordTable } from '../ui/DataTable';
import { ApiView, EmptyState, PageHeader, Pill, Section, SelectFilter } from '../ui/bits';
import { fmtDate } from '../ui/format';
import { ActivityTab, BuildingFilter, coverCaption, NotFoundObject, Page, TODAY, Toolbar, useObjectHref, useParamFilter, useScoped } from './shared';

const CATEGORIES: FileRec['category'][] = ['Lease', 'Drawing', 'Survey photo', 'Certificate', 'LOA', 'Nameplate', 'Report', 'Other'];
const CATEGORY_TEXT: Record<FileRec['category'], string> = { Lease: 'Lease', Drawing: 'Drawing', 'Survey photo': 'Survey photo', Certificate: 'Certificate', LOA: 'Letter of authorisation', Nameplate: 'Nameplate photo', Report: 'Report', Other: 'Other' };
const KIND_TEXT: Record<string, string> = { building: 'Building', equipment: 'Equipment', tenant: 'Tenant', meter: 'Meter', account: 'Utility account' };

export function FilesPage() {
  const { data } = useData();
  const { building } = useLookup();
  const { scope, ids, buildings, showBuilding } = useScoped();
  const { to } = useNav();
  const href = useObjectHref();
  const [fb, setFb] = useParamFilter('building');
  const [fc, setFc] = useParamFilter('category');
  const [fk, setFk] = useParamFilter('attached');
  const q = useApi(`building-info/files/${scope.id}`, () => data.files.filter((f) => ids.has(f.buildingId)), [data.files, ids]);
  const all = q.data ?? [];
  const rows = all.filter((f) => (fb === 'all' || f.buildingId === fb) && (fc === 'all' || f.category === fc) && (fk === 'all' || f.attachedTo.kind === fk));
  return (
    <Page>
      <PageHeader title="Files" subtitle="Drawings, certificates, letters of authorisation and nameplate photos for the buildings in scope, and what each is attached to." />
      <ApiView q={q} what="files">
        {() => (
          <>
            <Toolbar>
              <BuildingFilter buildings={buildings} value={fb} onChange={setFb} />
              <SelectFilter label="Category" value={fc} onChange={setFc} options={[{ value: 'all', label: 'Any category' }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_TEXT[c] }))]} />
              <SelectFilter label="Attached to" value={fk} onChange={setFk} options={[{ value: 'all', label: 'Attached to anything' }, { value: 'building', label: 'Buildings' }, { value: 'equipment', label: 'Equipment' }, { value: 'tenant', label: 'Tenants' }]} />
            </Toolbar>
            <DataTable<FileRec>
              label="Files"
              rows={rows}
              rowKey={(f) => f.id}
              rowHref={(f) => to(`/building-info/files/${f.id}`)}
              search={(f) => `${f.name} ${f.description} ${f.attachedTo.label}`}
              searchPlaceholder="Search files"
              caption={coverCaption(rows.length, rows.length === 1 ? 'file' : 'files', scope, buildings.length)}
              initialSort={{ key: 'uploaded', dir: 'desc' }}
              empty={{ title: all.length ? 'No files match these filters' : 'No files yet', body: all.length ? 'Clear a filter to see more.' : 'Files added in the Survey App or on a building show here.', icon: 'folder' }}
              columns={[
                { key: 'name', header: 'File', value: (f) => f.name },
                { key: 'type', header: 'Type', value: (f) => f.fileType, hideOnPhone: true },
                ...(showBuilding ? [{ key: 'building', header: 'Building', value: (f: FileRec) => building.get(f.buildingId)?.name ?? '' }] : []),
                { key: 'attached', header: 'Attached to', value: (f) => f.attachedTo.label, render: (f) => <Link to={href(f.attachedTo)}>{f.attachedTo.label}</Link>, hideOnPhone: true },
                { key: 'category', header: 'Category', value: (f) => CATEGORY_TEXT[f.category] },
                { key: 'start', header: 'Start', value: (f) => f.start, render: (f) => fmtDate(f.start), hideOnPhone: true },
                { key: 'expiry', header: 'Expires', value: (f) => f.expiry, render: (f) => (f.expiry && f.expiry < TODAY ? <Pill tone="warning">Expired {fmtDate(f.expiry)}</Pill> : fmtDate(f.expiry)), hideOnPhone: true },
                { key: 'uploaded', header: 'Uploaded', value: (f) => f.uploaded, render: (f) => fmtDate(f.uploaded) },
                { key: 'by', header: 'Uploaded by', value: (f) => f.uploadedBy, hideOnPhone: true },
              ]}
            />
          </>
        )}
      </ApiView>
    </Page>
  );
}

export function FileDetail({ id }: { id: string }) {
  const { data, accessible } = useData();
  const { building } = useLookup();
  const { to } = useNav();
  const href = useObjectHref();
  const q = useApi(`building-info/files/${id}`, () => data.files.find((f) => f.id === id) ?? null, [data.files, id]);
  if (q.status === 'ready' && !q.data) return <NotFoundObject what="file" backTo={to('/building-info/files')} backLabel="Back to files" />;
  return (
    <Page>
      <ApiView q={q} what="this file">
        {(f) => {
          const b = building.get(f.buildingId);
          if (!b || !accessible.has(b.id)) return <EmptyState icon="lock" title="You don't have access to this building" body="Ask your Admin to add it to your scope." />;
          const also = data.accolades.filter((a) => a.buildingId === b.id && f.category === 'Certificate' && f.name.startsWith(a.name));
          const created: ActivityItem = { id: `act-file-${f.id}`, at: `${f.uploaded}T10:00:00`, who: f.uploadedBy, what: 'File uploaded', object: { kind: 'file', id: f.id, label: f.name }, buildingId: b.id };
          return (
            <>
              <PageHeader
                back={{ to: to('/building-info/files'), label: 'Files' }}
                eyebrow={
                  <>
                    {CATEGORY_TEXT[f.category]} · <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link>
                  </>
                }
                title={f.name}
              />
              <div className="bi-bill-layout">
                <Section title="File">
                  <RecordTable
                    label="File record"
                    rows={[
                      ['File name', f.name],
                      ['File type', f.fileType],
                      ['Building', <Link to={to(`/building-info/buildings/${b.id}`)}>{b.name}</Link>],
                      ['Attached to', <span>{KIND_TEXT[f.attachedTo.kind] ?? 'Object'}: <Link to={href(f.attachedTo)}>{f.attachedTo.label}</Link></span>],
                      ['Also attached to', also.length ? also.map((a) => `Accolade: ${a.name}`).join(', ') : <span className="muted">Nothing else</span>],
                      ['Category', CATEGORY_TEXT[f.category]],
                      ['Start date', fmtDate(f.start)],
                      ['Expiry date', fmtDate(f.expiry)],
                      ['Green lease', f.greenLease === undefined ? <span className="muted">Not applicable</span> : f.greenLease ? 'Yes' : 'No'],
                      ['Uploaded', fmtDate(f.uploaded)],
                      ['Uploaded by', f.uploadedBy],
                      ['Description', f.description || <span className="muted">No description</span>],
                    ]}
                  />
                </Section>
                <aside>
                  <div className="bi-pdf bi-file-preview" role="img" aria-label={`Preview of ${f.name}`}>
                    <Icon name={f.fileType === 'JPG' || f.fileType === 'PNG' ? 'image' : f.fileType === 'DWG' ? 'architecture' : f.fileType === 'XLSX' ? 'table' : 'picture_as_pdf'} />
                    <p>{f.name}</p>
                    <p className="muted">Preview. The file opens from storage in the live app.</p>
                  </div>
                </aside>
              </div>
              <Section title="Activity">
                <ActivityTab label="File activity" filter={(x) => x.object.id === f.id} extra={[created]} showObject={false} />
              </Section>
            </>
          );
        }}
      </ApiView>
    </Page>
  );
}
