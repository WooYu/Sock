alter table knowledge_draft
    add column rule_conditions text not null default '[]',
    add column rule_action varchar(20) not null default 'WAIT',
    add column strategy_mode varchar(40) not null default 'BASE_GRANVILLE',
    add column timeframe varchar(50) not null default '日线',
    add column priority integer not null default 50,
    add column evidence_ids text not null default '[]';

alter table published_rule_source
    add column rule_conditions text not null default '[]',
    add column rule_action varchar(20) not null default 'WAIT',
    add column strategy_mode varchar(40) not null default 'BASE_GRANVILLE',
    add column timeframe varchar(50) not null default '日线',
    add column priority integer not null default 50,
    add column evidence_ids text not null default '[]';
