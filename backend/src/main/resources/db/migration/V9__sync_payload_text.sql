-- sync_change.payload 存的是不透明 JSON 字符串，应用只整体读写、从不按字段查询，
-- 使用 text 比 jsonb 更贴合用途，并避免 String→jsonb 的 JDBC 绑定脆弱性。
alter table sync_change alter column payload type text using payload::text;
