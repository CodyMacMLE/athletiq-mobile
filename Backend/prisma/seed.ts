import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create users
  const cody = await prisma.user.upsert({
    where: { email: "cody@example.com" },
    update: {},
    create: {
      email: "cody@example.com",
      firstName: "Cody",
      lastName: "MacDonald",
      phone: "123-456-7890",
      address: "123 Main St",
      city: "Vancouver",
      country: "Canada",
    },
  });

  const sarah = await prisma.user.upsert({
    where: { email: "sarah@example.com" },
    update: {},
    create: {
      email: "sarah@example.com",
      firstName: "Sarah",
      lastName: "Chen",
    },
  });

  const marcus = await prisma.user.upsert({
    where: { email: "marcus@example.com" },
    update: {},
    create: {
      email: "marcus@example.com",
      firstName: "Marcus",
      lastName: "Lee",
    },
  });

  const ava = await prisma.user.upsert({
    where: { email: "ava@example.com" },
    update: {},
    create: {
      email: "ava@example.com",
      firstName: "Ava",
      lastName: "Torres",
    },
  });

  const jake = await prisma.user.upsert({
    where: { email: "jake@example.com" },
    update: {},
    create: {
      email: "jake@example.com",
      firstName: "Jake",
      lastName: "Wilson",
    },
  });

  const emma = await prisma.user.upsert({
    where: { email: "emma@example.com" },
    update: {},
    create: {
      email: "emma@example.com",
      firstName: "Emma",
      lastName: "Davis",
    },
  });

  console.log("✅ Users created");

  // Create organization
  const org = await prisma.organization.upsert({
    where: { id: "shenderey-org" },
    update: {},
    create: {
      id: "shenderey-org",
      name: "Shenderey",
    },
  });

  console.log("✅ Organization created");

  // Create teams
  const varsity = await prisma.team.upsert({
    where: { id: "varsity-team" },
    update: {},
    create: {
      id: "varsity-team",
      name: "Varsity",
      organizationId: org.id,
    },
  });

  const juniorElite = await prisma.team.upsert({
    where: { id: "junior-elite-team" },
    update: {},
    create: {
      id: "junior-elite-team",
      name: "Junior Elite",
      organizationId: org.id,
    },
  });

  const development = await prisma.team.upsert({
    where: { id: "development-team" },
    update: {},
    create: {
      id: "development-team",
      name: "Development",
      organizationId: org.id,
    },
  });

  console.log("✅ Teams created");

  // Add team members
  const teamMembers = [
    { userId: cody.id, teamId: varsity.id, role: "MEMBER" as const, hoursRequired: 16 },
    { userId: sarah.id, teamId: varsity.id, role: "CAPTAIN" as const, hoursRequired: 16 },
    { userId: marcus.id, teamId: varsity.id, role: "MEMBER" as const, hoursRequired: 16 },
    { userId: ava.id, teamId: varsity.id, role: "MEMBER" as const, hoursRequired: 16 },
    { userId: jake.id, teamId: varsity.id, role: "MEMBER" as const, hoursRequired: 16 },
    { userId: emma.id, teamId: development.id, role: "MEMBER" as const, hoursRequired: 12 },
  ];

  for (const member of teamMembers) {
    await prisma.teamMember.upsert({
      where: { userId_teamId: { userId: member.userId, teamId: member.teamId } },
      update: {},
      create: member,
    });
  }

  console.log("✅ Team members added");

  // Create events
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events = [
    {
      id: "practice-today",
      title: "Team Practice",
      type: "PRACTICE" as const,
      date: today,
      startTime: "6:00 PM",
      endTime: "8:00 PM",
      location: "Main Gym",
      description: "Regular team practice session. Focus on defensive drills.",
      organizationId: org.id,
      teamId: varsity.id,
    },
    {
      id: "practice-tomorrow",
      title: "Team Practice",
      type: "PRACTICE" as const,
      date: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      startTime: "6:00 PM",
      endTime: "8:00 PM",
      location: "Main Gym",
      organizationId: org.id,
      teamId: varsity.id,
    },
    {
      id: "meeting-day3",
      title: "Team Meeting",
      type: "MEETING" as const,
      date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
      startTime: "5:00 PM",
      endTime: "6:00 PM",
      location: "Conference Room",
      description: "Weekly team meeting to discuss strategy.",
      organizationId: org.id,
      teamId: varsity.id,
    },
    {
      id: "game-day4",
      title: "Game vs Thunder",
      type: "EVENT" as const,
      date: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
      startTime: "7:00 PM",
      endTime: "9:00 PM",
      location: "Home Arena",
      organizationId: org.id,
      teamId: varsity.id,
    },
  ];

  for (const event of events) {
    await prisma.event.upsert({
      where: { id: event.id },
      update: {},
      create: event,
    });
  }

  console.log("✅ Events created");

  // Create some check-ins for past events
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const pastEvent = await prisma.event.upsert({
    where: { id: "practice-yesterday" },
    update: {},
    create: {
      id: "practice-yesterday",
      title: "Team Practice",
      type: "PRACTICE",
      date: yesterday,
      startTime: "6:00 PM",
      endTime: "8:00 PM",
      location: "Main Gym",
      organizationId: org.id,
      teamId: varsity.id,
    },
  });

  const checkIns = [
    {
      userId: cody.id,
      eventId: pastEvent.id,
      status: "ON_TIME" as const,
      checkInTime: new Date(yesterday.getTime() + 17 * 60 * 60 * 1000 + 58 * 60 * 1000), // 5:58 PM
      checkOutTime: new Date(yesterday.getTime() + 20 * 60 * 60 * 1000 + 2 * 60 * 1000), // 8:02 PM
      hoursLogged: 2.07,
    },
    {
      userId: sarah.id,
      eventId: pastEvent.id,
      status: "ON_TIME" as const,
      checkInTime: new Date(yesterday.getTime() + 17 * 60 * 60 * 1000 + 45 * 60 * 1000), // 5:45 PM
      checkOutTime: new Date(yesterday.getTime() + 20 * 60 * 60 * 1000), // 8:00 PM
      hoursLogged: 2.25,
    },
    {
      userId: marcus.id,
      eventId: pastEvent.id,
      status: "LATE" as const,
      checkInTime: new Date(yesterday.getTime() + 18 * 60 * 60 * 1000 + 18 * 60 * 1000), // 6:18 PM
      checkOutTime: new Date(yesterday.getTime() + 20 * 60 * 60 * 1000), // 8:00 PM
      hoursLogged: 1.7,
    },
  ];

  for (const checkIn of checkIns) {
    await prisma.checkIn.upsert({
      where: { userId_eventId: { userId: checkIn.userId, eventId: checkIn.eventId } },
      update: {},
      create: checkIn,
    });
  }

  console.log("✅ Check-ins created");

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
