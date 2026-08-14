alter table audit_event
    alter column actor_id type varchar(100)
    using actor_id::text;
