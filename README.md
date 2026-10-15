# Prototype 02: the full app

A clickable prototype of the Enertiv web app as Project Kilowatt specifies it
(`github.com/brenertiv/project-kilowatt`). It builds on prototype 01's
navigation shell and fills every in-scope section with working pages on
synthetic scenario data: Workspace with the AI assistant, Building Info,
People, Notifications, Account settings and First App Onboarding. Tenant
Billing and Maintenance are upgrade pages, as the MVP boundary says.

Specs it follows: `02-building/01-prototype-plan.md`, every spec in
`02-building/system/`, the section specs `modules/workspace.md`,
`building-info.md` and `people.md`, the entitlement specs, and
`journeys-and-prototypes/prototype-data.md` for scenarios and state IDs. The
test contract is `skills/kilowatt-prototype-testing/test-config.md`.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5176. `npm run build` pulls the snapshot (when one is
pinned), type-checks and bundles. `/reset` clears everything the session
stored and starts again.

## Test links (JNY-DATA-09 to 12)

Review mode is the default. The flask button at the bottom right opens the test
panel: scenario, persona, role, first login, API delay and errors, generation
time and failure, theme, a state index and presets, plus the data source and
build commit.

| Link | Opens |
|---|---|
| `/?scenario=SC-1&persona=sl&role=admin` | Any scenario, persona and role |
| `/?state=ST-Q08` | A state from `test-states.json` (here the Charlotte one-line diagram) |
| `/?state=ST-P07` | First login: welcome, jobs, building the first workspace |
| `/?latency=2000` or `/?fail=*` | Loading and error states |
| `/?gen-delay=12000` or `/?gen-fail=1` | Slow or failing generation |
| `/?session=r1-sl&p=P01` | Session mode: locks the preset from `test-presets.json` and hides every test control |

Scenarios: SC-1 industrial portfolio (48 buildings, mostly tier 1, Carbon
Planning not bought), SC-2 mixed-tier office portfolio (the default), SC-3
owner with management firms, SC-4 single property, SC-5 new account mid-setup,
SC-6 demo. Stand-in users: Maya Chen (Sustainability Lead), David Okafor (Asset
Manager), Rosa Alvarez (Property Manager), Priya Shah (Admin, the inviter).

## What to try

- **Workspace (the home).** Each persona lands on its own default: Reporting
  readiness, Exposure by asset or Data problems to fix. Every number opens
  where it came from. **New** builds a workspace from a template, a description
  or the carbon plan wizard, with the steps shown in the assistant and the
  build carrying on if you leave. Report workspaces have a schedule and run
  history; Share sends a colleague their own copy.
- **The assistant** (sparkle, top right) answers from the data with sources,
  asks before acting, edits the cards you add to the thread ("make this
  monthly"), and builds dashboards on request.
- **Building Info.** Seven pages that work at every scope: the stacking plan,
  Data Health (items with their fix actions, setup progress, meter health),
  Buildings (Overview, Spaces, Utilities with the ENERGY STAR writer timeline,
  Power with the generated one-line diagram, Compliance, Activity), Equipment
  (alerts and alert rules at tier 3, edits behind a survey-overwrite warning),
  Meters, Bills with Accounts, and Files.
- **People.** Team and teams, tenants and chase requests, partners, who's who
  per building, and the chase agent's page with its approval queue. Admins
  invite from the panel.
- **Scope.** The indicator's last crumb opens the scope navigator (search,
  recent and pinned, columns per level); earlier crumbs go up a level. The
  scope is in the URL: `/{company}/{scope}/…`.

## What's simulated

- **Data.** Deterministic synthetic data in `src/data/generate.ts`, with no
  real client names, addresses or identifiers. `scripts/pull-snapshot.mjs`
  implements the snapshot pull contract, but the app does not read
  `src/.snapshot/` yet: that needs an adapter from the snapshot's shape, which
  isn't defined.
- **Writes.** Every change is a patch in a browser overlay (`localStorage`,
  per scenario). Nothing is sent: invites, chase messages, tickets, report
  emails and ENERGY STAR pushes end in a confirmation.
- **The assistant.** Rule-based answers over the data, not a language model. It
  chooses and arranges components and never invents numbers.
- **Two rules of thumb.** The plan's CRREM line is a fixed 7% yearly decline,
  and goal progress is measured year over year. Both say so in their source
  popover.

## Known gaps

- No image or PDF export of the one-line diagram (CSV of the record only).
- Tenant coverage is shown by month, not by day (MOD-BI-11).
- No record of past projects and quotes (MOD-WS-24, a Should).
- No control for granting the chase-agent permission to an individual Operator.
- Switching Company only names the other company; each scenario holds one.

## Testing

Hosting, password protection, rounds, session links and tester silos follow the
`kilowatt-prototype-testing` skill (`skills/kilowatt-prototype-testing/` in the
Kilowatt repo) and `03-testing/03-test-environment.md`.

- `vercel.json` has the single-page-app rewrite and the no-index header.
- `test-presets.json` holds one preset per persona per round (`r1-sl`, `r1-am`,
  `r1-pm`); `test-states.json` maps state IDs to a scenario and route.
- `scripts/pull-snapshot.mjs` runs first in `npm run build`. With no
  `KILOWATT_SNAPSHOT_VERSION` it writes nothing and the app uses synthetic data;
  with one, it fails the build rather than fall back.
- Password Protection (scope All Deployments) must be on before any deployment
  that holds snapshot data. Passwords and tokens are typed by a person, never
  committed.
- Telemetry (Mixpanel events with round, preset, participant, commit, snapshot
  version and mode) is not built yet.

## Stack

Vite, React 18, TypeScript, React Router 6, plain CSS with semantic tokens for
light and dark, Material Symbols. The production prototype's stack (MUI, Redux,
TanStack Query) is in `04-handoff/technical-approach/stack-and-architecture.md`;
this prototype keeps prototype 01's lighter stack so the team can test the
content and flows first.
