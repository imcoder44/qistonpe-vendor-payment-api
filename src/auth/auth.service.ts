import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: [{ username }, { email: username }],
    });

    if (user && await bcrypt.compare(password, user.password)) {
      return user;
    }

    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.username, loginDto.password);

    if (!user) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        errorCode: 'INVALID_CREDENTIALS',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        message: 'User account is disabled',
        errorCode: 'USER_DISABLED',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken: this.jwtService.sign(payload),
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException({
        message: 'User not found',
        errorCode: 'USER_NOT_FOUND',
      });
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };
  }

  async seedDefaultUser() {
    const existingUser = await this.userRepository.findOne({
      where: { username: 'admin' },
    });

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const user = this.userRepository.create({
        username: 'admin',
        email: 'admin@qistonpe.com',
        password: hashedPassword,
        fullName: 'Admin User',
        role: 'admin',
        isActive: true,
      });
      await this.userRepository.save(user);
      console.log('Default admin user created: admin / admin123');
    }
  }
}
