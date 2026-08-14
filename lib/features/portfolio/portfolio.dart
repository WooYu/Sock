import 'portfolio_ledger.dart';

class Portfolio {
  Portfolio({required this.id, required this.name, PortfolioLedger? ledger})
    : ledger = ledger ?? PortfolioLedger();

  final String id;
  final String name;
  final PortfolioLedger ledger;

  Portfolio copyWith({String? name, PortfolioLedger? ledger}) => Portfolio(
    id: id,
    name: name ?? this.name,
    ledger: ledger ?? this.ledger,
  );
}

class PortfolioSnapshot {
  const PortfolioSnapshot({required this.portfolios, required this.activeId});

  final List<Portfolio> portfolios;
  final String? activeId;
}
