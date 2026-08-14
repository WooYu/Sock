create table knowledge_source (
    id varchar(36) primary key,
    source_path varchar(1000) not null,
    title varchar(500) not null,
    content_hash varchar(64) not null,
    original_content text not null,
    imported_at timestamptz not null,
    unique(source_path, content_hash)
);

create table knowledge_draft (
    id varchar(36) primary key,
    source_document_id varchar(36) not null references knowledge_source(id),
    kind varchar(20) not null,
    title varchar(500) not null,
    summary text not null,
    source_excerpt text not null,
    source_line_start integer not null,
    source_line_end integer not null,
    status varchar(20) not null,
    approved_by varchar(100),
    reviewed_at timestamptz
);

create table published_rule_source (
    id varchar(36) primary key,
    source_document_id varchar(36) not null references knowledge_source(id),
    name varchar(500) not null,
    description text not null,
    source_excerpt text not null,
    source_line_start integer not null,
    source_line_end integer not null,
    approved_by varchar(100) not null,
    published_at timestamptz not null
);
