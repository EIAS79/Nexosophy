# Exception 0001 — Main Branch Ruleset Enforcement Pending

> **Status:** Temporary operational exception  
> **Opened:** 2026-10-05  
> **Owner:** Nexosophy repository owner  
> **Expiry:** Before controlled public beta, and preferably as soon as repository settings can be changed interactively.

## Requirement

Phase 00 requires the main branch to be releasable and CI-gated.

The repository now has CI checks, dependency/build/integration workflows, CODEOWNERS, and an operational PR workflow available through the GitHub connector.

## Blocker

The connected GitHub integration can read repository rulesets but cannot write branch-protection/ruleset settings. GitHub returns administration access restrictions for branch-protection endpoints.

The authorized desktop currently has no authenticated GitHub CLI available, so changing the ruleset would require an interactive GitHub login/settings action.

## Risk

Until the repository ruleset is activated, a user/integration with write access can technically push directly to `main` without GitHub enforcing the required checks first.

## Mitigation

Until the ruleset is activated:

1. product implementation work after Phase 00 uses feature branches and pull requests;
2. PRs are merged only after required relevant workflows are green;
3. force-pushes to `main` are not used;
4. CODEOWNERS remains present;
5. CI continues to validate pushes to `main` as a post-merge safety net;
6. release promotion does not treat an unverified commit as production-ready.

## Required final configuration

The eventual repository ruleset should target the default branch and, at minimum:

- require a pull request before merge;
- block force pushes;
- block branch deletion;
- require the fast validation check;
- require build/backend integration checks when GitHub supports path-conditional requirements without creating permanently expected skipped checks, otherwise use a single aggregate required gate;
- allow only explicitly documented emergency bypass actors.

## Closure condition

Close this exception after the active GitHub ruleset is verified through the repository rulesets API and a test PR demonstrates that a failing required check blocks merge.
