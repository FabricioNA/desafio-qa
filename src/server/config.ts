import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017',
  mongoDb: process.env.MONGO_DB ?? 'desafio_qa',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
  superAdminEmail: process.env.SUPERADMIN_EMAIL ?? 'superadmin@example.com',
  superAdminPassword: process.env.SUPERADMIN_PASSWORD ?? 'Admin@123',
  defaultEmployeePassword: process.env.DEFAULT_EMPLOYEE_PASSWORD ?? 'Senha@123',
};
