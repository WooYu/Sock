import 'package:flutter/material.dart';

/// 骨架屏占位：加载态替代转圈，传递「感知速度」。
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.width, this.height = 16, this.radius});

  final double? width;
  final double height;
  final BorderRadius? radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.08),
        borderRadius: radius ?? BorderRadius.circular(6),
      ),
    );
  }
}
