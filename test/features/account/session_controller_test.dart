import 'package:flutter_test/flutter_test.dart';
import 'package:stockcal/features/account/session.dart';

void main() {
  test('successful phone verification persists a signed-in session', () async {
    final repository = MemorySessionRepository();
    final controller = SessionController(repository);

    await controller.verifyPhone(phone: '13800138000', code: '246810');

    expect(controller.session?.phone, '13800138000');
    expect(controller.session?.isSignedIn, isTrue);
    expect((await repository.restore())?.phone, '13800138000');
  });

  test('invalid verification code does not create a session', () async {
    final controller = SessionController(MemorySessionRepository());

    expect(
      () => controller.verifyPhone(phone: '13800138000', code: '12'),
      throwsA(isA<VerificationException>()),
    );
    expect(controller.session, isNull);
  });

  test('sign out clears the persisted session', () async {
    final repository = MemorySessionRepository();
    final controller = SessionController(repository);
    await controller.verifyPhone(phone: '13800138000', code: '246810');

    await controller.signOut();

    expect(controller.session, isNull);
    expect(await repository.restore(), isNull);
  });
}
