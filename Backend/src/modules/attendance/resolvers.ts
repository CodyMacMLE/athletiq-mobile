import { prisma } from "../../db.js";
import { AttendanceStatus, ExcuseRequestStatus, RsvpStatus, TeamRole } from "@prisma/client";
import { requireCoachOrAbove } from "../../utils/permissions.js";
import { parseTimeString, toISO } from "../../utils/time.js";
import { markAbsentForEndedEvents } from "../../services/markAbsent.js";
import { sendPushNotification } from "../../notifications/pushNotifications.js";
import { sendExcuseStatusEmail } from "../../notifications/emailNotifications.js";
import type { Loaders } from "../../utils/dataLoaders.js";

interface Context {
  userId?: string;
  loaders: Loaders;
}

export const attendanceResolvers = {
  Query: {
    // Active check-in query (for dashboard check-out button)
    activeCheckIn: async (
      _: unknown,
      { userId }: { userId?: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) return null;

      let targetUserId = context.userId;
      if (userId && userId !== context.userId) {
        // Verify caller is a guardian of the target user
        const guardianLink = await prisma.guardianLink.findFirst({
          where: { guardianId: context.userId, athleteId: userId },
        });
        if (!guardianLink) throw new Error("Not authorized to view this user's check-ins");
        targetUserId = userId;
      }

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      return prisma.checkIn.findFirst({
        where: {
          userId: targetUserId,
          checkInTime: { not: null },
          checkOutTime: null,
          approved: true,
          event: {
            date: { gte: todayStart, lte: todayEnd },
          },
        },
        orderBy: { checkInTime: "desc" },
      });
    },

    // Check-in queries
    checkIn: async (_: unknown, { id }: { id: string }) => {
      return prisma.checkIn.findUnique({ where: { id } });
    },

    checkInHistory: async (_: unknown, { userId, teamId, limit }: { userId: string; teamId?: string; limit?: number }) => {
      return prisma.checkIn.findMany({
        where: {
          userId,
          ...(teamId && {
            event: {
              OR: [
                { teamId },
                { participatingTeams: { some: { id: teamId } } },
              ],
            },
          }),
        },
        orderBy: { createdAt: "desc" },
        take: limit || 20,
      });
    },

    eventAttendance: async (_: unknown, { eventId }: { eventId: string }) => {
      return prisma.checkIn.findMany({
        where: { eventId },
        include: { user: true },
      });
    },

    eventUncheckedAthletes: async (_: unknown, { eventId }: { eventId: string }) => {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
          participatingTeams: {
            include: { members: { where: { role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } }, include: { user: true } } },
          },
          team: {
            include: { members: { where: { role: { in: ["MEMBER", "CAPTAIN"] as TeamRole[] } }, include: { user: true } } },
          },
        },
      });
      if (!event) throw new Error("Event not found");

      // Collect all athletes from participating teams and the direct team
      type UserRecord = { id: string; email: string; firstName: string; lastName: string; [key: string]: unknown };
      const userMap = new Map<string, UserRecord>();
      if (event.team) {
        for (const member of event.team.members) {
          userMap.set(member.user.id, member.user);
        }
      }
      for (const team of event.participatingTeams) {
        for (const member of team.members) {
          userMap.set(member.user.id, member.user);
        }
      }

      // Get already checked-in user IDs
      const existingCheckIns = await prisma.checkIn.findMany({
        where: { eventId },
        select: { userId: true },
      });
      const checkedInIds = new Set(existingCheckIns.map((c) => c.userId));

      // Apply include/exclude overrides
      const excludeRows = await prisma.eventAthleteExclude.findMany({ where: { eventId: event.id } });
      const excludedIds = new Set(excludeRows.map(r => r.userId));
      const includeRows = await prisma.eventAthleteInclude.findMany({
        where: { eventId: event.id },
        include: { user: true },
      });
      const includedUsers = includeRows.map(r => r.user);

      // Filter out excluded, add included, deduplicate
      const filteredAthletes = Array.from(userMap.values()).filter(u => !excludedIds.has(u.id));
      const allIds = new Set(filteredAthletes.map(u => u.id));
      for (const u of includedUsers) {
        if (!allIds.has(u.id)) filteredAthletes.push(u as any);
      }

      // Apply recurring-event-level overrides
      if (event.recurringEventId) {
        const reExcludeRows = await prisma.recurringEventAthleteExclude.findMany({
          where: { recurringEventId: event.recurringEventId },
        });
        for (const r of reExcludeRows) excludedIds.add(r.userId);
        const reIncludeRows = await prisma.recurringEventAthleteInclude.findMany({
          where: { recurringEventId: event.recurringEventId },
          include: { user: true },
        });
        for (const r of reIncludeRows) {
          if (!allIds.has(r.userId) && !excludedIds.has(r.userId)) {
            filteredAthletes.push(r.user as any);
          }
        }
      }

      // Return users not yet checked in
      return filteredAthletes.filter((u) => !excludedIds.has(u.id) && !checkedInIds.has(u.id));
    },

    // Excuse queries
    excuseRequest: async (_: unknown, { id }: { id: string }) => {
      return prisma.excuseRequest.findUnique({ where: { id } });
    },

    myExcuseRequests: async (_: unknown, { userId }: { userId: string }) => {
      return prisma.excuseRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
    },

    pendingExcuseRequests: async (_: unknown, { organizationId }: { organizationId: string }) => {
      return prisma.excuseRequest.findMany({
        where: {
          status: "PENDING",
          event: { organizationId },
        },
        orderBy: { createdAt: "asc" },
      });
    },

    orgExcuseRequests: async (
      _: unknown,
      {
        organizationId,
        status,
        requesterType,
        search,
        sortBy,
        sortDir,
        limit = 15,
        offset = 0,
      }: {
        organizationId: string;
        status?: string;
        requesterType?: string;
        search?: string;
        sortBy?: string;
        sortDir?: string;
        limit?: number;
        offset?: number;
      }
    ) => {
      const STAFF_ROLES = ["OWNER", "ADMIN", "MANAGER", "COACH"] as any[];

      const conditions: any[] = [{ event: { organizationId } }];

      if (status === "PENDING") {
        conditions.push({ status: "PENDING" });
      } else if (status === "HANDLED") {
        conditions.push({ status: { in: ["APPROVED", "DENIED"] } });
      }

      if (requesterType === "STAFF" || requesterType === "ATHLETE") {
        const roles: any[] = requesterType === "STAFF" ? STAFF_ROLES : ["ATHLETE"];
        const members = await prisma.organizationMember.findMany({
          where: { organizationId, role: { in: roles } },
          select: { userId: true },
        });
        conditions.push({ userId: { in: members.map((m: any) => m.userId) } });
      }

      if (search && search.trim()) {
        const q = search.trim();
        conditions.push({
          OR: [
            { reason: { contains: q, mode: "insensitive" } },
            { event: { title: { contains: q, mode: "insensitive" } } },
            { user: { firstName: { contains: q, mode: "insensitive" } } },
            { user: { lastName: { contains: q, mode: "insensitive" } } },
          ],
        });
      }

      const where: any = { AND: conditions };

      const dir = sortDir === "asc" ? "asc" : "desc";
      let orderBy: any = { createdAt: "desc" };
      if (sortBy === "name") orderBy = { user: { lastName: dir } };
      else if (sortBy === "event") orderBy = { event: { title: dir } };
      else if (sortBy === "date") orderBy = { event: { date: dir } };

      const [total, items] = await prisma.$transaction([
        prisma.excuseRequest.count({ where }),
        prisma.excuseRequest.findMany({ where, orderBy, take: limit, skip: offset }),
      ]);

      return { items, total };
    },

    // RSVP queries
    myRsvps: async (_: unknown, { userId }: { userId: string }) => {
      return prisma.eventRsvp.findMany({
        where: { userId },
        include: { user: true, event: true },
      });
    },
  },

  Mutation: {
    // Check-in mutations
    markAbsentForPastEvents: async (
      _: unknown,
      { organizationId }: { organizationId: string }
    ) => {
      return markAbsentForEndedEvents({ organizationId, lookbackMinutes: 10080 });
    },

    checkIn: async (
      _: unknown,
      { input }: { input: { userId: string; eventId: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      // If checking in for someone else, verify guardian relationship
      if (input.userId !== context.userId) {
        const event = await prisma.event.findUnique({ where: { id: input.eventId } });
        if (!event) throw new Error("Event not found");
        const guardianLink = await prisma.guardianLink.findFirst({
          where: { guardianId: context.userId, athleteId: input.userId, organizationId: event.organizationId },
        });
        if (!guardianLink) throw new Error("Not authorized to check in this user");
      }

      const event = await prisma.event.findUnique({ where: { id: input.eventId } });
      if (!event) throw new Error("Event not found");

      const now = new Date();
      const eventStart = new Date(event.date);
      const { hours, minutes } = parseTimeString(event.startTime);
      eventStart.setHours(hours, minutes);

      // Determine if on time or late (on-time = before start, late = after start)
      const status: AttendanceStatus = now.getTime() <= eventStart.getTime() ? "ON_TIME" : "LATE";

      const checkIn = await prisma.checkIn.create({
        data: {
          userId: input.userId,
          eventId: input.eventId,
          status,
          checkInTime: now,
        },
      });

      // Check for attendance milestones (non-blocking)
      (async () => {
        try {
          const prefs = await prisma.notificationPreferences.findUnique({
            where: { userId: input.userId },
          });

          // Skip if milestone notifications are disabled
          if (prefs && !prefs.milestonesEnabled) {
            return;
          }

          // Count total successful check-ins (ON_TIME or LATE)
          const totalCheckIns = await prisma.checkIn.count({
            where: {
              userId: input.userId,
              status: { in: ["ON_TIME", "LATE"] },
              approved: true,
            },
          });

          // Milestone check-in counts
          const milestones = [10, 25, 50, 100, 250, 500, 1000];
          if (milestones.includes(totalCheckIns)) {
            const title = `🎉 ${totalCheckIns} Check-ins!`;
            const message = `Congratulations! You've reached ${totalCheckIns} check-ins. Keep up the great work!`;

            // Send push notification
            if (!prefs || prefs.pushEnabled) {
              sendPushNotification(input.userId, title, message, {
                type: "ATTENDANCE_MILESTONE",
                milestone: totalCheckIns,
              }).catch((err) => console.error("Failed to send milestone notification:", err));
            }
          }

          // Check attendance percentage milestone (only for users with at least 10 events)
          const allCheckIns = await prisma.checkIn.count({
            where: {
              userId: input.userId,
              approved: true,
            },
          });

          if (allCheckIns >= 10) {
            const successfulCheckIns = await prisma.checkIn.count({
              where: {
                userId: input.userId,
                status: { in: ["ON_TIME", "LATE"] },
                approved: true,
              },
            });

            const attendancePercent = (successfulCheckIns / allCheckIns) * 100;

            // Perfect attendance milestone
            if (attendancePercent === 100 && allCheckIns % 10 === 0) {
              const title = "🏆 Perfect Attendance!";
              const message = `Amazing! You've maintained 100% attendance across ${allCheckIns} events!`;

              if (!prefs || prefs.pushEnabled) {
                sendPushNotification(input.userId, title, message, {
                  type: "ATTENDANCE_MILESTONE",
                  milestone: "perfect_attendance",
                  totalEvents: allCheckIns,
                }).catch((err) => console.error("Failed to send milestone notification:", err));
              }
            }
          }
        } catch (err) {
          console.error("Failed to check attendance milestones:", err);
        }
      })();

      return checkIn;
    },

    checkOut: async (
      _: unknown,
      { input }: { input: { checkInId: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const checkIn = await prisma.checkIn.findUnique({
        where: { id: input.checkInId },
        include: { event: true },
      });
      if (!checkIn) throw new Error("Check-in not found");
      if (!checkIn.checkInTime) throw new Error("No check-in time recorded");

      // If checking out for someone else, verify guardian relationship
      if (checkIn.userId !== context.userId) {
        const guardianLink = await prisma.guardianLink.findFirst({
          where: { guardianId: context.userId, athleteId: checkIn.userId, organizationId: checkIn.event.organizationId },
        });
        if (!guardianLink) throw new Error("Not authorized to check out this user");
      }

      const now = new Date();

      // Use event start time as effective start if athlete checked in early
      let effectiveStart = checkIn.checkInTime;
      if (checkIn.event) {
        const eventDate = new Date(checkIn.event.date);
        const { hours, minutes } = parseTimeString(checkIn.event.startTime);
        const eventStart = new Date(eventDate);
        eventStart.setHours(hours, minutes, 0, 0);
        if (checkIn.checkInTime < eventStart) {
          effectiveStart = eventStart;
        }
      }

      const hoursLogged = Math.max(0, (now.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60));

      return prisma.checkIn.update({
        where: { id: input.checkInId },
        data: {
          checkOutTime: now,
          hoursLogged: Math.round(hoursLogged * 100) / 100,
        },
      });
    },

    adminCheckIn: async (
      _: unknown,
      { input }: { input: { userId: string; eventId: string; status: AttendanceStatus; note?: string; checkInTime?: string | null; checkOutTime?: string | null } }
    ) => {
      // null = explicitly cleared, undefined = auto-set, string = provided value
      let checkInTime: Date | null;
      if (input.checkInTime) {
        checkInTime = new Date(input.checkInTime);
      } else if (input.checkInTime === null) {
        checkInTime = null;
      } else {
        checkInTime = input.status !== "EXCUSED" && input.status !== "ABSENT" ? new Date() : null;
      }
      const checkOutTime = input.checkOutTime ? new Date(input.checkOutTime) : null;

      // Absent status: zero out hours and clear times
      if (input.status === "ABSENT") {
        return prisma.checkIn.upsert({
          where: { userId_eventId: { userId: input.userId, eventId: input.eventId } },
          create: {
            userId: input.userId,
            eventId: input.eventId,
            status: "ABSENT",
            checkInTime: null,
            checkOutTime: null,
            hoursLogged: 0,
            note: input.note,
          },
          update: {
            status: "ABSENT",
            checkInTime: null,
            checkOutTime: null,
            hoursLogged: 0,
            note: input.note,
          },
        });
      }

      // Calculate hoursLogged when both times are provided
      let hoursLogged: number | null = null;
      if (checkInTime && checkOutTime) {
        // Use event start as effective start if check-in was early
        const event = await prisma.event.findUnique({ where: { id: input.eventId } });
        let effectiveStart = checkInTime;
        if (event) {
          const eventDate = new Date(event.date);
          const evTime = parseTimeString(event.startTime);
          const evStart = new Date(eventDate);
          evStart.setHours(evTime.hours, evTime.minutes, 0, 0);
          if (checkInTime < evStart) {
            effectiveStart = evStart;
          }
        }
        hoursLogged = Math.round(Math.max(0, (checkOutTime.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60)) * 100) / 100;
      }

      return prisma.checkIn.upsert({
        where: { userId_eventId: { userId: input.userId, eventId: input.eventId } },
        create: {
          userId: input.userId,
          eventId: input.eventId,
          status: input.status,
          checkInTime,
          checkOutTime,
          ...(hoursLogged !== null && { hoursLogged }),
          note: input.note,
        },
        update: {
          status: input.status,
          checkInTime,
          checkOutTime,
          ...(hoursLogged !== null && { hoursLogged }),
          note: input.note,
        },
      });
    },

    deleteCheckIn: async (_: unknown, { userId, eventId }: { userId: string; eventId: string }) => {
      await prisma.checkIn.deleteMany({ where: { userId, eventId } });
      return true;
    },

    markAbsent: async (_: unknown, { userId, eventId }: { userId: string; eventId: string }) => {
      return prisma.checkIn.upsert({
        where: { userId_eventId: { userId, eventId } },
        create: {
          userId,
          eventId,
          status: "ABSENT",
          checkInTime: null,
          checkOutTime: null,
          hoursLogged: 0,
        },
        update: {
          status: "ABSENT",
          checkInTime: null,
          checkOutTime: null,
          hoursLogged: 0,
        },
      });
    },

    // Excuse mutations
    createExcuseRequest: async (
      _: unknown,
      { input }: { input: { userId: string; eventId: string; reason: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      if (input.userId !== context.userId) {
        const guardianLink = await prisma.guardianLink.findFirst({
          where: { guardianId: context.userId, athleteId: input.userId },
        });
        if (!guardianLink) throw new Error("Not authorized to submit excuse for this user");
      }

      const existing = await prisma.excuseRequest.findUnique({
        where: { userId_eventId: { userId: input.userId, eventId: input.eventId } },
      });

      if (!existing) {
        return prisma.excuseRequest.create({ data: { ...input, attemptCount: 1 } });
      }
      if (existing.status === "PENDING") {
        throw new Error("You already have a pending excuse request for this event.");
      }
      if (existing.status === "APPROVED") {
        throw new Error("Your excuse for this event has already been approved.");
      }
      // DENIED — allow resubmission up to 3 attempts
      if (existing.attemptCount >= 3) {
        throw new Error("You have reached the maximum of 3 excuse requests for this event.");
      }
      return prisma.excuseRequest.update({
        where: { id: existing.id },
        data: { status: "PENDING", reason: input.reason, attemptCount: existing.attemptCount + 1 },
      });
    },

    updateExcuseRequest: async (
      _: unknown,
      { input }: { input: { id: string; status: ExcuseRequestStatus } },
      context: { userId?: string }
    ) => {
      const excuse = await prisma.excuseRequest.findUnique({
        where: { id: input.id },
        select: { event: { select: { organizationId: true } } },
      });
      if (excuse?.event) await requireCoachOrAbove(context, excuse.event.organizationId);
      const updated = await prisma.excuseRequest.update({
        where: { id: input.id },
        data: { status: input.status },
        include: {
          user: true,
          event: true,
        },
      });

      // If approved, update or create the check-in as excused
      if (input.status === "APPROVED") {
        await prisma.checkIn.upsert({
          where: {
            userId_eventId: {
              userId: updated.userId,
              eventId: updated.eventId,
            },
          },
          create: {
            userId: updated.userId,
            eventId: updated.eventId,
            status: "EXCUSED",
            checkInTime: null,
            checkOutTime: null,
            hoursLogged: 0,
          },
          update: {
            status: "EXCUSED",
            checkInTime: null,
            checkOutTime: null,
            hoursLogged: 0,
          },
        });
      }

      // Send notification (non-blocking)
      if (input.status === "APPROVED" || input.status === "DENIED") {
        (async () => {
          try {
            const prefs = await prisma.notificationPreferences.findUnique({
              where: { userId: updated.userId },
            });

            // Skip if excuse status notifications are disabled
            if (prefs && !prefs.excuseStatusEnabled) {
              return;
            }

            const title = input.status === "APPROVED" ? "Excuse Approved" : "Excuse Denied";
            const message = `Your excuse for ${updated.event.title} was ${input.status.toLowerCase()}`;

            // Send push notification
            if (!prefs || prefs.pushEnabled) {
              sendPushNotification(updated.userId, title, message, {
                type: "EXCUSE_STATUS",
                excuseRequestId: input.id,
                eventId: updated.eventId,
              }).catch((err) => console.error("Failed to send push notification:", err));
            }

            // Send email notification
            if (!prefs || prefs.emailEnabled) {
              sendExcuseStatusEmail(
                updated.user.email,
                input.status as "APPROVED" | "DENIED",
                updated.event.title,
                updated.reason
              ).catch((err) => console.error("Failed to send email notification:", err));
            }
          } catch (err) {
            console.error("Failed to send excuse status notification:", err);
          }
        })();
      }

      return updated;
    },

    cancelExcuseRequest: async (_: unknown, { id }: { id: string }) => {
      await prisma.excuseRequest.delete({ where: { id } });
      return true;
    },

    // RSVP mutations
    upsertRsvp: async (
      _: unknown,
      { input }: { input: { userId: string; eventId: string; status: RsvpStatus; note?: string } },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      if (input.userId !== context.userId) {
        const guardianLink = await prisma.guardianLink.findFirst({
          where: { guardianId: context.userId, athleteId: input.userId },
        });
        if (!guardianLink) throw new Error("Not authorized to RSVP for this user");
      }
      const { userId, eventId, status, note } = input;
      const prev = await prisma.eventRsvp.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      const rsvp = await prisma.eventRsvp.upsert({
        where: { userId_eventId: { userId, eventId } },
        create: { userId, eventId, status, note },
        update: { status, note },
        include: { user: true, event: true },
      });
      if (status === "NOT_GOING") {
        // Auto-create excuse request
        await prisma.excuseRequest.upsert({
          where: { userId_eventId: { userId, eventId } },
          create: { userId, eventId, reason: note || "Unable to attend" },
          update: { reason: note || "Unable to attend", status: "PENDING" },
        });
      } else if (prev?.status === "NOT_GOING") {
        // Switched away from NOT_GOING — cancel pending auto-excuse
        await prisma.excuseRequest.deleteMany({
          where: { userId, eventId, status: "PENDING" },
        });
      }
      return rsvp;
    },

    deleteRsvp: async (_: unknown, { userId, eventId }: { userId: string; eventId: string }) => {
      const existing = await prisma.eventRsvp.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });
      if (!existing) return false;
      if (existing.status === "NOT_GOING") {
        await prisma.excuseRequest.deleteMany({
          where: { userId, eventId, status: "PENDING" },
        });
      }
      await prisma.eventRsvp.delete({ where: { userId_eventId: { userId, eventId } } });
      return true;
    },

    // Notification read mutations
    markNotificationRead: async (
      _: unknown,
      { id }: { id: string },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      return prisma.notificationDelivery.update({
        where: { id },
        data: { readAt: new Date() },
      });
    },

    markAllNotificationsRead: async (
      _: unknown,
      __: unknown,
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");
      const result = await prisma.notificationDelivery.updateMany({
        where: { userId: context.userId, readAt: null },
        data: { readAt: new Date() },
      });
      return result.count;
    },

    updateCheckInTimes: async (
      _: unknown,
      { checkInId, checkInTime, checkOutTime }: { checkInId: string; checkInTime?: string | null; checkOutTime?: string | null },
      context: { userId?: string }
    ) => {
      if (!context.userId) throw new Error("Authentication required");

      const checkIn = await prisma.checkIn.findUnique({
        where: { id: checkInId },
        include: { event: true },
      });
      if (!checkIn) throw new Error("Check-in not found");

      const membership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: context.userId, organizationId: checkIn.event.organizationId } },
      });
      if (!membership) throw new Error("Not a member of this organization");

      const isAdmin = ["OWNER", "ADMIN", "MANAGER"].includes(membership.role);
      if (!isAdmin) {
        if (checkIn.userId !== context.userId) throw new Error("Not authorized");
        if (membership.role !== "COACH") throw new Error("Not authorized");
        const org = await prisma.organization.findUnique({ where: { id: checkIn.event.organizationId } });
        if (!org?.allowCoachHourEdit) throw new Error("Coach hour editing is not enabled for this organization");
      }

      let hoursLogged = checkIn.hoursLogged;
      if (checkInTime && checkOutTime) {
        const diffMs = new Date(checkOutTime).getTime() - new Date(checkInTime).getTime();
        hoursLogged = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }

      return prisma.checkIn.update({
        where: { id: checkInId },
        data: {
          ...(checkInTime !== undefined && { checkInTime: checkInTime ? new Date(checkInTime) : null }),
          ...(checkOutTime !== undefined && { checkOutTime: checkOutTime ? new Date(checkOutTime) : null }),
          ...(hoursLogged !== null && { hoursLogged }),
        },
        include: { user: true, event: true },
      });
    },
  },

  CheckIn: {
    user: (parent: { userId: string }, _: unknown, context: Context) =>
      context.loaders.user.load(parent.userId),
    event: (parent: { eventId: string }, _: unknown, context: Context) =>
      context.loaders.event.load(parent.eventId),
    checkInTime: (parent: any) => parent.checkInTime ? toISO(parent.checkInTime) : null,
    checkOutTime: (parent: any) => parent.checkOutTime ? toISO(parent.checkOutTime) : null,
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  ExcuseRequest: {
    user: (parent: { userId: string }, _: unknown, context: Context) =>
      context.loaders.user.load(parent.userId),
    event: (parent: { eventId: string }, _: unknown, context: Context) =>
      context.loaders.event.load(parent.eventId),
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },

  EventRsvp: {
    user: (parent: any) => parent.user ?? prisma.user.findUnique({ where: { id: parent.userId } }),
    event: (parent: any) => parent.event ?? prisma.event.findUnique({ where: { id: parent.eventId } }),
    createdAt: (parent: any) => toISO(parent.createdAt),
    updatedAt: (parent: any) => toISO(parent.updatedAt),
  },
};
