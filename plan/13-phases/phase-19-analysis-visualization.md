# Phase 19 — Data Analysis & Visualization

> **Canonical execution file:** `plan/13-phases/phase-19-analysis-visualization.md`

## Objective

Provide reproducible lightweight analysis without turning core application servers into unsafe compute hosts.

## Owning specifications

- [05-datasets-cleaning.md](../09-reporting-analysis/05-datasets-cleaning.md)
- [06-analysis-notebooks.md](../09-reporting-analysis/06-analysis-notebooks.md)
- [07-visualizations-dashboards.md](../09-reporting-analysis/07-visualizations-dashboards.md)

## Prerequisites

- [ ] Phase 18 passed.
- [ ] Dataset/storage/code document models stable.

## Required deliverables

- [ ] Dataset ingest/profile.
- [ ] Cleaning/transformation recipe model.
- [ ] Transformation provenance/versioning.
- [ ] Summary statistics supported set.
- [ ] Chart builder and saved visualization specs.
- [ ] Dashboards composed of saved views/charts.
- [ ] Notebook-analysis integration.
- [ ] Export data/chart/report.
- [ ] Sandboxed compute provider boundary if server execution is enabled.

## Cross-cutting requirements

- Responsive phone/tablet/desktop behavior is implemented for every user-facing deliverable.
- Server-side authorization and tenant scope are mandatory for every workspace-owned operation.
- Error/loading/empty/denied/degraded states are explicit.
- Logs/metrics/traces are present for new critical backend behavior.
- Migrations are compatible with rolling deployment or have an explicit safe rollout plan.
- Expensive work uses queue/worker or streaming boundaries rather than blocking request capacity.

## Required test matrix

- [ ] Transformation reproducibility.
- [ ] Large dataset limits/spill strategy.
- [ ] Chart accessibility table/description fallback.
- [ ] Untrusted code isolation.
- [ ] Concurrent dashboard reads/cache.

## Exit gate

- [ ] Every transformation can identify source/version/parameters.
- [ ] Core API never executes arbitrary untrusted analysis code directly.

## Completion record

- Commit/PR:
- Migration(s):
- Staging deployment:
- Test evidence:
- Performance evidence:
- Deferred items:
- Approval/date: