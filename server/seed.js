const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);
  const saltRounds = 10;
  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      password: hashedPassword,
    },
  });
  console.log(`Created user with id: ${user.id}`);

  const settings = await prisma.settings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      defaultProvider: 'openai',
      defaultModel: 'o3-mini',
      thinkingBudget: 2048,
      responseBudget: 8192,
      mcpEnableDebugLogging: false,
      mcpDefaultTimeout: 10000,
      mcpMaxConcurrentConnections: 5,
      mcpAutoDiscovery: true,
    },
  });

  console.log(`Created settings for demo user with id: ${settings.id}`);

  console.log('Seeding finished.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
