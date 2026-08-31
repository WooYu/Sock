insert into knowledge_source(
    id, source_path, title, content_hash, original_content, imported_at
) values (
    'builtin-stock-notes',
    'builtin://obsidian-note/印象笔记/股票',
    '股票笔记·内置规则集',
    'builtin-stock-notes-v1',
    '内置规则来源：WooYu/ObsidianNote/印象笔记/股票。规则由股票笔记中的买股原则、海龟、葛兰碧、五日线、照镜子、盈利模式和月线炒股法整理而来。内置规则只作为可审计的基础规则，不代表投资建议。',
    timestamp with time zone '2026-08-31 00:00:00+00'
)
on conflict (id) do nothing;

insert into published_rule_source(
    id, source_document_id, name, description, source_excerpt,
    source_line_start, source_line_end, approved_by, published_at, enabled,
    rule_conditions, rule_action, strategy_mode, timeframe, priority, evidence_ids,
    invalidation_conditions, strength
) values
('builtin-5ma-priority', 'builtin-stock-notes', '5日线上方优先参与', '5日线以上是最基础的参与要求；条件不足时只观察，不强行交易。', '买股原则2：5日线以上做股票永久是最基础要求。', 1, 1, 'builtin:stock-notes', timestamp with time zone '2026-08-31 00:00:00+00', true, '[{"field":"closeAboveMa5","operator":"equals","value":1}]', 'WAIT', 'BASE_GRANVILLE', '日线', 10, '["note:买股原则2"]', '["收盘跌破5日线"]', 'PRINCIPLE'),
('builtin-uptrend-only', 'builtin-stock-notes', '只做上升趋势，回避均线向下', '5日线、10日线向下时不参与；优先选择均线抬头、价格站上均线的结构。', '买股原则2：只做上升趋势，5日线和10日线向下绝不参与。', 1, 1, 'builtin:stock-notes', timestamp with time zone '2026-08-31 00:00:00+00', true, '[{"field":"ma5SlopePositive","operator":"equals","value":0}]', 'AVOID', 'EXCLUSION', '日线', 15, '["note:买股原则2"]', '["5日线重新拐头向上并重新确认"]', 'PRINCIPLE'),
('builtin-panic-sea-turtle', 'builtin-stock-notes', '大盘暴跌时优先看海龟', '大盘暴跌阶段，优先观察相对强势、筑底或仍在5日线起步的个股。', '海龟：大盘暴跌时，上涨的个股还是五日线起步第一天，筑底海龟最好。', 1, 1, 'builtin:stock-notes', timestamp with time zone '2026-08-31 00:00:00+00', true, '[{"field":"marketPanic","operator":"equals","value":1},{"field":"relativeStrength","operator":"greaterThan","value":0}]', 'ENTER', 'SEA_TURTLE', '日线', 30, '["note:海龟"]', '["大盘风险解除前不追高"]', 'EXPERIENCE'),
('builtin-granville-day-one', 'builtin-stock-notes', '葛兰碧第一天才参与', '短线优先选择从5日线附近起步的葛兰碧第一天，避免追逐已经大涨的阶段。', '买股原则2：短线必须是葛兰碧第一天而且从5日线刚开始为佳。', 1, 1, 'builtin:stock-notes', timestamp with time zone '2026-08-31 00:00:00+00', true, '[{"field":"granvilleDay","operator":"equals","value":1},{"field":"closeAboveMa5","operator":"equals","value":1}]', 'ENTER', 'BASE_GRANVILLE', '日线', 35, '["note:买股原则2"]', '["涨幅已经巨大或进入第二天"]', 'PRINCIPLE'),
('builtin-granville-day-two-exit', 'builtin-stock-notes', '葛兰碧第二天优先出局', '葛兰碧短线原则以两天为主要窗口，最迟不超过基础规则允许的退出时间。', '买股原则2：葛兰碧第二天必须出局。', 1, 1, 'builtin:stock-notes', timestamp with time zone '2026-08-31 00:00:00+00', true, '[{"field":"granvilleDay","operator":"greaterThanOrEqual","value":2}]', 'EXIT', 'BASE_GRANVILLE', '日线', 90, '["note:买股原则2"]', '["重新形成新的第一天结构并完成重新评估"]', 'PRINCIPLE'),
('builtin-phase-three-hold', 'builtin-stock-notes', '攀升沿5日线或BOLL持股', '三期开口攀升时，5日线或BOLL线作为底线；底线不破才继续观察。', '盈利模式：攀升，5日线或BOLL线为底线，底线不破坚决看多。', 1, 1, 'builtin:stock-notes', timestamp with time zone '2026-08-31 00:00:00+00', true, '[{"field":"phase3Opening","operator":"equals","value":1},{"field":"closeAboveMa5","operator":"equals","value":1}]', 'HOLD', 'PHASE3_OPENING', '日线', 45, '["note:盈利模式"]', '["摸不到上轨或破位5日线"]', 'EXPERIENCE'),
('builtin-break-five-exit', 'builtin-stock-notes', '破位5日线不做', '破位5日线是不做和退出的底线，尤其不能把弱势反弹当成反转。', '五日线：反弹不过五日线都是耍流氓；破五之后需要重新判断。', 1, 1, 'builtin:stock-notes', timestamp with time zone '2026-08-31 00:00:00+00', true, '[{"field":"closeAboveMa5","operator":"equals","value":0}]', 'EXIT', 'EXCLUSION', '日线', 100, '["note:五日线"]', '["重新站稳5日线并完成量能确认"]', 'PRINCIPLE'),
('builtin-mirror-retest', 'builtin-stock-notes', '压力支撑互换后再判断', '照镜子表示压力位与支撑位互换；触及BOLL上轨后等待确认，不把一次触线当成突破。', '照镜子：压力位和支撑位互换。', 1, 1, 'builtin:stock-notes', timestamp with time zone '2026-08-31 00:00:00+00', true, '[{"field":"mirrorRetest","operator":"equals","value":1}]', 'REDUCE', 'MIRROR_RETEST', '日线', 70, '["note:照镜子"]', '["压力位重新确认或价格回到5日线"]', 'EXPERIENCE'),
('builtin-break-twenty-avoid', 'builtin-stock-notes', '跌破BOLL中轨不做', '破位20日线或BOLL中轨后远离不确定，不为了凑出买入结论而介入。', '买股原则2：破位中规20日线的一概不做，远离不确定。', 1, 1, 'builtin:stock-notes', timestamp with time zone '2026-08-31 00:00:00+00', true, '[{"field":"closeAboveMa20","operator":"equals","value":0}]', 'AVOID', 'EXCLUSION', '日线', 95, '["note:买股原则2"]', '["重新站上20日线并确认趋势"]', 'PRINCIPLE'),
('builtin-monthly-wait', 'builtin-stock-notes', '月线条件不完整时等待', '月线级别允许空仓等待和持续更新判断；条件不完整时输出等待，不给单点结论。', '月线炒股法：选择方向或不选择方向，按市场变化持续更新判断。', 1, 1, 'builtin:stock-notes', timestamp with time zone '2026-08-31 00:00:00+00', true, '[]', 'WAIT', 'MONTHLY_WAIT', '月线', 80, '["note:20220915_收盘_月线炒股法"]', '["月线方向和关键支撑目标位重新确认"]', 'PRINCIPLE')
on conflict (id) do nothing;
