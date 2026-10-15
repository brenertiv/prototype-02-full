import { useData } from '../data/store';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { Icon } from './Icon';

/** The Company modal: switch company, nothing else (SYS-NAVPAT-07, SYS-SCOPE-20). ST-N04. */
export function CompanyModal({ onClose }: { onClose: () => void }) {
  const { data } = useData();
  const toast = useToast();
  const companies = data.companies;

  return (
    <Modal title="Switch company" onClose={onClose} size="sm">
      <p className="muted" style={{ marginBottom: 12 }}>
        {companies.length === 1 ? 'You belong to one company. Managing teams and people is in the People section.' : 'Choosing a company switches the whole app to it and its last-used scope.'}
      </p>
      <ul className="company-list">
        {companies.map((c) => {
          const current = c.id === data.company.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`company-option ${current ? 'is-current' : ''}`}
                aria-current={current ? 'true' : undefined}
                onClick={() => {
                  if (!current) toast(`${c.name} isn't in this scenario's data. In the real app the whole app would switch to it.`, { tone: 'info' });
                  onClose();
                }}
              >
                <span className="company-mark" aria-hidden="true">
                  {c.initials}
                </span>
                <span className="company-text">
                  <span className="company-name">{c.name}</span>
                  <span className="muted">
                    {c.membership}
                    {c.guest ? ' · invited from another firm' : ''}
                  </span>
                </span>
                {current && <Icon name="check" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
