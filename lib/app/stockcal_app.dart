import 'package:flutter/material.dart';

import '../features/home/home_screen.dart';

class StockCalApp extends StatelessWidget {
  const StockCalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'StockCal',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF176B87),
          brightness: Brightness.light,
        ),
      ),
      home: const HomeScreen(),
    );
  }
}
