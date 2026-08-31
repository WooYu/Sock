create table account_trade (
    id varchar(180) not null,
    user_id varchar(100) not null,
    symbol varchar(32) not null,
    side varchar(10) not null,
    quantity numeric(20, 6) not null,
    price numeric(20, 6) not null,
    fee numeric(20, 6) not null default 0,
    traded_at timestamptz not null,
    note varchar(2000),
    revision bigint not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, id),
    check (side in ('buy', 'sell')),
    check (quantity > 0),
    check (price > 0),
    check (fee >= 0)
);

create index account_trade_user_time_idx on account_trade(user_id, traded_at);
