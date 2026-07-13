import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const words = [
  "يشرموط",
  "شرموط",
  "شرموطة",
  "يا شرموط",
  "ابن الشرموطة",
  "ابن الشرموط",
  "بنت الشرموطة",
  "كس امك",
  "كس أمك",
  "كسمك",
  "كسم",
  "يلعن كسمك",
  "ابن المتناكة",
  "ابن المنيوكة",
  "منيوك",
  "متناك",
  "نيك",
  "ينك",
  "طيزك",
  "خول",
  "يا خول",
  "عرص",
  "يا عرص",
  "عرصة",
  "قواد",
  "ديوث",
  "زاني",
  "زانية",
  "وسخة",
  "وسخ",
  "قحبة",
  "قحب"
];

async function main() {
  console.log("Seeding Arabic blocked words...");
  let count = 0;
  for (const word of words) {
    try {
      await prisma.blockedWord.upsert({
        where: { word },
        update: {},
        create: {
          word,
          language: "ar",
          category: "PROFANITY",
          severity: "HIGH",
          isActive: true
        }
      });
      count++;
    } catch (err) {
      console.error(`Failed to upsert word: ${word}`, err);
    }
  }
  console.log(`Successfully seeded ${count} blocked words.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
