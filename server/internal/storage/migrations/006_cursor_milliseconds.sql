-- 006: sync cursor 纳秒 → 毫秒（幂等）。
-- 纳秒时间戳超出 float64（JSON number / JS Number）的 53 位安全整数
-- 范围，客户端解析游标会丢精度：向下舍入导致重复拉取，向上舍入导致
-- 跳过未拉取的记录。毫秒（1.7e12）在安全范围内。
-- 只归一化仍是纳秒量级（> 1e15）的行，重复执行无副作用。
-- （sync 无独立 state 表，服务端游标取 MAX(cursor)。）
UPDATE sync_records SET cursor = cursor / 1000000 WHERE cursor > 1000000000000000;
