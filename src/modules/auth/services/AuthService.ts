import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../../../config';
import { Role, TokenPayload, User } from '../../../models/AccessRequest';
import { AppError } from '../../../utils/AppError';

export class AuthService {
  private readonly users: Map<string, User>;

  constructor(users: Map<string, User>) {
    this.users = users;
  }

  async login(email: string, password: string): Promise<{ token: string; user: Omit<User, 'passwordHash'> }> {
    const user = Array.from(this.users.values()).find((u) => u.email === email);

    // Use the same error message for both unknown email and wrong password
    // to prevent user enumeration attacks.
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });

    const { passwordHash: _omitted, ...safeUser } = user;
    return { token, user: safeUser };
  }

  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as TokenPayload;
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }
  }

  findUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserRole(id: string): Role | undefined {
    return this.users.get(id)?.role;
  }

  /** Registers a user into the in-memory store. Used only during seeding. */
  registerUser(user: User): void {
    this.users.set(user.id, user);
  }
}
