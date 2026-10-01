# ADR-001: Unified activity model

- **Status:** Accepted
- **Date:** 2026-10-01
- **Phase:** 5 (activity platform)

## Context

Each module keeps its own record of the work done on the farm:

- **Crops:** `crop_input_applications`, `growth_observations`, `harvests`, `crop_pests_diseases`
- **Animals:** `animal_feed_records`, `animal_health_records`, `animal_diseases_treatments` (with `treatment_medications`), `animal_production_records`
- **Planned work:** the generic `tasks` table, plus the care-plan schedules `scheduled_batch_tasks` and `scheduled_animal_tasks`

These tables have the same basic shape. Each has a date (`application_date`, `feed_date`, `record_date`, …), a subject (`batch_id`, or `animal_id`/`animal_group_id`) and `recorded_by` (a user). Some also have a cost (`total_cost`, `cost`). Nothing joins them, so three questions have no good answer:

1. **What happened on the farm last week, or to this batch, animal or group?** Answering it takes a UNION over a dozen tables, each with its own column names, and the UNION would have to be repeated wherever a timeline is shown.
2. **What did this enterprise cost in labour and inputs?** No record holds labour hours. `enterprises` exists, but nothing links to it except an untyped `tasks.enterprise_id`.
3. **What should a phone send when it reconnects?** The planned PWA and mobile app need one unit of offline work. That unit needs an idempotency key, so a replayed request isn't recorded twice.

Later phases add more record types: hive inspections, honey harvests, mushroom flushes and environment logs. Every one of the three questions gets harder with each new table.

## Decision

Every operational event is written as a row in a new `activities` table. The row is written **in the same transaction** as the event's detail row. Detail tables stay the source of domain detail and gain an `activity_id` foreign key. This is the farmOS "logs" pattern, adapted to our relational schema.

### The `activities` table

| Column | Notes |
|---|---|
| `activity_type` | `input_application`, `observation`, `harvest`, `pest_incident`, `feeding`, `vaccination`, `deworming`, `health_check`, `treatment`, `production`, `task_work`, then `inspection`, `environment_log`, … as modules arrive. A named CHECK list (`activities_type_check`), extended by migration. |
| `status` | `planned`, `done` or `cancelled` |
| `title` | Short display text for the timeline, such as "Mancozeb 2 kg", written by the service along with the row. |
| `planned_for` / `occurred_on` | Both are dates. `occurred_on` is required when `status = 'done'`, and `planned_for` when `status = 'planned'`. The detail tables only record dates, and a `DATE` cannot shift across time zones the way a midnight `timestamptz` can. This is why the plan's `occurred_at` became `occurred_on`. A time column can be added if quick-logging needs one. |
| Subject | Exactly one of `crop_batch_id`, `animal_id`, `animal_group_id` is set, enforced by a CHECK. Later phases add `hive_id` and `mushroom_batch_id` to the same CHECK. `task_work` may have no subject. |
| `enterprise_id`, `location_id` | `enterprise_id` defaults to the subject's enterprise. `location_id` is the crop batch's growing location; animals are placed through their housing. Both are copied onto the row so roll-ups don't depend on later moves. |
| `performed_by` | `employees.id`: the person whose labour is costed |
| `recorded_by` | `users.id`: whoever entered the record (kept apart from `performed_by`) |
| `labour_hours`, `input_cost`, `other_cost` | Costs are copied from the detail row when it is written. `input_cost` is stock used: an input application's or feeding's `total_cost`, or a treatment's medicines. `other_cost` is the rest, such as a health record's or treatment's `cost` (vet fees and the like). |
| `task_id` | The task this work completed, if any |
| `client_request_id` | Unique and nullable. This is the offline idempotency key. |
| `notes`, `created_at`, `updated_at`, `deleted_at` | Same conventions as the other tables |

### Rules

