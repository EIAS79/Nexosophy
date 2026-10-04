# Nexosophy Personas & End-to-End Workflows

> **Status:** canonical product-governance specification  
> **Owner:** Product governance  
> **Purpose:** convert the product vision into concrete jobs-to-be-done, end-to-end journeys, activation criteria and cross-persona workflow requirements.

## 1. Persona model

Nexosophy does not force a user into one permanent persona. A user may be a student and researcher, professor and lab PI, reporter and analyst, or move between roles over time.

Persona selection is therefore:

- a product-personalization input;
- a template/dashboard recommendation input;
- an onboarding shortcut;
- never an authorization boundary by itself.

Authorization is controlled by workspace membership, role and permissions.

## 2. Shared workflow primitives

Every persona reuses the same foundations:

- internal user identity;
- workspaces;
- recursive files/folders;
- typed documents;
- search;
- history/trash;
- tasks;
- reminders;
- calendar;
- comments/mentions;
- sharing/RBAC;
- templates;
- import/export;
- notifications;
- realtime collaboration where supported.

Persona-specific features compose these primitives instead of duplicating them.

## 3. Student journey

### 3.1 Activation

A new student should be able to:

1. sign up;
2. select student interests or skip;
3. create or accept a personal academic workspace;
4. create/import a course;
5. capture the first note or upload material;
6. add an assignment/exam;
7. see it appear in tasks/calendar;
8. return later and find the same material from dashboard/search.

### 3.2 Core semester workflow

```text
Create term
  ↓
Add courses
  ↓
Capture lecture notes/files
  ↓
Create assignments/exams
  ↓
Schedule study/reminders
  ↓
Create flashcards/revision material
  ↓
Search/review
  ↓
Archive term / export
```

### 3.3 Acceptance outcomes

A student can:

- keep course materials together without duplicating files;
- connect notes to course/task/event context;
- distinguish upcoming, overdue and completed work;
- prepare for exams using notes, flashcards and study planning;
- access essential workflows on phone during class;
- use desktop/tablet for deeper writing/organization.

## 4. Master's / PhD journey

### 4.1 Activation

A postgraduate user can create a thesis/research workspace from a template and immediately define:

- title / working title;
- research question(s);
- milestones;
- supervisor(s);
- reference library;
- first literature note.

### 4.2 Research journey

```text
Question / hypothesis
  ↓
Literature search & references
  ↓
Reading notes / evidence
  ↓
Methods / experiment / dataset
  ↓
Analysis
  ↓
Thesis chapter drafting
  ↓
Supervisor review
  ↓
Revision
  ↓
Submission/export/archive
```

### 4.3 Acceptance outcomes

The user can trace thesis content back to references, notes and evidence; supervisor comments do not require duplicate document copies; citations remain linked to canonical reference records.

## 5. Researcher journey

Researchers need to move between literature, projects, data, experiments and collaborative writing.

Core workflow:

1. create/join research workspace;
2. create project;
3. import references/files;
4. create structured research notes;
5. attach datasets/experiments;
6. assign tasks and milestones;
7. collaborate/review;
8. analyze;
9. produce report/paper-ready outputs;
10. export/archive with provenance.

Success means the project remains coherent even when multiple people edit different artifacts concurrently.

## 6. Professor / supervisor journey

### Core workflows

- create or join teaching/research workspace;
- distribute resources;
- organize course/supervision material;
- invite students/researchers;
- review/comment on submitted or shared work;
- schedule meetings/office hours;
- track supervision milestones;
- control visibility of sensitive/unreleased feedback.

### Acceptance outcomes

Professors do not need a separate app for teaching versus supervision. The same document/comment/calendar primitives are reused with role-specific views.

## 7. Laboratory journey

### Core workflow

```text
Research project
  ↓
Protocol/SOP version
  ↓
Experiment run
  ↓
Samples / reagents / equipment
  ↓
Observations + files/data
  ↓
Results / analysis
  ↓
Sign / amend / review
  ↓
Archive / report
```

### Acceptance outcomes

- an experiment can identify the protocol version used;
- sample lineage is preserved;
- equipment usage can be associated with work;
- signed/locked records use amendments rather than silent mutation where policy requires;
- inventory updates are auditable.

