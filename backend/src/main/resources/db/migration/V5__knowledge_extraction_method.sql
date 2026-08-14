alter table knowledge_draft
    add column extraction_method varchar(20) not null default 'LOCAL';
