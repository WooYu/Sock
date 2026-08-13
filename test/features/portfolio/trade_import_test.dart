import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/portfolio/portfolio_ledger.dart';
import 'package:stockcal/features/portfolio/trade_import.dart';

void main() {
  const mapping = TradeColumnMapping(
    id: '流水号',
    occurredAt: '日期',
    type: '业务',
    code: '证券代码',
    name: '证券名称',
    quantity: '数量',
    price: '价格',
    fee: '费用',
    cashAmount: '发生金额',
    note: '备注',
  );

  group('trade import', () {
    test('preview maps broker columns without mutating ledger', () {
      final ledger = PortfolioLedger(openingCash: 10000);
      final importer = TradeImportService(ledger);

      final preview = importer.preview(
        rows: const [
          {
            '流水号': 'A001',
            '日期': '2026-08-01',
            '业务': '买入',
            '证券代码': '600519',
            '证券名称': '贵州茅台',
            '数量': '100',
            '价格': '10',
            '费用': '5',
            '发生金额': '',
            '备注': '计划建仓',
          },
        ],
        mapping: mapping,
      );

      expect(preview.isValid, isTrue);
      expect(preview.entries.single.type, TradeEntryType.buy);
      expect(preview.entries.single.code, '600519');
      expect(ledger.entries, isEmpty);
    });

    test('preview reports row errors and commit remains disabled', () {
      final importer = TradeImportService(PortfolioLedger());

      final preview = importer.preview(
        rows: const [
          {
            '流水号': 'A002',
            '日期': 'bad-date',
            '业务': '卖出',
            '证券代码': '600519',
            '证券名称': '贵州茅台',
            '数量': 'abc',
            '价格': '12',
            '费用': '3',
            '发生金额': '',
            '备注': '',
          },
        ],
        mapping: mapping,
      );

      expect(preview.isValid, isFalse);
      expect(preview.errors.single.rowNumber, 2);
      expect(preview.errors.single.message, contains('日期'));
      expect(
        () => importer.commit(preview),
        throwsA(isA<TradeImportException>()),
      );
    });

    test('commit is atomic when imported sell exceeds available shares', () {
      final ledger = PortfolioLedger();
      final importer = TradeImportService(ledger);
      final preview = importer.preview(
        rows: const [
          {
            '流水号': 'A003',
            '日期': '2026-08-01',
            '业务': '买入',
            '证券代码': '000001',
            '证券名称': '平安银行',
            '数量': '10',
            '价格': '10',
            '费用': '0',
            '发生金额': '',
            '备注': '',
          },
          {
            '流水号': 'A004',
            '日期': '2026-08-02',
            '业务': '卖出',
            '证券代码': '000001',
            '证券名称': '平安银行',
            '数量': '11',
            '价格': '12',
            '费用': '0',
            '发生金额': '',
            '备注': '',
          },
        ],
        mapping: mapping,
      );

      expect(preview.isValid, isTrue);
      expect(
        () => importer.commit(preview),
        throwsA(isA<LedgerValidationException>()),
      );
      expect(ledger.entries, isEmpty);
    });

    test('undo removes latest import batch but preserves manual entries', () {
      final ledger = PortfolioLedger();
      ledger.record(
        TradeEntry.fee(
          id: 'manual-fee',
          occurredAt: DateTime(2026, 7, 31),
          amount: 2,
          note: '手工费用',
        ),
      );
      final importer = TradeImportService(ledger);
      final preview = importer.preview(
        rows: const [
          {
            '流水号': 'A005',
            '日期': '2026-08-01',
            '业务': '买入',
            '证券代码': '300750',
            '证券名称': '宁德时代',
            '数量': '20',
            '价格': '100',
            '费用': '5',
            '发生金额': '',
            '备注': '',
          },
        ],
        mapping: mapping,
      );

      final batch = importer.commit(preview);
      expect(ledger.entries, hasLength(2));

      expect(importer.undoLatest(), isTrue);
      expect(ledger.entries.single.id, 'manual-fee');
      expect(batch.entryCount, 1);
      expect(importer.undoLatest(), isFalse);
    });

    test('supports dividend, bonus, and standalone fee row types', () {
      final importer = TradeImportService(PortfolioLedger());
      final preview = importer.preview(
        rows: const [
          {
            '流水号': 'D1',
            '日期': '2026-08-01',
            '业务': '分红',
            '证券代码': '600519',
            '证券名称': '贵州茅台',
            '数量': '',
            '价格': '',
            '费用': '',
            '发生金额': '88.5',
            '备注': '',
          },
          {
            '流水号': 'B1',
            '日期': '2026-08-02',
            '业务': '送转',
            '证券代码': '600519',
            '证券名称': '贵州茅台',
            '数量': '10',
            '价格': '',
            '费用': '',
            '发生金额': '',
            '备注': '',
          },
          {
            '流水号': 'F1',
            '日期': '2026-08-03',
            '业务': '费用',
            '证券代码': '',
            '证券名称': '',
            '数量': '',
            '价格': '',
            '费用': '3',
            '发生金额': '',
            '备注': '管理费',
          },
        ],
        mapping: mapping,
      );

      expect(preview.isValid, isTrue);
      expect(preview.entries.map((entry) => entry.type), [
        TradeEntryType.dividend,
        TradeEntryType.bonus,
        TradeEntryType.fee,
      ]);
    });
  });
}