## 8. Reporter / investigator journey

### Core workflow

```text
Story idea
  ↓
Investigation dossier
  ↓
Sources / interviews
  ↓
Evidence
  ↓
Claims
  ↓
Fact checking
  ↓
Timeline
  ↓
Draft report
  ↓
Review / approval
  ↓
Publication/export
```

### Acceptance outcomes

- confidential-source data is permission-controlled;
- claims can be traced to evidence;
- a published version is reproducible;
- redaction is real, not cosmetic;
- evidence/provenance survives export where applicable.

## 9. Analyst journey

### Core workflow

1. upload/connect dataset;
2. inspect schema/profile;
3. clean/transform;
4. save transformation recipe/provenance;
5. analyze in structured views/notebooks;
6. build charts;
7. assemble dashboard/report;
8. share/export.

### Acceptance outcomes

Analysis is reproducible enough to identify source data, transformations and output version; arbitrary code does not execute on ordinary API servers.

## 10. Team / institution journey

Team activation includes:

- create workspace;
- choose type/template;
- invite members;
- assign roles;
- set sharing defaults;
- create initial structure;
- optionally select billing owner/plan.

Institution workflows may later add centralized management, but must not bypass tenant isolation or individual security controls.

## 11. Cross-persona mixed workflows

Nexosophy must explicitly support mixed collaboration:

- professor + PhD candidate;
- PI + lab technician + researcher;
- reporter + editor + analyst;
- instructor + TA + student;
- research group + external guest reviewer.

No persona-specific module may assume every collaborator has the same persona.

## 12. Onboarding rules

Onboarding must:

- be resumable;
- be skippable where possible;
- avoid asking for information not required to create value;
- create a usable starting workspace in under five minutes for normal flows;
- allow persona/template choices to be changed later;
- never store authorization-critical state only in Clerk metadata.

## 13. Dashboard personalization

The authenticated home/dashboard may adapt by persona preference and recent behavior.

Examples:

- student: upcoming assignments, recent courses, next exam, recent notes;
- researcher: active projects, recent references, tasks, datasets;
- lab: experiments, bookings, expiring inventory alerts;
- reporter: investigations, review deadlines, sources/evidence activity;
- professor: supervision, review queue, upcoming teaching events.

Dashboard aggregation must avoid client-side N+1 fan-out.

## 14. Device behavior

### Phone

Prioritize:

- quick capture;
- task/reminder updates;
- calendar;
- notifications;
- recent content;
- lightweight editing;
- scan/photo/file upload.

### Tablet

Prioritize:

- stylus notes;
- whiteboard;
- reading/annotation;
- split-view research;
- hardware keyboard support.

### Desktop

Prioritize:

- persistent navigation;
- deep file trees;
- multi-pane work;
- keyboard shortcuts;
- long-form editing;
- datasets/analysis;
- high-information-density views.

## 15. Persona success metrics

Track per persona:

- activation completion;
- time to first meaningful artifact;
- return after first session;
- use of linked workflows rather than isolated feature clicks;
- successful search/retrieval;
- successful export/recovery;
- collaboration/review completion;
- support contacts caused by lost context or lost work.

Metrics must not become authorization rules.

## 16. Failure states

Each persona workflow must define behavior for:

- empty workspace;
- no permissions;
- disconnected provider;
- upload failure;
- save conflict;
- offline/reconnect;
- deleted/moved linked item;
- expired share/invite;
- quota/entitlement limit.

## 17. Definition of Done

### Planning

- [x] Primary journey exists for every target persona.
- [x] Mixed-persona collaboration is explicitly supported.
- [x] Onboarding does not permanently lock users into one persona.
- [x] Device priorities are defined.
- [x] Persona success signals are defined.

### Implementation

- [ ] Each primary persona can reach a useful workspace in under five minutes in usability testing.
- [ ] Every persona can switch/add workflows without account migration.
- [ ] Dashboard data is aggregated without unbounded API fan-out.
- [ ] Critical persona journeys pass desktop/tablet/phone E2E tests.
- [ ] Permission and degraded-state tests pass for mixed-persona collaboration.

## 18. Next document

Continue to `02-scope-non-goals.md`.
