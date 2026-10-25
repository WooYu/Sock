-- A timestamp alone cannot freeze pagination while an older transaction is still
-- collecting or committing. Keep the insertion transaction independent of later
-- operational updates and carry its visibility snapshot in the opaque cursor.
alter table scenario_forecast_record add column created_xid xid8 not null default pg_current_xact_id();
alter table scenario_price_evaluation add column created_xid xid8 not null default pg_current_xact_id();
alter table note_study_revision add column created_xid xid8 not null default pg_current_xact_id();
