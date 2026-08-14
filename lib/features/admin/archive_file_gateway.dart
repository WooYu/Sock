import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:share_plus/share_plus.dart';

abstract interface class ArchiveFileGateway {
  Future<String?> pickContent();
  Future<void> save(String fileName, String content);
  Future<void> share(String content);
}

class FilePickerArchiveGateway implements ArchiveFileGateway {
  @override
  Future<String?> pickContent() async {
    final files = await FilePicker.pickFiles(type: FileType.any);
    if (files.isEmpty) return null;
    final bytes = await files.first.readAsBytes();
    return utf8.decode(bytes);
  }

  @override
  Future<void> save(String fileName, String content) async {
    await FilePicker.saveFile(
      dialogTitle: '保存 StockCal 数据归档',
      fileName: fileName,
      bytes: utf8.encode(content),
    );
  }

  @override
  Future<void> share(String content) async {
    await SharePlus.instance.share(ShareParams(text: content));
  }
}
