import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

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

  /// Sign in with Google (owner / master account).
  ///
  /// v7 flow: `initialize()` → `authenticate()` → Firebase `id_token` sign-in.
  /// The iOS/macOS client ID comes from Info.plist (`GIDClientID`), which is
  /// injected in CI from the same GoogleService-Info.plist secret, so no
  /// client ID needs to be hardcoded here. Android resolves its client ID
  /// from `google-services.json` automatically (SHA-1 bound).
  Future<User> signInWithGoogle() async {
    try {
      final GoogleSignIn signIn = GoogleSignIn.instance;
      await signIn.initialize();

      final GoogleSignInAccount account = await signIn.authenticate();
      final idToken = account.authentication.idToken;

      if (idToken == null || idToken.isEmpty) {
        throw AuthException(
          'Google sign-in did not return an identity token. '
          'Verify the Google provider and OAuth client configuration.',
          code: 'google-no-id-token',
        );
      }

      final credential = GoogleAuthProvider.credential(idToken: idToken);
      final userCredential = await _auth.signInWithCredential(credential);

      final user = userCredential.user;
      if (user == null) {
        throw AuthException('Sign in failed: No user returned');
      }

      // Detach the Google session from the plugin so sign-out is driven
      // entirely by FirebaseAuth (avoids silent re-auth on next launch).
      try {
        await signIn.disconnect();
      } catch (_) {
        // Non-fatal.
      }

      return user;
    } on GoogleSignInException catch (e) {
      final code = e.code;
      if (code == GoogleSignInExceptionCode.canceled) {
        throw AuthException('Google sign-in was canceled.', code: 'google-canceled');
      }
      throw AuthException(
        'Google sign-in failed: ${e.description ?? code.name}',
        code: 'google-sign-in-error',
      );
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
      case 'account-exists-with-different-credential':
        message =
            'An account already exists with this email using a different sign-in method. '
            'Sign in with email and password first.';
        break;
      case 'operation-not-allowed':
        message =
            'Google sign-in is not enabled for this Firebase project. '
            'Enable the Google provider in the Firebase console.';
        break;
      case 'unauthorized-domain':
        message = 'This app domain is not authorized for Google sign-in.';
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
