create table shared_sync_lock (id integer primary key);
insert into shared_sync_lock (id) values (1);

-- Historical accounts could use the same local trade id. Keep every trade,
-- assigning a deterministic shared id only to collisions before enforcing uniqueness.
update account_trade t set id='shared-' || md5(t.user_id || ':' || t.id)
where t.id in (select id from account_trade group by id having count(*) > 1);
create unique index account_trade_shared_id on account_trade(id);
