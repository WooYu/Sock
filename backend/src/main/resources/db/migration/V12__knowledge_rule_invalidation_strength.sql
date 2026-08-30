alter table knowledge_draft
    add column invalidation_conditions text not null default '[]',
    add column strength varchar(20) not null default 'UNSPECIFIED';

alter table published_rule_source
    add column invalidation_conditions text not null default '[]',
    add column strength varchar(20) not null default 'UNSPECIFIED';
