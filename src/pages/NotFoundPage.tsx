import { Link, useLocation } from 'react-router-dom';
import { useNav } from '../nav/route';

export function NotFoundPage() {
  const { pathname } = useLocation();
  const { to } = useNav();
  return (
    <article className="page">
      <p className="eyebrow">Not a page</p>
      <h1>Nothing at this address</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        <code>{pathname}</code> isn't a page, or the object it pointed to isn't in this scenario.
      </p>
      <Link className="btn" to={to('/workspace')}>
        Go to your workspace
      </Link>
    </article>
  );
}
