import 'package:firebase_auth/firebase_auth.dart';

/// Service class for Firebase Authentication
/// Handles user authentication, session management, and auth state
class AuthService {
  final FirebaseAuth _auth;

  AuthService(this._auth);

  /// Get current user
  User? get currentUser => _auth.currentUser;

  /// Check if user is authenticated
  bool get isAuthenticated => currentUser != null;

  /// Get auth state changes stream
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  /// Sign in with email and password
  /// Returns the authenticated user or throws an exception
  Future<User> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    try {
      final userCredential = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );

      if (userCredential.user == null) {
        throw AuthException('Sign in failed: No user returned');
      }

      return userCredential.user!;
    } on FirebaseAuthException catch (e) {
      throw _handleAuthException(e);
    } catch (e) {
      throw AuthException('An unexpected error occurred: $e');
    }
  }

  /// Sign out the current user
  Future<void> signOut() async {
    try {
      await _auth.signOut();
    } catch (e) {
      throw AuthException('Failed to sign out: $e');
    }
  }

  /// Send password reset email
  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email.trim());
    } on FirebaseAuthException catch (e) {
      throw _handleAuthException(e);
    } catch (e) {
      throw AuthException('Failed to send reset email: $e');
    }
  }

  /// Update user password
  Future<void> updatePassword(String newPassword) async {
    final user = currentUser;
    if (user == null) {
      throw AuthException('No user logged in');
    }

    try {
      await user.updatePassword(newPassword);
    } on FirebaseAuthException catch (e) {
      throw _handleAuthException(e);
    } catch (e) {
      throw AuthException('Failed to update password: $e');
    }
  }

  /// Re-authenticate user (required for sensitive operations)
  Future<void> reauthenticate(String password) async {
    final user = currentUser;
    if (user == null || user.email == null) {
      throw AuthException('No user logged in');
    }

    try {
      final credential = EmailAuthProvider.credential(
        email: user.email!,
        password: password,
      );
      await user.reauthenticateWithCredential(credential);
    } on FirebaseAuthException catch (e) {
      throw _handleAuthException(e);
    } catch (e) {
      throw AuthException('Re-authentication failed: $e');
    }
  }

  /// Get user display name
  String get userDisplayName {
    return currentUser?.displayName ??
           currentUser?.email?.split('@').first ??
           'Admin';
  }

  /// Get user email
  String? get userEmail => currentUser?.email;

  /// Handle Firebase Auth exceptions and convert to user-friendly messages
  AuthException _handleAuthException(FirebaseAuthException e) {
    String message;

    switch (e.code) {
      case 'user-not-found':
        message = 'No account found with this email address.';
        break;
      case 'wrong-password':
        message = 'Incorrect password. Please try again.';
        break;
      case 'invalid-email':
        message = 'Invalid email address format.';
        break;
      case 'user-disabled':
        message = 'This account has been disabled.';
        break;
      case 'too-many-requests':
        message = 'Too many failed attempts. Please try again later.';
        break;
      case 'network-request-failed':
        message = 'Network error. Please check your internet connection.';
        break;
      case 'email-already-in-use':
        message = 'An account with this email already exists.';
        break;
      case 'weak-password':
        message = 'Password is too weak. Use at least 6 characters.';
        break;
      case 'requires-recent-login':
        message = 'Please sign in again to complete this action.';
        break;
      case 'invalid-credential':
        message = 'Invalid email or password. Please check your credentials.';
        break;
      default:
        message = e.message ?? 'Authentication failed. Please try again.';
    }

    return AuthException(message, code: e.code);
  }
}

/// Custom exception class for authentication errors
class AuthException implements Exception {
  final String message;
  final String? code;

  AuthException(this.message, {this.code});

  @override
  String toString() => message;
}
