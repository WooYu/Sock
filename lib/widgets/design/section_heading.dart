import 'package:flutter/material.dart';

import '../../theme/design_tokens.dart';

/// 区块标题。还原原型 `.section-heading` + `.eyebrow`。
///
/// 左侧为 eyebrow 小标题 + 主标题，右侧为可选插槽（徽章 / 图例 / 状态点）。
class SectionHeading extends StatelessWidget {
  const SectionHeading({
    super.key,
    required this.eyebrow,
    required this.title,
    this.trailing,
  });

  final String eyebrow;
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final t = StockCalTokens.of(context);
    final heading = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          eyebrow.toUpperCase(),
          style: TextStyle(
            fontSize: StockCalType.eyebrow,
            fontWeight: FontWeight.w800,
            letterSpacing: StockCalType.eyebrowSpacing,
            color: t.eyebrowInk,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: TextStyle(
            fontSize: StockCalType.h2,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.36,
            color: t.ink,
          ),
        ),
      ],
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (trailing == null) return heading;
          final scaledTitle = MediaQuery.textScalerOf(
            context,
          ).scale(StockCalType.h2);
          final stack = constraints.maxWidth < 420 || scaledTitle > 24;
          if (stack) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [heading, const SizedBox(height: 10), trailing!],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(child: heading),
              const SizedBox(width: 18),
              trailing!,
            ],
          );
        },
      ),
    );
  }
}
