import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Seed Genres ──
  const genres = [
    { name: 'Hành động', slug: 'action', icon: '⚔️', displayOrder: 1 },
    { name: 'Hài hước', slug: 'comedy', icon: '😂', displayOrder: 2 },
    { name: 'Kịch tính', slug: 'drama', icon: '🎭', displayOrder: 3 },
    { name: 'Giả tưởng', slug: 'fantasy', icon: '🧙', displayOrder: 4 },
    { name: 'Kinh dị', slug: 'horror', icon: '👻', displayOrder: 5 },
    { name: 'Tình cảm', slug: 'romance', icon: '❤️', displayOrder: 6 },
    { name: 'Khoa học viễn tưởng', slug: 'sci-fi', icon: '🚀', displayOrder: 7 },
    { name: 'Đời thường', slug: 'slice-of-life', icon: '🌸', displayOrder: 8 },
    { name: 'Ly kỳ', slug: 'thriller', icon: '🔍', displayOrder: 9 },
    { name: 'Lịch sử', slug: 'historical', icon: '📜', displayOrder: 10 },
  ];

  for (const genre of genres) {
    await prisma.genre.upsert({
      where: { slug: genre.slug },
      update: {},
      create: genre,
    });
  }
  console.log(`  ✅ ${genres.length} genres created`);

  // ── Seed Admin User ──
  const adminPassword = await bcrypt.hash('Admin@2026', 12);
  await prisma.user.upsert({
    where: { email: 'admin@comicplatform.vn' },
    update: {},
    create: {
      email: 'admin@comicplatform.vn',
      username: 'admin',
      passwordHash: adminPassword,
      displayName: 'Admin',
      role: UserRole.ADMIN,
      isVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('  ✅ Admin user created (admin@comicplatform.vn / Admin@2026)');

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
