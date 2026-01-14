import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    password: '$2a$10$abcdefghijklmnopqrstuv',
    fullName: 'Test User',
    isActive: true,
    role: 'user',
    lastLogin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserRepository = {
    create: jest.fn().mockImplementation((dto) => ({ ...dto, id: mockUser.id })),
    save: jest.fn().mockImplementation((user) => Promise.resolve({ ...mockUser, ...user })),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock.jwt.token'),
    verify: jest.fn().mockReturnValue({ sub: mockUser.id, username: mockUser.username }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user on successful validation', async () => {
      const plainPassword = 'password123';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      
      mockUserRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        password: hashedPassword,
      });

      const result = await service.validateUser(mockUser.username, plainPassword);

      expect(result).toBeDefined();
      expect(result?.username).toBe(mockUser.username);
    });

    it('should return null for invalid password', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);

      const result = await service.validateUser(mockUser.username, 'wrongpassword');

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.validateUser('nonexistent', 'password');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.login({ username: 'invalid', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockUserRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        password: hashedPassword,
        isActive: false,
      });

      await expect(
        service.login({ username: mockUser.username, password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);

      const result = await service.getProfile(mockUser.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.getProfile('non-existent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