1. **One writer.** `ActivityService.record(t, {...})` takes the caller's transaction. Every service that writes a detail row calls it inside that transaction and stores the returned id in the detail row's `activity_id`. In practice it goes through `ActivityService.createDetail`, which records the activity first and then inserts the row pointing at it. No other code inserts into `activities` or writes `activity_id`.
2. **Detail rows and activities change together.** When a detail row is edited, the activity's date, subject, title and costs are updated in the same transaction. The same applies when a child row changes a cost, for example a medicine added to a treatment. When a detail row is soft-deleted, its activity is soft-deleted too. An activity never outlives its detail row, and a detail row is never saved without one.
3. **Tasks are planned activities.** Creating a task, or a care-plan scheduled task, creates a `planned` activity. Completing it marks that activity `done`, or produces a `done` activity carrying `labour_hours` and `performed_by`. Cancelling it cancels the activity. This rule takes effect in the tasks and employees phase. Phase 5 covers the detail tables.
4. **Mixed subjects.** Feed, health and treatment rows may hold both `animal_id` and `animal_group_id`. Their activity takes the animal, the most specific subject. The group can still be found through the animal.
5. **Writes from offline clients.** `POST /activities/bulk` replays a client outbox. Each entry names a kind of record (`harvest`, `feeding`, …) and is checked and written exactly as its own endpoint would, in its own transaction. If an activity with a given `client_request_id` already exists, the request returns that activity and nothing new is written. One failed entry does not hold back the others.
6. **Scope.** The activities table covers operational work, meaning the things someone did *to* a subject. Lifecycle and ledger events stay where they are: births, deaths, sales, group adjustments, breeding, incubation, inventory transactions and financial transactions. They have their own reporting needs. They can be added later as new activity types if the timeline needs them.

### Backfill

Migration 017 creates the table and adds a nullable `activity_id` to each detail table. It then runs `backfill_activities()`, which creates an activity for every detail row that has none. For each such row, the function:

- copies the row's date to `occurred_on`, with status `done`;
- copies its subject, the batch's location, its cost and its soft-delete;
- maps `recorded_by` to `performed_by` through `employees.user_id` where such an employee exists;
- sets the row's `activity_id`.

The function can safely be run again. `enterprise_id` was left empty; once batches, animals and groups linked to enterprises (migration 019), an activity copies its subject's enterprise when recorded, and a subject newly put under an enterprise passes it on to its activities that have none. Once every service recorded activities, migration 018 ran the function once more, made `activity_id` `NOT NULL` and dropped the function.

## Alternatives considered

### A. A separate task-only model

Keep the detail tables as they are, and make `tasks` the cross-module record by adding labour hours and costs to it.

- **For:** the smallest change, since tasks already exist and carry `enterprise_id`, `estimated_hours` and `actual_hours`.
- **Against:**
  - Most events are never planned as tasks. A worker sees blight and records it, or a milking is logged. Under this option those events would either stay off the timeline or need a made-up task wrapped around them.
  - Timelines and costs would still need a UNION of tasks with every detail table.
  - Two kinds of task already exist (`tasks` and the care-plan schedules), and neither fits offline replay.

**Rejected.**

### B. Pure polymorphic logs

Replace the detail tables with one `logs` table: common columns plus a `jsonb` payload for each type's fields, the way farmOS stores logs.

- **For:**
  - One table and one API.
  - New record types need no migration.
  - Offline sync is uniform.
- **Against:**
  - We lose what the relational detail tables give us now: CHECK constraints, typed columns, and foreign keys to `inventory_items`, `inventory_batches` and `animal_production_types`.
  - Domain queries depend on those columns, so they would have to move into JSON paths. Examples are the pre-harvest interval and withdrawal holds, stock deduction, and production totals.
  - It means rewriting every module that Phases 1–4 built and tested.

**Rejected.**

### C. A database view over the detail tables

Build a `UNION ALL` view that maps each detail table onto the timeline columns.

- **For:** no write-path changes and no backfill.
- **Against:**
  - Planned activities, labour hours and `client_request_id` have nowhere to live.
  - Filtering and paging slow down as the view grows.
  - The view has to be edited for every new table.

**Rejected.** It solves only the first of the three questions.

## Consequences

**Positive:**

- One indexed table answers the timeline (`GET /activities`) for the farm, an enterprise, or one batch, animal or group.
- Labour and input cost per enterprise is a `GROUP BY` on `activities`.
- `client_request_id` gives offline clients an idempotent unit of work.
- New modules (hives, mushrooms, environment) only add a detail table and an activity type.
- The audit log and attachments can link to an activity rather than to each detail table.

**Negative and costs:**

- Every detail-writing service changes to call `ActivityService.record`. A service that forgets to call it breaks the invariant. Two things guard against that: the `NOT NULL` `activity_id`, and integration tests that assert each write creates its activity.
- Date, subject and cost exist in two places. Rule 2 keeps them in step, and only the service layer writes either copy. Ad hoc SQL updates to detail tables are no longer safe.
- Writes are slightly slower, by one extra insert per event.
- The backfill has to handle rows with no matching employee. Their `performed_by` stays null, and their labour is unknown rather than zero.

## References

- `IMPLEMENTATION_PLAN.md`: "Unified Activity Model", "Activity & Enterprise Model (Phase 5)", "Activities & Platform (Phase 5)"
- farmOS logs: <https://farmos.org/model/type/log/>
