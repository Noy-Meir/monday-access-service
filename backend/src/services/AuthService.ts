import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { Role, TokenPayload, User } from '../models/AccessRequest';
import { IUserRepository } from '../repositories/IUserRepository';
import { AppError } from '../utils/AppError';


export class AuthService {
  constructor(private readonly userRepo: IUserRepository) {}

  async login(email: string, password: string): Promise<{ token: string; user: Omit<User, 'passwordHash'> }> {
    const user = await this.userRepo.findByEmail(email);

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

  async findUserById(id: string): Promise<User | undefined> {
    return this.userRepo.findById(id);
  }

  async getUserRole(id: string): Promise<Role | undefined> {
    const user = await this.userRepo.findById(id);
    return user?.role;
  }
}
